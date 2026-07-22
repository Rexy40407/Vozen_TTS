//! Async message-to-voice service for the promoted auto-read path.
//!
//! The Discord gateway supplies already-resolved facts, while this service owns the strict
//! ordering: admission (including same-call) -> clean/redact/rate limit -> reserve -> synthesize
//! -> enqueue. No request reaches Piper when capacity or authorization has already failed.

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use vozen_core::{MediaAnnouncement, MessageSpeechDecision, MessageSpeechDenial};
use vozen_store::SqliteStore;

use crate::{
    CommandSpeechSynthesizer, CommandVoicePlayback, CoreVoiceSettings, DiscordMessageFacts,
    MessagePipelineOutcome, MessagePreparationInput, MessageSpeechPipeline, admit_discord_message,
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
    Busy,
    SynthesisFailed,
    PlaybackFailed,
    Queued,
    StoreUnavailable,
}

pub struct MessageVoiceService<S, P> {
    store: Arc<Mutex<SqliteStore>>,
    pipeline: Mutex<MessageSpeechPipeline>,
    synthesizer: S,
    playback: P,
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
        Self {
            store,
            pipeline: Mutex::new(MessageSpeechPipeline::default()),
            synthesizer,
            playback,
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
                    user_id: invocation.facts.author_id,
                    raw: invocation.raw,
                    available_models: &self.settings.available_models,
                    runtime_default_voice: &self.settings.default_voice,
                    runtime_default_speed: self.settings.default_speed,
                    detected_language: invocation.detected_language,
                    announce_speaker: invocation.announce_speaker,
                    media: invocation.media,
                    resolve_user: invocation.resolve_user,
                    resolve_channel: invocation.resolve_channel,
                },
                (self.now_ms)(),
            )
        };

        let request = match prepared {
            Ok(MessagePipelineOutcome::Ready {
                lane: prepared_lane,
                speech,
            }) if prepared_lane == lane => speech.request,
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

        match self.playback.reserve(invocation.facts.guild_id, lane).await {
            Ok(true) => {}
            Ok(false) => return MessageVoiceOutcome::Busy,
            Err(_) => return MessageVoiceOutcome::PlaybackFailed,
        }
        let wav = match self.synthesizer.synthesize(&request).await {
            Ok(wav) => wav,
            Err(_) => {
                let _ = self
                    .playback
                    .cancel_reservation(invocation.facts.guild_id, lane)
                    .await;
                return MessageVoiceOutcome::SynthesisFailed;
            }
        };
        match self
            .playback
            .enqueue_reserved(invocation.facts.guild_id, Path::new(&wav), lane)
            .await
        {
            Ok(()) => MessageVoiceOutcome::Queued,
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
    use vozen_store::{GuildConfigPatch, SqliteStore};

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
            _lane: QueueLane,
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
        }
    }

    fn invocation<'a>(author_voice: Option<&'a str>) -> MessageVoiceInvocation<'a> {
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
            raw: "hello",
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
}
