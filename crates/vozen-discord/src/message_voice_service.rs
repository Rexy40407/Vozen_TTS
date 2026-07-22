//! Async message-to-voice service for the promoted auto-read path.
//!
//! The Discord gateway supplies already-resolved facts, while this service owns the strict
//! ordering: admission (including same-call) -> clean/redact/rate limit -> reserve -> synthesize
//! -> enqueue. No request reaches Piper when capacity or authorization has already failed.

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use vozen_core::{
    CountGate, DuplicateTracker, MediaAnnouncement, MessageSpeechDecision, MessageSpeechDenial,
    QueueEnqueueOptions, QueueSource, is_repetition_spam,
};
use vozen_store::{
    OperationalMetric, OperationalProvider, ProviderHealth, SqliteStore, UserEngine,
    utc_day_key_from_unix_millis,
};

use crate::{
    CommandSpeechSynthesizer, CommandVoicePlayback, CoreVoiceSettings, DiscordMessageFacts,
    GuildSynthesisCoordinator, MessagePipelineOutcome, MessagePreparationInput,
    MessageSpeechPipeline, admit_discord_message,
};

/// Per-message values which are never persisted. `facts` must come from the same Discord event
/// as `raw`; in particular, role and voice membership are not permitted to be reconstructed from
/// stale database values.
pub struct MessageVoiceInvocation<'a> {
    pub facts: DiscordMessageFacts<'a>,
    pub raw: &'a str,
    pub media: &'a [MediaAnnouncement],
    pub detected_language: Option<&'a str>,
    pub announce_speaker: Option<&'a str>,
    pub resolve_user: &'a dyn Fn(&str) -> String,
    pub resolve_channel: &'a dyn Fn(&str) -> String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageVoiceOutcome {
    Denied(MessageSpeechDenial),
    Empty,
    RateLimited,
    FullyBlocked,
    SpamSuppressed,
    Busy,
    SynthesisFailed,
    PlaybackFailed,
    Queued,
    StoreUnavailable,
}

pub struct MessageVoiceService<S, P> {
    store: Arc<Mutex<SqliteStore>>,
    pipeline: Mutex<MessageSpeechPipeline>,
    duplicate_tracker: Mutex<DuplicateTracker>,
    count_gate: Mutex<CountGate>,
    synthesizer: S,
    playback: P,
    synthesis: GuildSynthesisCoordinator,
    settings: CoreVoiceSettings,
    now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
}

impl<S, P> MessageVoiceService<S, P> {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        synthesizer: S,
        playback: P,
        settings: CoreVoiceSettings,
        now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self::new_with_synthesis_coordinator(
            store,
            synthesizer,
            playback,
            GuildSynthesisCoordinator::default(),
            settings,
            now_ms,
        )
    }

    pub fn new_with_synthesis_coordinator(
        store: Arc<Mutex<SqliteStore>>,
        synthesizer: S,
        playback: P,
        synthesis: GuildSynthesisCoordinator,
        settings: CoreVoiceSettings,
        now_ms: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self {
            store,
            pipeline: Mutex::new(MessageSpeechPipeline::default()),
            duplicate_tracker: Mutex::new(DuplicateTracker::default()),
            count_gate: Mutex::new(CountGate::default()),
            synthesizer,
            playback,
            synthesis,
            settings,
            now_ms,
        }
    }
}

impl<S, P> MessageVoiceService<S, P>
where
    S: CommandSpeechSynthesizer,
    P: CommandVoicePlayback,
{
    pub async fn execute(&self, invocation: MessageVoiceInvocation<'_>) -> MessageVoiceOutcome {
        let now_ms = (self.now_ms)();
        let lane = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return MessageVoiceOutcome::StoreUnavailable,
            };
            match admit_discord_message(&store, invocation.facts) {
                Ok(MessageSpeechDecision::Allowed { lane }) => lane,
                Ok(MessageSpeechDecision::Denied { reason }) => {
                    return MessageVoiceOutcome::Denied(reason);
                }
                Err(_) => return MessageVoiceOutcome::StoreUnavailable,
            }
        };

        let prepared = {
            let store = match self.store.lock() {
                Ok(store) => store,
                Err(_) => return MessageVoiceOutcome::StoreUnavailable,
            };
            let mut pipeline = match self.pipeline.lock() {
                Ok(pipeline) => pipeline,
                Err(_) => return MessageVoiceOutcome::StoreUnavailable,
            };
            pipeline.prepare_after_admission(
                &store,
                lane,
                MessagePreparationInput {
                    guild_id: invocation.facts.guild_id,
                    channel_id: invocation.facts.channel_id,
                    use_channel_profile: true,
                    include_server_pronunciations: true,
                    user_id: invocation.facts.author_id,
                    raw: invocation.raw,
                    max_chars_override: None,
                    available_models: &self.settings.available_models,
                    runtime_default_voice: &self.settings.default_voice,
                    runtime_default_speed: self.settings.default_speed,
                    runtime_default_engine: self.settings.default_engine,
                    detected_language: invocation.detected_language,
                    announce_speaker: invocation.announce_speaker,
                    media: invocation.media,
                    resolve_user: invocation.resolve_user,
                    resolve_channel: invocation.resolve_channel,
                },
                now_ms,
            )
        };

        let (request, cleaned_text, antispam) = match prepared {
            Ok(MessagePipelineOutcome::Ready {
                lane: prepared_lane,
                speech,
                cleaned_text,
                antispam,
            }) if prepared_lane == lane => (speech.request, cleaned_text, antispam),
            // The lane was determined by the same admission above. Treat a discrepancy as a
            // store/process fault rather than accidentally granting a different priority.
            Ok(MessagePipelineOutcome::Ready { .. }) | Ok(MessagePipelineOutcome::Denied(_)) => {
                return MessageVoiceOutcome::StoreUnavailable;
            }
            Ok(MessagePipelineOutcome::Empty) => return MessageVoiceOutcome::Empty,
            Ok(MessagePipelineOutcome::RateLimited) => return MessageVoiceOutcome::RateLimited,
            Ok(MessagePipelineOutcome::FullyBlocked) => return MessageVoiceOutcome::FullyBlocked,
            Err(_) => return MessageVoiceOutcome::StoreUnavailable,
        };

        if antispam
            && self.is_spam(
                invocation.facts.guild_id,
                invocation.facts.author_id,
                &cleaned_text,
                now_ms,
            )
        {
            return MessageVoiceOutcome::SpamSuppressed;
        }

        let admitted_generation = self
            .synthesis
            .admission_generation(invocation.facts.guild_id);
        let mut synthesis = self
            .synthesis
            .acquire(invocation.facts.guild_id, admitted_generation)
            .await;
        if synthesis.was_cleared() {
            return MessageVoiceOutcome::PlaybackFailed;
        }
        synthesis.activate();

        match self.playback.reserve(invocation.facts.guild_id, lane).await {
            Ok(true) => {}
            Ok(false) => {
                self.record_metric(OperationalMetric::QueueDrop);
                return MessageVoiceOutcome::Busy;
            }
            Err(_) => return MessageVoiceOutcome::PlaybackFailed,
        }
        if synthesis.cancelled() {
            let _ = self
                .playback
                .cancel_reservation(invocation.facts.guild_id, lane)
                .await;
            return MessageVoiceOutcome::PlaybackFailed;
        }
        let wav = match self.synthesizer.synthesize(&request).await {
            Ok(wav) => {
                self.record_synthesis_health(true);
                wav
            }
            Err(_) => {
                self.record_synthesis_health(false);
                let _ = self
                    .playback
                    .cancel_reservation(invocation.facts.guild_id, lane)
                    .await;
                return MessageVoiceOutcome::SynthesisFailed;
            }
        };
        if synthesis.cancelled() {
            let _ = self
                .playback
                .cancel_reservation(invocation.facts.guild_id, lane)
                .await;
            return MessageVoiceOutcome::PlaybackFailed;
        }
        match self
            .playback
            .enqueue_reserved(
                invocation.facts.guild_id,
                Path::new(&wav),
                QueueEnqueueOptions {
                    author_id: Some(invocation.facts.author_id),
                    source: QueueSource::Message,
                    lane,
                    created_at_ms: now_ms.max(0) as u64,
                },
            )
            .await
        {
            Ok(()) => {
                if self.should_count(
                    invocation.facts.guild_id,
                    invocation.facts.author_id,
                    &cleaned_text,
                    now_ms,
                ) {
                    self.record_accepted_speech(
                        invocation.facts.guild_id,
                        invocation.facts.author_id,
                        &request.model,
                    );
                }
                MessageVoiceOutcome::Queued
            }
            Err(_) => {
                let _ = self
                    .playback
                    .cancel_reservation(invocation.facts.guild_id, lane)
                    .await;
                MessageVoiceOutcome::PlaybackFailed
            }
        }
    }

    pub fn forget_guild(&self, guild_id: &str) {
        if let Ok(mut pipeline) = self.pipeline.lock() {
            pipeline.forget_guild(guild_id);
        }
        self.synthesis.forget_guild(guild_id);
    }

    /// Writes only fixed, identity-free operational counters. Metric persistence is strictly
    /// best-effort: telemetry can never make an otherwise valid speech request fail.
    fn record_metric(&self, metric: OperationalMetric) {
        let now = (self.now_ms)();
        if let Ok(store) = self.store.lock() {
            let _ = store.add_operational_metric(
                metric,
                OperationalProvider::Piper,
                1.0,
                Some(&utc_day_key_from_unix_millis(now)),
            );
        }
    }

    fn is_spam(&self, guild_id: &str, user_id: &str, cleaned: &str, now_ms: i64) -> bool {
        // Preserve Node ordering: even a repetition-spam message updates the fixed duplicate
        // window, while a suppressed duplicate itself does not renew that window.
        let duplicate = self
            .duplicate_tracker
            .lock()
            .ok()
            .is_some_and(|mut tracker| {
                tracker.is_duplicate_spam(guild_id, user_id, cleaned, now_ms)
            });
        is_repetition_spam(cleaned) || duplicate
    }

    fn should_count(&self, guild_id: &str, user_id: &str, cleaned: &str, now_ms: i64) -> bool {
        self.count_gate
            .lock()
            .ok()
            .is_some_and(|mut gate| gate.should_count(guild_id, user_id, cleaned, now_ms))
    }

    fn record_synthesis_health(&self, success: bool) {
        let now = (self.now_ms)();
        if let Ok(store) = self.store.lock() {
            let _ = store.add_operational_metric(
                if success {
                    OperationalMetric::SynthSuccess
                } else {
                    OperationalMetric::SynthFailure
                },
                OperationalProvider::Piper,
                1.0,
                Some(&utc_day_key_from_unix_millis(now)),
            );
            let _ = store.set_provider_health(
                OperationalProvider::Piper,
                if success {
                    ProviderHealth::Healthy
                } else {
                    ProviderHealth::Degraded
                },
                now,
            );
        }
    }

    /// Mirrors the Node rule: usage changes only after playback accepted the rendered request.
    /// The established `talk_usage` aggregate is best-effort and contains neither message text
    /// nor audio; failure to update the dashboard counter cannot undo valid playback.
    fn record_accepted_speech(&self, guild_id: &str, user_id: &str, model: &str) {
        if let Ok(store) = self.store.lock() {
            let _ = store.bump_talk_usage(guild_id, user_id, model, UserEngine::Piper);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        },
    };

    use async_trait::async_trait;
    use vozen_core::{QueueLane, SynthRequest};
    use vozen_store::{
        DominantTalkUsageOptions, GuildConfigPatch, OperationalMetric, OperationalProvider,
        SqliteStore, TalkUsageSource,
    };

    use super::*;
    use crate::{CommandPlaybackError, CommandPlaybackState, CommandSynthesisError};

    #[derive(Default)]
    struct FakeSynthesizer(AtomicUsize);

    #[async_trait]
    impl CommandSpeechSynthesizer for FakeSynthesizer {
        async fn synthesize(
            &self,
            _request: &SynthRequest,
        ) -> Result<PathBuf, CommandSynthesisError> {
            self.0.fetch_add(1, Ordering::Relaxed);
            Ok(PathBuf::from("voice.wav"))
        }
    }

    struct FakePlayback {
        reserve: bool,
        enqueued: AtomicUsize,
    }

    #[async_trait]
    impl CommandVoicePlayback for FakePlayback {
        async fn state(
            &self,
            _guild_id: &str,
        ) -> Result<CommandPlaybackState, CommandPlaybackError> {
            Ok(CommandPlaybackState::Idle)
        }

        async fn reserve(
            &self,
            _guild_id: &str,
            _lane: QueueLane,
        ) -> Result<bool, CommandPlaybackError> {
            Ok(self.reserve)
        }

        async fn enqueue_reserved(
            &self,
            _guild_id: &str,
            _wav: &Path,
            _options: QueueEnqueueOptions<'_>,
        ) -> Result<(), CommandPlaybackError> {
            self.enqueued.fetch_add(1, Ordering::Relaxed);
            Ok(())
        }

        async fn cancel_reservation(
            &self,
            _guild_id: &str,
            _lane: QueueLane,
        ) -> Result<(), CommandPlaybackError> {
            Ok(())
        }

        async fn skip(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
            Ok(())
        }

        async fn silence(&self, _guild_id: &str) -> Result<(), CommandPlaybackError> {
            Ok(())
        }
    }

    fn settings() -> CoreVoiceSettings {
        CoreVoiceSettings {
            available_models: vec!["en_US-amy-medium".into()],
            default_voice: "en_US-amy-medium".into(),
            default_speed: 1.0,
            default_engine: vozen_core::SynthesisEngine::Piper,
        }
    }

    fn invocation<'a>(author_voice: Option<&'a str>) -> MessageVoiceInvocation<'a> {
        invocation_with_raw(author_voice, "hello")
    }

    fn invocation_with_raw<'a>(
        author_voice: Option<&'a str>,
        raw: &'a str,
    ) -> MessageVoiceInvocation<'a> {
        MessageVoiceInvocation {
            facts: DiscordMessageFacts {
                guild_id: "guild",
                channel_id: "text",
                author_id: "user",
                author_is_bot: false,
                mentioned_bot: false,
                replied_to_bot: false,
                author_voice_channel_id: author_voice,
                bot_voice_channel_id: Some("voice"),
                member_role_ids: Some(&[]),
                autojoined_for_author: false,
            },
            raw,
            media: &[],
            detected_language: None,
            announce_speaker: None,
            resolve_user: &|_| "user".into(),
            resolve_channel: &|_| "channel".into(),
        }
    }

    fn configured_store() -> Arc<Mutex<SqliteStore>> {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    autoread: Some(true),
                    tts_channel_id: Some(Some("text".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        Arc::new(Mutex::new(store))
    }

    #[tokio::test]
    async fn same_call_denial_happens_before_synthesis_or_queue_reservation() {
        let synthesizer = FakeSynthesizer::default();
        let service = MessageVoiceService::new(
            configured_store(),
            synthesizer,
            FakePlayback {
                reserve: true,
                enqueued: AtomicUsize::new(0),
            },
            settings(),
            Arc::new(|| 0),
        );

        assert_eq!(
            service.execute(invocation(Some("other"))).await,
            MessageVoiceOutcome::Denied(MessageSpeechDenial::NotInSameVoice)
        );
        assert_eq!(service.synthesizer.0.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_full_queue_does_not_spend_a_piper_synthesis() {
        let synthesizer = FakeSynthesizer::default();
        let service = MessageVoiceService::new(
            configured_store(),
            synthesizer,
            FakePlayback {
                reserve: false,
                enqueued: AtomicUsize::new(0),
            },
            settings(),
            Arc::new(|| 0),
        );

        assert_eq!(
            service.execute(invocation(Some("voice"))).await,
            MessageVoiceOutcome::Busy
        );
        assert_eq!(service.synthesizer.0.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn queue_and_synthesis_metrics_stay_identity_free_and_best_effort() {
        let store = configured_store();
        let service = MessageVoiceService::new(
            store.clone(),
            FakeSynthesizer::default(),
            FakePlayback {
                reserve: false,
                enqueued: AtomicUsize::new(0),
            },
            settings(),
            Arc::new(|| 0),
        );

        assert_eq!(
            service.execute(invocation(Some("voice"))).await,
            MessageVoiceOutcome::Busy
        );
        assert!(
            store
                .lock()
                .expect("store")
                .list_daily_operational_metrics(Some("1970-01-01"))
                .expect("metrics")
                .iter()
                .any(|row| {
                    row.metric == OperationalMetric::QueueDrop
                        && row.provider == OperationalProvider::Piper
                        && row.value == 1
                })
        );
    }

    #[tokio::test]
    async fn successful_piper_synthesis_records_health_without_message_content() {
        let store = configured_store();
        let service = MessageVoiceService::new(
            store.clone(),
            FakeSynthesizer::default(),
            FakePlayback {
                reserve: true,
                enqueued: AtomicUsize::new(0),
            },
            settings(),
            Arc::new(|| 0),
        );

        assert_eq!(
            service.execute(invocation(Some("voice"))).await,
            MessageVoiceOutcome::Queued
        );
        let store = store.lock().expect("store");
        assert!(
            store
                .list_daily_operational_metrics(Some("1970-01-01"))
                .expect("metrics")
                .iter()
                .any(|row| {
                    row.metric == OperationalMetric::SynthSuccess
                        && row.provider == OperationalProvider::Piper
                        && row.value == 1
                })
        );
        assert!(
            store
                .list_provider_health()
                .expect("health")
                .iter()
                .any(|row| row.provider == OperationalProvider::Piper
                    && row.health == ProviderHealth::Healthy)
        );
        let usage = store
            .dominant_talk_usage(&["user".into()], DominantTalkUsageOptions::default())
            .expect("usage");
        assert_eq!(
            usage.get("user"),
            Some(&vozen_store::DominantTalkUsage {
                language: Some("en_US".into()),
                engine: Some(UserEngine::Piper),
                samples: 1,
                source: TalkUsageSource::Measured,
            })
        );
    }

    #[tokio::test]
    async fn opt_in_antispam_suppresses_repetition_before_synthesis() {
        let store = configured_store();
        store
            .lock()
            .expect("store")
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    antispam: Some(true),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("antispam");
        let synthesizer = FakeSynthesizer::default();
        let service = MessageVoiceService::new(
            store,
            synthesizer,
            FakePlayback {
                reserve: true,
                enqueued: AtomicUsize::new(0),
            },
            settings(),
            Arc::new(|| 0),
        );

        assert_eq!(
            service
                .execute(invocation_with_raw(
                    Some("voice"),
                    "poke poke poke poke poke poke poke poke poke poke"
                ))
                .await,
            MessageVoiceOutcome::SpamSuppressed
        );
        assert_eq!(service.synthesizer.0.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn count_gate_keeps_repeated_queue_entries_out_of_usage_aggregates() {
        let store = configured_store();
        let service = MessageVoiceService::new(
            store.clone(),
            FakeSynthesizer::default(),
            FakePlayback {
                reserve: true,
                enqueued: AtomicUsize::new(0),
            },
            settings(),
            Arc::new(|| 0),
        );

        assert_eq!(
            service.execute(invocation(Some("voice"))).await,
            MessageVoiceOutcome::Queued
        );
        assert_eq!(
            service.execute(invocation(Some("voice"))).await,
            MessageVoiceOutcome::Queued
        );
        let usage = store
            .lock()
            .expect("store")
            .dominant_talk_usage(&["user".into()], DominantTalkUsageOptions::default())
            .expect("usage");
        assert_eq!(usage.get("user").map(|usage| usage.samples), Some(1));
    }
}
