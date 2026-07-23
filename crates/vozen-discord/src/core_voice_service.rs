//! Application service for the first promoted voice commands.
//!
//! This keeps Discord event parsing, durable policy, synthesis and audio transport on separate
//! boundaries. It is deliberately usable with fake implementations: production must prove this
//! same service before an interaction handler is allowed to own `/join`, `/leave` or `/tts`.

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use thiserror::Error;
use vozen_core::{
    GuildRateLimiters, QueueEnqueueOptions, QueueLane, QueueSource, RolePolicy, SynthRequest,
    SynthesisEngine, UserSpeechAdmission, admit_user_speech,
};
use vozen_store::{SqliteStore, UserEngine};

use crate::{
    CommandSpeechInput, CommandSpeechOutcome, CommandSpeechPipeline, CoreVoiceCommand,
    GatewayState, GuildSynthesisCoordinator, JoinVoiceOutcome, LeaveVoiceOutcome,
    VoiceSessionService, VoiceSessionTransport, laughter_for_model,
};

#[derive(Debug, Error)]
#[error("speech synthesis failed")]
pub struct CommandSynthesisError;

#[derive(Debug, Error)]
#[error("voice playback failed")]
pub struct CommandPlaybackError;

/// Command handlers only see whether a call exists and whether it is currently speaking; they
/// never inspect another member's queue entries or text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandPlaybackState {
    NoSession,
    Idle,
    Active,
}

/// Synthesizes an already-authorized private request. Implementations must never log the request
/// text or use it as a shell argument.
#[async_trait]
pub trait CommandSpeechSynthesizer: Send + Sync {
    async fn synthesize(
        &self,
        request: &SynthRequest,
    ) -> Result<std::path::PathBuf, CommandSynthesisError>;
}

/// Reserves capacity before synthesis and later accepts the immutable WAV in the guild FIFO.
/// This prevents an already-full queue from spending CPU on Piper output that can never play.
/// Implementations must make a successful reservation visible to every concurrent request and
/// must release it when `cancel_reservation` is called.
#[async_trait]
pub trait CommandVoicePlayback: Send + Sync {
    async fn state(&self, guild_id: &str) -> Result<CommandPlaybackState, CommandPlaybackError>;
    async fn reserve(&self, guild_id: &str, lane: QueueLane) -> Result<bool, CommandPlaybackError>;
    async fn enqueue_reserved(
        &self,
        guild_id: &str,
        wav: &Path,
        options: QueueEnqueueOptions<'_>,
    ) -> Result<(), CommandPlaybackError>;
    async fn cancel_reservation(
        &self,
        guild_id: &str,
        lane: QueueLane,
    ) -> Result<(), CommandPlaybackError>;
    async fn skip(&self, guild_id: &str) -> Result<(), CommandPlaybackError>;
    async fn silence(&self, guild_id: &str) -> Result<(), CommandPlaybackError>;
}

/// Facts that Discord resolved for an interaction. Role IDs are read only from the current guild
/// member object; `None` preserves the fail-closed role policy if the cache could not resolve it.
pub struct CoreVoiceInvocation<'a> {
    pub guild_id: &'a str,
    pub channel_id: &'a str,
    pub user_id: &'a str,
    pub member_role_ids: Option<&'a [String]>,
    pub resolve_user: &'a dyn Fn(&str) -> String,
    pub resolve_channel: &'a dyn Fn(&str) -> String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreTtsOutcome {
    NotInSameVoice,
    Blocked,
    Empty,
    RateLimited,
    FullyBlocked,
    Queued,
    Busy,
    SynthesisFailed,
    PlaybackFailed,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CorePreviewOutcome {
    NotInPlayer,
    NotInSameVoice,
    RateLimited,
    Busy,
    UnknownModel,
    Queued,
    SynthesisFailed,
    PlaybackFailed,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreVoiceOutcome {
    Joined(JoinVoiceOutcome),
    Left(LeaveVoiceOutcome),
    Laugh(CorePreviewOutcome),
    Tts(CoreTtsOutcome),
    Preview(CorePreviewOutcome),
    Skipped(CorePlaybackControlOutcome),
    Silenced(CorePlaybackControlOutcome),
    /// A contract-valid but not-yet-promoted command must remain with the Node runtime.
    NotPromoted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CorePlaybackControlOutcome {
    NotInVoice,
    NothingPlaying,
    Completed,
    PlaybackFailed,
}

/// Operational configuration selected at Rust process startup. These values are trusted
/// environment/config values, never supplied by Discord users.
#[derive(Debug, Clone)]
pub struct CoreVoiceSettings {
    pub available_models: Vec<String>,
    pub default_voice: String,
    pub default_speed: f64,
    /// Concrete route used for legacy `google` voice preferences.
    pub default_engine: SynthesisEngine,
}

pub struct CoreVoiceService<T, S, P> {
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    sessions: VoiceSessionService<T>,
    speech: Mutex<CommandSpeechPipeline>,
    preview_limiters: Mutex<GuildRateLimiters>,
    synthesizer: S,
    playback: P,
    synthesis: GuildSynthesisCoordinator,
    settings: CoreVoiceSettings,
    now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
}

impl<T, S, P> CoreVoiceService<T, S, P> {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        gateway_state: GatewayState,
        transport: T,
        synthesizer: S,
        playback: P,
        settings: CoreVoiceSettings,
        now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self::new_with_synthesis_coordinator(
            store,
            gateway_state,
            transport,
            synthesizer,
            playback,
            GuildSynthesisCoordinator::default(),
            settings,
            now_ms,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new_with_synthesis_coordinator(
        store: Arc<Mutex<SqliteStore>>,
        gateway_state: GatewayState,
        transport: T,
        synthesizer: S,
        playback: P,
        synthesis: GuildSynthesisCoordinator,
        settings: CoreVoiceSettings,
        now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        let sessions = VoiceSessionService::new(store.clone(), gateway_state.clone(), transport);
        Self {
            store,
            gateway_state,
            sessions,
            speech: Mutex::new(CommandSpeechPipeline::default()),
            preview_limiters: Mutex::new(GuildRateLimiters::default()),
            synthesizer,
            playback,
            synthesis,
            settings,
            now_ms,
        }
    }
}

impl<T, S, P> CoreVoiceService<T, S, P>
where
    T: VoiceSessionTransport,
    S: CommandSpeechSynthesizer,
    P: CommandVoicePlayback,
{
    /// Executes only commands that have a complete, safe Rust path. `NotPromoted` is intentional
    /// during shadow migration: the gateway must leave such commands to Node rather than render
    /// an incorrect response or lose an interaction.
    pub async fn execute(
        &self,
        invocation: CoreVoiceInvocation<'_>,
        command: &CoreVoiceCommand,
    ) -> CoreVoiceOutcome {
        match command {
            CoreVoiceCommand::Join => CoreVoiceOutcome::Joined(
                self.sessions
                    .join_for_user(invocation.guild_id, invocation.user_id, (self.now_ms)())
                    .await,
            ),
            CoreVoiceCommand::Leave => {
                CoreVoiceOutcome::Left(self.sessions.leave_explicitly(invocation.guild_id).await)
            }
            CoreVoiceCommand::Laugh => {
                CoreVoiceOutcome::Laugh(self.execute_laugh(invocation).await)
            }
            CoreVoiceCommand::Skip => {
                CoreVoiceOutcome::Skipped(self.skip(invocation.guild_id).await)
            }
            CoreVoiceCommand::ShutUp => {
                CoreVoiceOutcome::Silenced(self.silence(invocation.guild_id).await)
            }
            CoreVoiceCommand::Tts { text } => {
                CoreVoiceOutcome::Tts(self.execute_tts(invocation, text).await)
            }
            CoreVoiceCommand::VoicePreview { model } => CoreVoiceOutcome::Preview(
                self.execute_preview(
                    invocation,
                    model.as_deref(),
                    "Hi, I'm Vozen. type it, hear it.",
                )
                .await,
            ),
        }
    }

    /// Executes a deliberately selected voice sample. The gateway supplies the localized sample
    /// phrase; this keeps the semantic service independent from Discord's locale catalog while
    /// preserving the Node precedence of explicit model, saved model, guild default and runtime
    /// default.
    pub async fn execute_preview(
        &self,
        invocation: CoreVoiceInvocation<'_>,
        explicit_model: Option<&str>,
        sample: &str,
    ) -> CorePreviewOutcome {
        if let Some(model) = explicit_model
            && !self
                .settings
                .available_models
                .iter()
                .any(|available| available == model)
        {
            return CorePreviewOutcome::UnknownModel;
        }

        let playback_state = match self.playback.state(invocation.guild_id).await {
            Ok(state) => state,
            Err(_) => return CorePreviewOutcome::NotInPlayer,
        };
        if matches!(playback_state, CommandPlaybackState::NoSession) {
            return CorePreviewOutcome::NotInPlayer;
        }

        let roles = invocation
            .member_role_ids
            .map(|roles| roles.iter().map(String::as_str).collect::<Vec<_>>());
        let (model, speed, engine, lane) = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            let config = match store.guild_config(invocation.guild_id) {
                Ok(config) => config,
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            let policy = RolePolicy {
                priority_role_id: config.priority_role_id.as_deref(),
                blocked_role_id: config.blocked_role_id.as_deref(),
            };
            let lane = match admit_user_speech(
                self.gateway_state
                    .voice_channel_id(invocation.guild_id, invocation.user_id)
                    .as_deref(),
                self.gateway_state
                    .bot_voice_channel_id(invocation.guild_id)
                    .as_deref(),
                roles.as_deref(),
                policy,
            ) {
                UserSpeechAdmission::Allowed { lane } => lane,
                // Node intentionally uses the same not-in-voice response for blocked preview
                // requests; do not expose role-policy state through this sample command.
                UserSpeechAdmission::Denied { .. } => {
                    return CorePreviewOutcome::NotInSameVoice;
                }
            };
            let allowed = match self.preview_limiters.lock() {
                Ok(mut limiters) => limiters.allow(
                    invocation.guild_id,
                    invocation.user_id,
                    config.rate_per_min,
                    (self.now_ms)(),
                ),
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            if !allowed {
                return CorePreviewOutcome::RateLimited;
            }

            let stored = match store.get_user_voice(invocation.guild_id, invocation.user_id) {
                Ok(stored) => stored,
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            let model = explicit_model
                .map(str::to_owned)
                .or_else(|| {
                    stored
                        .as_ref()
                        .map(|voice| voice.model.clone())
                        .filter(|model| !model.trim().is_empty())
                })
                .or_else(|| {
                    (!config.default_voice.trim().is_empty()).then(|| config.default_voice.clone())
                })
                .unwrap_or_else(|| self.settings.default_voice.clone());
            let speed = stored
                .as_ref()
                .map(|voice| voice.speed)
                .filter(|speed| speed.is_finite())
                .unwrap_or(self.settings.default_speed);
            let engine = resolve_preview_engine(
                &store,
                invocation.guild_id,
                invocation.user_id,
                stored.map(|voice| voice.engine),
                (self.now_ms)(),
            );
            (model, speed, engine, lane)
        };

        let admitted_generation = self.synthesis.admission_generation(invocation.guild_id);
        let mut synthesis = self
            .synthesis
            .acquire(invocation.guild_id, admitted_generation)
            .await;
        if synthesis.was_cleared() {
            return CorePreviewOutcome::PlaybackFailed;
        }
        synthesis.activate();
        match self.playback.reserve(invocation.guild_id, lane).await {
            Ok(true) => {}
            Ok(false) => return CorePreviewOutcome::Busy,
            Err(_) => return CorePreviewOutcome::PlaybackFailed,
        }
        let request = SynthRequest {
            text: sample.to_owned(),
            model,
            speed,
            engine,
            segments: None,
            single_voice: Some(true),
            emphasis_source: None,
            lead_silence_ms: 0,
        };
        if synthesis.cancelled() {
            let _ = self
                .playback
                .cancel_reservation(invocation.guild_id, lane)
                .await;
            return CorePreviewOutcome::PlaybackFailed;
        }
        let wav = match self.synthesizer.synthesize(&request).await {
            Ok(wav) => wav,
            Err(_) => {
                let _ = self
                    .playback
                    .cancel_reservation(invocation.guild_id, lane)
                    .await;
                return CorePreviewOutcome::SynthesisFailed;
            }
        };
        if synthesis.cancelled() {
            let _ = self
                .playback
                .cancel_reservation(invocation.guild_id, lane)
                .await;
            return CorePreviewOutcome::PlaybackFailed;
        }
        match self
            .playback
            .enqueue_reserved(
                invocation.guild_id,
                &wav,
                QueueEnqueueOptions {
                    author_id: Some(invocation.user_id),
                    source: QueueSource::Command,
                    lane,
                    created_at_ms: (self.now_ms)().max(0) as u64,
                },
            )
            .await
        {
            Ok(()) => CorePreviewOutcome::Queued,
            Err(_) => {
                let _ = self
                    .playback
                    .cancel_reservation(invocation.guild_id, lane)
                    .await;
                CorePreviewOutcome::PlaybackFailed
            }
        }
    }

    /// `/laugh` keeps the Node precedence (saved model, guild default, runtime default) but
    /// chooses laughter in the same script as that model before entering the shared preview
    /// admission, synthesis and queue path.
    async fn execute_laugh(&self, invocation: CoreVoiceInvocation<'_>) -> CorePreviewOutcome {
        let model = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            let config = match store.guild_config(invocation.guild_id) {
                Ok(config) => config,
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            let stored = match store.get_user_voice(invocation.guild_id, invocation.user_id) {
                Ok(stored) => stored,
                Err(_) => return CorePreviewOutcome::StoreUnavailable,
            };
            stored
                .as_ref()
                .map(|voice| voice.model.clone())
                .filter(|model| !model.trim().is_empty())
                .or_else(|| {
                    (!config.default_voice.trim().is_empty()).then(|| config.default_voice.clone())
                })
                .unwrap_or_else(|| self.settings.default_voice.clone())
        };
        let sample = laughter_for_model(&model);
        self.execute_preview(invocation, Some(&model), &sample)
            .await
    }

    async fn skip(&self, guild_id: &str) -> CorePlaybackControlOutcome {
        match self.playback.state(guild_id).await {
            Ok(CommandPlaybackState::NoSession) => CorePlaybackControlOutcome::NotInVoice,
            Ok(CommandPlaybackState::Idle) => {
                if self.synthesis.cancel_active(guild_id) {
                    CorePlaybackControlOutcome::Completed
                } else {
                    CorePlaybackControlOutcome::NothingPlaying
                }
            }
            Ok(CommandPlaybackState::Active) => match self.playback.skip(guild_id).await {
                Ok(()) => CorePlaybackControlOutcome::Completed,
                Err(_) => CorePlaybackControlOutcome::PlaybackFailed,
            },
            Err(_) => CorePlaybackControlOutcome::PlaybackFailed,
        }
    }

    async fn silence(&self, guild_id: &str) -> CorePlaybackControlOutcome {
        let cancelled_synthesis = self.synthesis.clear(guild_id);
        match self.playback.state(guild_id).await {
            Ok(CommandPlaybackState::NoSession) => {
                if cancelled_synthesis {
                    CorePlaybackControlOutcome::Completed
                } else {
                    CorePlaybackControlOutcome::NotInVoice
                }
            }
            Ok(CommandPlaybackState::Idle) => {
                if cancelled_synthesis {
                    CorePlaybackControlOutcome::Completed
                } else {
                    CorePlaybackControlOutcome::NothingPlaying
                }
            }
            Ok(CommandPlaybackState::Active) => match self.playback.silence(guild_id).await {
                Ok(()) => CorePlaybackControlOutcome::Completed,
                Err(_) => CorePlaybackControlOutcome::PlaybackFailed,
            },
            Err(_) => CorePlaybackControlOutcome::PlaybackFailed,
        }
    }

    async fn execute_tts(&self, invocation: CoreVoiceInvocation<'_>, text: &str) -> CoreTtsOutcome {
        let roles = invocation
            .member_role_ids
            .map(|roles| roles.iter().map(String::as_str).collect::<Vec<_>>());
        let prepared = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return CoreTtsOutcome::StoreUnavailable,
            };
            let mut speech = match self.speech.lock() {
                Ok(speech) => speech,
                Err(_) => return CoreTtsOutcome::StoreUnavailable,
            };
            speech.prepare(
                &store,
                CommandSpeechInput {
                    guild_id: invocation.guild_id,
                    channel_id: invocation.channel_id,
                    user_id: invocation.user_id,
                    raw: text,
                    caller_voice_channel_id: self
                        .gateway_state
                        .voice_channel_id(invocation.guild_id, invocation.user_id)
                        .as_deref(),
                    bot_voice_channel_id: self
                        .gateway_state
                        .bot_voice_channel_id(invocation.guild_id)
                        .as_deref(),
                    member_role_ids: roles.as_deref(),
                    available_models: &self.settings.available_models,
                    runtime_default_voice: &self.settings.default_voice,
                    runtime_default_speed: self.settings.default_speed,
                    runtime_default_engine: self.settings.default_engine,
                    detected_language: None,
                    resolve_user: invocation.resolve_user,
                    resolve_channel: invocation.resolve_channel,
                },
                (self.now_ms)(),
            )
        };

        let (lane, request) = match prepared {
            Ok(CommandSpeechOutcome::Ready { lane, speech }) => (lane, speech.request),
            Ok(CommandSpeechOutcome::NotInSameVoice) => return CoreTtsOutcome::NotInSameVoice,
            Ok(CommandSpeechOutcome::Blocked) => return CoreTtsOutcome::Blocked,
            Ok(CommandSpeechOutcome::Empty) => return CoreTtsOutcome::Empty,
            Ok(CommandSpeechOutcome::RateLimited) => return CoreTtsOutcome::RateLimited,
            Ok(CommandSpeechOutcome::FullyBlocked) => return CoreTtsOutcome::FullyBlocked,
            Err(_) => return CoreTtsOutcome::StoreUnavailable,
        };
        let admitted_generation = self.synthesis.admission_generation(invocation.guild_id);
        let mut synthesis = self
            .synthesis
            .acquire(invocation.guild_id, admitted_generation)
            .await;
        if synthesis.was_cleared() {
            return CoreTtsOutcome::PlaybackFailed;
        }
        synthesis.activate();

        match self.playback.reserve(invocation.guild_id, lane).await {
            Ok(true) => {}
            Ok(false) => return CoreTtsOutcome::Busy,
            Err(_) => return CoreTtsOutcome::PlaybackFailed,
        }
        if synthesis.cancelled() {
            let _ = self
                .playback
                .cancel_reservation(invocation.guild_id, lane)
                .await;
            return CoreTtsOutcome::PlaybackFailed;
        }
        let wav = match self.synthesizer.synthesize(&request).await {
            Ok(wav) => wav,
            Err(_) => {
                let _ = self
                    .playback
                    .cancel_reservation(invocation.guild_id, lane)
                    .await;
                return CoreTtsOutcome::SynthesisFailed;
            }
        };
        if synthesis.cancelled() {
            let _ = self
                .playback
                .cancel_reservation(invocation.guild_id, lane)
                .await;
            return CoreTtsOutcome::PlaybackFailed;
        }
        match self
            .playback
            .enqueue_reserved(
                invocation.guild_id,
                &wav,
                QueueEnqueueOptions {
                    author_id: Some(invocation.user_id),
                    source: QueueSource::Command,
                    lane,
                    created_at_ms: (self.now_ms)().max(0) as u64,
                },
            )
            .await
        {
            Ok(()) => CoreTtsOutcome::Queued,
            Err(_) => {
                let _ = self
                    .playback
                    .cancel_reservation(invocation.guild_id, lane)
                    .await;
                CoreTtsOutcome::PlaybackFailed
            }
        }
    }

    /// Releases process-local user buckets on a real guild departure.
    pub fn forget_guild(&self, guild_id: &str) {
        if let Ok(mut speech) = self.speech.lock() {
            speech.forget_guild(guild_id);
        }
        self.synthesis.forget_guild(guild_id);
        if let Ok(mut limiters) = self.preview_limiters.lock() {
            limiters.forget_guild(guild_id);
        }
    }
}

fn resolve_preview_engine(
    store: &SqliteStore,
    guild_id: &str,
    user_id: &str,
    stored: Option<UserEngine>,
    now_ms: i64,
) -> SynthesisEngine {
    match stored.unwrap_or(UserEngine::Google) {
        UserEngine::Google => SynthesisEngine::Default,
        UserEngine::Piper => SynthesisEngine::Piper,
        UserEngine::Kokoro => {
            if store
                .is_user_premium(user_id, now_ms)
                .and_then(|user| {
                    store
                        .is_guild_premium(guild_id, now_ms)
                        .map(|guild| user || guild)
                })
                .unwrap_or(false)
            {
                SynthesisEngine::Kokoro
            } else {
                SynthesisEngine::Default
            }
        }
        UserEngine::Gcloud => {
            let unlocked = store.is_user_premium(user_id, now_ms).unwrap_or(false)
                || store
                    .resolve_guild_pass_owner(guild_id, now_ms)
                    .ok()
                    .flatten()
                    .is_some()
                || store.is_guild_premium(guild_id, now_ms).unwrap_or(false);
            if unlocked {
                SynthesisEngine::Gcloud
            } else {
                SynthesisEngine::Default
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        sync::{
            Arc, Mutex,
            atomic::{AtomicUsize, Ordering},
        },
    };

    use async_trait::async_trait;
    use tokio::sync::Notify;
    use vozen_store::{GuildConfigPatch, SqliteStore};

    use super::*;
    use crate::VoiceSessionTransportError;

    #[derive(Default)]
    struct FakeVoiceTransport;

    #[async_trait]
    impl VoiceSessionTransport for FakeVoiceTransport {
        async fn join(
            &self,
            _guild_id: &str,
            _channel_id: &str,
        ) -> Result<(), VoiceSessionTransportError> {
            Ok(())
        }

        async fn leave(&self, _guild_id: &str) -> Result<(), VoiceSessionTransportError> {
            Ok(())
        }
    }

    #[derive(Default)]
    struct FakeSynthesizer {
        calls: AtomicUsize,
        fails: bool,
    }

    #[async_trait]
    impl CommandSpeechSynthesizer for FakeSynthesizer {
        async fn synthesize(
            &self,
            _request: &SynthRequest,
        ) -> Result<PathBuf, CommandSynthesisError> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            if self.fails {
                return Err(CommandSynthesisError);
            }
            Ok(PathBuf::from("voice.wav"))
        }
    }

    struct BlockingSynthesizer {
        started: Arc<Notify>,
        release: Arc<Notify>,
    }

    #[async_trait]
    impl CommandSpeechSynthesizer for BlockingSynthesizer {
        async fn synthesize(
            &self,
            _request: &SynthRequest,
        ) -> Result<PathBuf, CommandSynthesisError> {
            self.started.notify_one();
            self.release.notified().await;
            Ok(PathBuf::from("voice.wav"))
        }
    }

    struct FakePlayback {
        lanes: Mutex<Vec<QueueLane>>,
        accepted: bool,
        reservations: AtomicUsize,
        enqueues: AtomicUsize,
        state: CommandPlaybackState,
        skips: AtomicUsize,
        silences: AtomicUsize,
    }

    impl Default for FakePlayback {
        fn default() -> Self {
            Self {
                lanes: Mutex::new(Vec::new()),
                accepted: false,
                reservations: AtomicUsize::new(0),
                enqueues: AtomicUsize::new(0),
                state: CommandPlaybackState::NoSession,
                skips: AtomicUsize::new(0),
                silences: AtomicUsize::new(0),
            }
        }
    }

    #[async_trait]
    impl CommandVoicePlayback for FakePlayback {
        async fn state(
            &self,
            _guild_id: &str,
        ) -> Result<CommandPlaybackState, CommandPlaybackError> {
            Ok(self.state)
        }

        async fn reserve(
            &self,
            _guild_id: &str,
            lane: QueueLane,
        ) -> Result<bool, CommandPlaybackError> {
            if self.accepted {
                self.lanes.lock().expect("lanes").push(lane);
                self.reservations.fetch_add(1, Ordering::Relaxed);
            }
            Ok(self.accepted)
        }

        async fn enqueue_reserved(
            &self,
            _guild_id: &str,
            _wav: &Path,
            _options: QueueEnqueueOptions<'_>,
        ) -> Result<(), CommandPlaybackError> {
            self.enqueues.fetch_add(1, Ordering::Relaxed);
            Ok(())
        }

        async fn cancel_reservation(
            &self,
            _guild_id: &str,
            _lane: QueueLane,
        ) -> Result<(), CommandPlaybackError> {
            self.reservations.fetch_sub(1, Ordering::Relaxed);
            Ok(())
        }

        async fn skip(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
            self.skips.fetch_add(1, Ordering::Relaxed);
            Ok(())
        }

        async fn silence(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
            self.silences.fetch_add(1, Ordering::Relaxed);
            Ok(())
        }
    }

    fn service(
        accepted: bool,
    ) -> (
        CoreVoiceService<FakeVoiceTransport, FakeSynthesizer, FakePlayback>,
        Arc<Mutex<SqliteStore>>,
        GatewayState,
    ) {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        state.remember_bot_user("bot".into());
        let service = CoreVoiceService::new(
            store.clone(),
            state.clone(),
            FakeVoiceTransport,
            FakeSynthesizer::default(),
            FakePlayback {
                accepted,
                state: CommandPlaybackState::Active,
                ..FakePlayback::default()
            },
            CoreVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
                default_voice: "en_US-amy-medium".into(),
                default_speed: 1.0,
                default_engine: SynthesisEngine::Piper,
            },
            Arc::new(|| 0),
        );
        (service, store, state)
    }

    fn invocation() -> CoreVoiceInvocation<'static> {
        CoreVoiceInvocation {
            guild_id: "guild",
            channel_id: "channel",
            user_id: "user",
            member_role_ids: None,
            resolve_user: &|_| "user".into(),
            resolve_channel: &|_| "channel".into(),
        }
    }

    #[tokio::test]
    async fn tts_requires_live_same_call_before_synthesis() {
        let (service, _, state) = service(true);
        state.update_voice_state("guild", "user", Some("other".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        assert_eq!(
            service
                .execute(
                    invocation(),
                    &CoreVoiceCommand::Tts {
                        text: "hello".into()
                    },
                )
                .await,
            CoreVoiceOutcome::Tts(CoreTtsOutcome::NotInSameVoice)
        );
        assert_eq!(service.synthesizer.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn preview_requires_live_same_call_before_synthesis() {
        let (service, _, state) = service(true);
        state.update_voice_state("guild", "user", Some("other".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        assert_eq!(
            service
                .execute(
                    invocation(),
                    &CoreVoiceCommand::VoicePreview { model: None },
                )
                .await,
            CoreVoiceOutcome::Preview(CorePreviewOutcome::NotInSameVoice)
        );
        assert_eq!(service.synthesizer.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn preview_uses_the_same_bounded_queue_and_rejects_unknown_explicit_models() {
        let (service, _, state) = service(true);
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        assert_eq!(
            service
                .execute(
                    invocation(),
                    &CoreVoiceCommand::VoicePreview {
                        model: Some("missing-model".into()),
                    },
                )
                .await,
            CoreVoiceOutcome::Preview(CorePreviewOutcome::UnknownModel)
        );
        assert_eq!(service.synthesizer.calls.load(Ordering::Relaxed), 0);

        assert_eq!(
            service
                .execute(
                    invocation(),
                    &CoreVoiceCommand::VoicePreview { model: None },
                )
                .await,
            CoreVoiceOutcome::Preview(CorePreviewOutcome::Queued)
        );
        assert_eq!(service.synthesizer.calls.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn laugh_uses_the_shared_preview_queue_and_same_call_admission() {
        let (service, _, state) = service(true);
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        assert_eq!(
            service
                .execute(invocation(), &CoreVoiceCommand::Laugh)
                .await,
            CoreVoiceOutcome::Laugh(CorePreviewOutcome::Queued)
        );
        assert_eq!(service.synthesizer.calls.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn tts_prepares_then_queues_in_the_effective_priority_lane() {
        let (service, store, state) = service(true);
        store
            .lock()
            .expect("store")
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    priority_role_id: Some(Some("priority".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        let roles = vec!["priority".to_owned()];
        let mut invocation = invocation();
        invocation.member_role_ids = Some(&roles);
        assert_eq!(
            service
                .execute(
                    invocation,
                    &CoreVoiceCommand::Tts {
                        text: "hello".into()
                    },
                )
                .await,
            CoreVoiceOutcome::Tts(CoreTtsOutcome::Queued)
        );
        assert_eq!(
            *service.playback.lanes.lock().expect("lanes"),
            vec![QueueLane::Accessibility]
        );
    }

    #[tokio::test]
    async fn queue_rejection_is_visible_without_claiming_speech_was_queued() {
        let (service, _, state) = service(false);
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        assert_eq!(
            service
                .execute(
                    invocation(),
                    &CoreVoiceCommand::Tts {
                        text: "hello".into()
                    },
                )
                .await,
            CoreVoiceOutcome::Tts(CoreTtsOutcome::Busy)
        );
        assert_eq!(service.synthesizer.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn failed_synthesis_releases_the_previously_reserved_capacity() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        state.remember_bot_user("bot".into());
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        let service = CoreVoiceService::new(
            store,
            state,
            FakeVoiceTransport,
            FakeSynthesizer {
                calls: AtomicUsize::new(0),
                fails: true,
            },
            FakePlayback {
                accepted: true,
                state: CommandPlaybackState::Active,
                ..FakePlayback::default()
            },
            CoreVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
                default_voice: "en_US-amy-medium".into(),
                default_speed: 1.0,
                default_engine: SynthesisEngine::Piper,
            },
            Arc::new(|| 0),
        );
        assert_eq!(
            service
                .execute(
                    invocation(),
                    &CoreVoiceCommand::Tts {
                        text: "hello".into()
                    }
                )
                .await,
            CoreVoiceOutcome::Tts(CoreTtsOutcome::SynthesisFailed)
        );
        assert_eq!(service.playback.reservations.load(Ordering::Relaxed), 0);
        assert_eq!(service.playback.enqueues.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn skip_and_silence_only_run_when_audio_is_active() {
        let (service, _, _) = service(true);
        assert_eq!(
            service.execute(invocation(), &CoreVoiceCommand::Skip).await,
            CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::Completed)
        );
        assert_eq!(
            service
                .execute(invocation(), &CoreVoiceCommand::ShutUp)
                .await,
            CoreVoiceOutcome::Silenced(CorePlaybackControlOutcome::Completed)
        );
        assert_eq!(service.playback.skips.load(Ordering::Relaxed), 1);
        assert_eq!(service.playback.silences.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn idle_playback_does_not_claim_to_have_skipped_any_audio() {
        let (mut service, _, _) = service(true);
        service.playback.state = CommandPlaybackState::Idle;
        assert_eq!(
            service.execute(invocation(), &CoreVoiceCommand::Skip).await,
            CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::NothingPlaying)
        );
        assert_eq!(service.playback.skips.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn skip_cancels_synthesis_before_it_can_enqueue_audio() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        state.remember_bot_user("bot".into());
        state.update_voice_state("guild", "user", Some("voice".into()));
        state.set_bot_voice_channel("guild", Some("voice".into()));
        let started = Arc::new(Notify::new());
        let release = Arc::new(Notify::new());
        let service = Arc::new(CoreVoiceService::new(
            store,
            state,
            FakeVoiceTransport,
            BlockingSynthesizer {
                started: started.clone(),
                release: release.clone(),
            },
            FakePlayback {
                accepted: true,
                state: CommandPlaybackState::Idle,
                ..FakePlayback::default()
            },
            CoreVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
                default_voice: "en_US-amy-medium".into(),
                default_speed: 1.0,
                default_engine: SynthesisEngine::Piper,
            },
            Arc::new(|| 0),
        ));
        let command = CoreVoiceCommand::Tts {
            text: "hello".into(),
        };
        let queued = service.execute(invocation(), &command);
        tokio::pin!(queued);
        let started_signal = started.notified();
        tokio::pin!(started_signal);
        tokio::select! {
            _ = &mut started_signal => {}
            outcome = &mut queued => panic!("synthesis completed before skip: {outcome:?}"),
        }
        assert_eq!(
            service.execute(invocation(), &CoreVoiceCommand::Skip).await,
            CoreVoiceOutcome::Skipped(CorePlaybackControlOutcome::Completed)
        );
        release.notify_one();

        assert_eq!(
            queued.await,
            CoreVoiceOutcome::Tts(CoreTtsOutcome::PlaybackFailed)
        );
        assert_eq!(service.playback.enqueues.load(Ordering::Relaxed), 0);
        assert_eq!(service.playback.reservations.load(Ordering::Relaxed), 0);
    }
}
