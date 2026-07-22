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
use vozen_core::{QueueLane, SynthRequest};
use vozen_store::SqliteStore;

use crate::{
    CommandSpeechInput, CommandSpeechOutcome, CommandSpeechPipeline, CoreVoiceCommand,
    GatewayState, JoinVoiceOutcome, LeaveVoiceOutcome, VoiceSessionService, VoiceSessionTransport,
};

#[derive(Debug, Error)]
#[error("speech synthesis failed")]
pub struct CommandSynthesisError;

#[derive(Debug, Error)]
#[error("voice playback failed")]
pub struct CommandPlaybackError;

/// Synthesizes an already-authorized private request. Implementations must never log the request
/// text or use it as a shell argument.
#[async_trait]
pub trait CommandSpeechSynthesizer: Send + Sync {
    async fn synthesize(
        &self,
        request: &SynthRequest,
    ) -> Result<std::path::PathBuf, CommandSynthesisError>;
}

/// Accepts an immutable WAV in the guild's existing FIFO. `Ok(false)` means capacity rejected
/// the request and no later accounting may treat it as spoken.
#[async_trait]
pub trait CommandVoicePlayback: Send + Sync {
    async fn enqueue(
        &self,
        guild_id: &str,
        wav: &Path,
        lane: QueueLane,
    ) -> Result<bool, CommandPlaybackError>;
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
pub enum CoreVoiceOutcome {
    Joined(JoinVoiceOutcome),
    Left(LeaveVoiceOutcome),
    Tts(CoreTtsOutcome),
    /// A contract-valid but not-yet-promoted command must remain with the Node runtime.
    NotPromoted,
}

/// Operational configuration selected at Rust process startup. These values are trusted
/// environment/config values, never supplied by Discord users.
#[derive(Debug, Clone)]
pub struct CoreVoiceSettings {
    pub available_models: Vec<String>,
    pub default_voice: String,
    pub default_speed: f64,
}

pub struct CoreVoiceService<T, S, P> {
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    sessions: VoiceSessionService<T>,
    speech: Mutex<CommandSpeechPipeline>,
    synthesizer: S,
    playback: P,
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
        let sessions = VoiceSessionService::new(store.clone(), gateway_state.clone(), transport);
        Self {
            store,
            gateway_state,
            sessions,
            speech: Mutex::new(CommandSpeechPipeline::default()),
            synthesizer,
            playback,
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
            CoreVoiceCommand::Tts { text } => {
                CoreVoiceOutcome::Tts(self.execute_tts(invocation, text).await)
            }
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
        let wav = match self.synthesizer.synthesize(&request).await {
            Ok(wav) => wav,
            Err(_) => return CoreTtsOutcome::SynthesisFailed,
        };
        match self.playback.enqueue(invocation.guild_id, &wav, lane).await {
            Ok(true) => CoreTtsOutcome::Queued,
            Ok(false) => CoreTtsOutcome::Busy,
            Err(_) => CoreTtsOutcome::PlaybackFailed,
        }
    }

    /// Releases process-local user buckets on a real guild departure.
    pub fn forget_guild(&self, guild_id: &str) {
        if let Ok(mut speech) = self.speech.lock() {
            speech.forget_guild(guild_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        sync::{
            Mutex,
            atomic::{AtomicUsize, Ordering},
        },
    };

    use async_trait::async_trait;
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
    }

    #[async_trait]
    impl CommandSpeechSynthesizer for FakeSynthesizer {
        async fn synthesize(
            &self,
            _request: &SynthRequest,
        ) -> Result<PathBuf, CommandSynthesisError> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            Ok(PathBuf::from("voice.wav"))
        }
    }

    #[derive(Default)]
    struct FakePlayback {
        lanes: Mutex<Vec<QueueLane>>,
        accepted: bool,
    }

    #[async_trait]
    impl CommandVoicePlayback for FakePlayback {
        async fn enqueue(
            &self,
            _guild_id: &str,
            _wav: &Path,
            lane: QueueLane,
        ) -> Result<bool, CommandPlaybackError> {
            self.lanes.lock().expect("lanes").push(lane);
            Ok(self.accepted)
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
                ..FakePlayback::default()
            },
            CoreVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
                default_voice: "en_US-amy-medium".into(),
                default_speed: 1.0,
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
    }
}
