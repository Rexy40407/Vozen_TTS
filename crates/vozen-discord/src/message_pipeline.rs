//! The ordered message-to-speech admission boundary.
//!
//! Discord event code supplies only resolved facts. This module preserves the order of the
//! existing message handler: contextual policy -> readable-content check -> per-user rate limit
//! -> stored preferences/blocklist -> queue/playback. The last queue/playback step remains an
//! explicit later adapter, so an unsuccessful or full queue never accidentally counts as usage.

use vozen_core::{
    GuildRateLimiters, MessageSpeechDecision, MessageSpeechDenial, MessageSpeechInput, QueueLane,
    admit_message_speech,
};
use vozen_store::{SqliteStore, StoreError};

use crate::{
    MessagePreparationInput, MessagePreparationOutcome, PreparedMessageSpeech,
    begin_message_speech, finish_message_speech,
};

#[derive(Debug, Clone, PartialEq)]
pub enum MessagePipelineOutcome {
    Denied(MessageSpeechDenial),
    Empty,
    RateLimited,
    FullyBlocked,
    Ready {
        lane: QueueLane,
        speech: PreparedMessageSpeech,
        cleaned_text: String,
        antispam: bool,
    },
}

#[derive(Debug, Default)]
pub struct MessageSpeechPipeline {
    rate_limiters: GuildRateLimiters,
}

impl MessageSpeechPipeline {
    /// Applies every admission step up to the point where a private request is ready to enqueue.
    /// `now_ms` is passed by the gateway so tests and production share the exact clock boundary.
    pub fn prepare(
        &mut self,
        store: &SqliteStore,
        admission: MessageSpeechInput<'_>,
        input: MessagePreparationInput<'_>,
        now_ms: i64,
    ) -> Result<MessagePipelineOutcome, StoreError> {
        let lane = match admit_message_speech(admission) {
            MessageSpeechDecision::Allowed { lane } => lane,
            MessageSpeechDecision::Denied { reason } => {
                return Ok(MessagePipelineOutcome::Denied(reason));
            }
        };
        self.prepare_after_admission(store, lane, input, now_ms)
    }

    /// Continues an admission already resolved from the current Discord message/cache facts.
    /// Keeping the rate limiter here preserves its process-local scope while allowing a gateway
    /// adapter to call [`crate::admit_discord_message`] exactly once.
    pub fn prepare_after_admission(
        &mut self,
        store: &SqliteStore,
        lane: QueueLane,
        input: MessagePreparationInput<'_>,
        now_ms: i64,
    ) -> Result<MessagePipelineOutcome, StoreError> {
        let draft = match begin_message_speech(store, &input)? {
            Ok(draft) => draft,
            Err(MessagePreparationOutcome::Empty) => return Ok(MessagePipelineOutcome::Empty),
            Err(_) => unreachable!("only the initial cleaner can reject as empty"),
        };
        let cleaned_text = draft.cleaned_text().to_owned();
        let antispam = draft.antispam();
        if !self
            .rate_limiters
            .allow(input.guild_id, input.user_id, draft.rate_per_min(), now_ms)
        {
            return Ok(MessagePipelineOutcome::RateLimited);
        }
        match finish_message_speech(store, input, draft)? {
            MessagePreparationOutcome::Ready(speech) => Ok(MessagePipelineOutcome::Ready {
                lane,
                speech,
                cleaned_text,
                antispam,
            }),
            MessagePreparationOutcome::Empty => unreachable!("a checked draft cannot become empty"),
            MessagePreparationOutcome::FullyBlocked => Ok(MessagePipelineOutcome::FullyBlocked),
        }
    }

    /// Called on a real guild departure to release all in-memory user buckets for that guild.
    pub fn forget_guild(&mut self, guild_id: &str) {
        self.rate_limiters.forget_guild(guild_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vozen_core::{MediaAnnouncement, RolePolicy};
    use vozen_store::{GuildConfigPatch, SqliteStore};

    fn admission() -> MessageSpeechInput<'static> {
        MessageSpeechInput {
            enabled: true,
            author_is_bot: false,
            read_bots: false,
            auto_read: true,
            mentioned_bot: false,
            replied_to_bot: false,
            text_in_voice: false,
            opted_out: false,
            required_tts_role_id: None,
            profile_voice_channel_id: None,
            author_voice_channel_id: Some("voice"),
            bot_voice_channel_id: Some("voice"),
            autojoined_for_author: false,
            member_role_ids: Some(&[]),
            queue_role_policy: RolePolicy::default(),
        }
    }

    fn input<'a>(raw: &'a str, models: &'a [String]) -> MessagePreparationInput<'a> {
        MessagePreparationInput {
            guild_id: "guild",
            channel_id: "channel",
            use_channel_profile: true,
            include_server_pronunciations: true,
            user_id: "user",
            raw,
            max_chars_override: None,
            available_models: models,
            runtime_default_voice: "en_US-amy-medium",
            runtime_default_speed: 1.0,
            detected_language: None,
            announce_speaker: None,
            media: &[] as &[MediaAnnouncement],
            resolve_user: &|_| "user".into(),
            resolve_channel: &|_| "channel".into(),
        }
    }

    #[test]
    fn same_call_denial_happens_before_content_or_rate_limit_work() {
        let store = SqliteStore::open_in_memory().expect("store");
        let mut pipeline = MessageSpeechPipeline::default();
        let models = vec!["en_US-amy-medium".into()];
        let mut denied = admission();
        denied.author_voice_channel_id = Some("other");
        assert_eq!(
            pipeline
                .prepare(&store, denied, input("hello", &models), 0)
                .expect("decision"),
            MessagePipelineOutcome::Denied(MessageSpeechDenial::NotInSameVoice)
        );
        assert!(matches!(
            pipeline
                .prepare(&store, admission(), input("hello", &models), 0)
                .expect("allowed"),
            MessagePipelineOutcome::Ready { .. }
        ));
    }

    #[test]
    fn empty_messages_do_not_consume_a_token_but_fully_blocked_ones_match_node_ordering() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    rate_per_min: Some(1),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        store.add_blockword("guild", "secret").expect("block");
        let mut pipeline = MessageSpeechPipeline::default();
        let models = vec!["en_US-amy-medium".into()];
        assert_eq!(
            pipeline
                .prepare(&store, admission(), input("😀", &models), 0)
                .expect("empty"),
            MessagePipelineOutcome::Empty
        );
        assert_eq!(
            pipeline
                .prepare(&store, admission(), input("secret", &models), 0)
                .expect("blocked"),
            MessagePipelineOutcome::FullyBlocked
        );
        assert_eq!(
            pipeline
                .prepare(&store, admission(), input("hello", &models), 0)
                .expect("limited"),
            MessagePipelineOutcome::RateLimited
        );
    }
}
