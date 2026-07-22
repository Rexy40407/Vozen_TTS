//! Preparation boundary for member-initiated speech commands.
//!
//! `/tts` and the message context action are intentionally stricter than passive auto-read:
//! their caller must currently be in the bot's voice channel, and they never inherit a
//! per-channel auto-read profile. The ordering matches the Node handler: blank slash-command
//! input is rejected before any work; contextual admission comes before the token bucket; then
//! cleaning, preferences and the blocklist prepare a private request for playback.

use vozen_core::{
    GuildRateLimiters, QueueLane, RolePolicy, UserSpeechAdmission, UserSpeechDenial,
    admit_user_speech,
};
use vozen_store::{SqliteStore, StoreError};

use crate::{
    MessagePreparationInput, MessagePreparationOutcome, PreparedMessageSpeech,
    prepare_message_speech,
};

/// Resolved Discord facts and ephemeral request data for `/tts` or the Speak context action.
/// The gateway must derive voice and role facts from its live cache; no caller-controlled ID is
/// trusted here as membership evidence.
pub struct CommandSpeechInput<'a> {
    pub guild_id: &'a str,
    pub channel_id: &'a str,
    pub user_id: &'a str,
    pub raw: &'a str,
    pub caller_voice_channel_id: Option<&'a str>,
    pub bot_voice_channel_id: Option<&'a str>,
    pub member_role_ids: Option<&'a [&'a str]>,
    pub available_models: &'a [String],
    pub runtime_default_voice: &'a str,
    pub runtime_default_speed: f64,
    /// Must be absent unless the caller already checked the user's detection opt-in.
    pub detected_language: Option<&'a str>,
    pub resolve_user: &'a dyn Fn(&str) -> String,
    pub resolve_channel: &'a dyn Fn(&str) -> String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CommandSpeechOutcome {
    NotInSameVoice,
    Blocked,
    Empty,
    RateLimited,
    FullyBlocked,
    Ready {
        lane: QueueLane,
        speech: PreparedMessageSpeech,
    },
}

#[derive(Debug, Default)]
pub struct CommandSpeechPipeline {
    rate_limiters: GuildRateLimiters,
}

impl CommandSpeechPipeline {
    /// Prepares an authorized command for a later voice-playback adapter.
    ///
    /// This does not synthesize or enqueue audio, so a future transport failure cannot be
    /// mistaken for a command that was spoken. The bucket is deliberately spent before
    /// cleaning/blocklist handling for non-blank input, preserving `speakRawText` behaviour.
    pub fn prepare(
        &mut self,
        store: &SqliteStore,
        input: CommandSpeechInput<'_>,
        now_ms: i64,
    ) -> Result<CommandSpeechOutcome, StoreError> {
        if input.raw.trim().is_empty() {
            return Ok(CommandSpeechOutcome::Empty);
        }

        let config = store.guild_config(input.guild_id)?;
        let policy = RolePolicy {
            priority_role_id: config.priority_role_id.as_deref(),
            blocked_role_id: config.blocked_role_id.as_deref(),
        };
        let lane = match admit_user_speech(
            input.caller_voice_channel_id,
            input.bot_voice_channel_id,
            input.member_role_ids,
            policy,
        ) {
            UserSpeechAdmission::Allowed { lane } => lane,
            UserSpeechAdmission::Denied {
                reason: UserSpeechDenial::NotInSameVoice,
            } => return Ok(CommandSpeechOutcome::NotInSameVoice),
            UserSpeechAdmission::Denied {
                reason: UserSpeechDenial::Blocked,
            } => return Ok(CommandSpeechOutcome::Blocked),
        };

        if !self
            .rate_limiters
            .allow(input.guild_id, input.user_id, config.rate_per_min, now_ms)
        {
            return Ok(CommandSpeechOutcome::RateLimited);
        }

        match prepare_message_speech(
            store,
            MessagePreparationInput {
                guild_id: input.guild_id,
                channel_id: input.channel_id,
                // `/tts` must use the guild default, never an auto-read channel profile.
                use_channel_profile: false,
                user_id: input.user_id,
                raw: input.raw,
                available_models: input.available_models,
                runtime_default_voice: input.runtime_default_voice,
                runtime_default_speed: input.runtime_default_speed,
                detected_language: input.detected_language,
                announce_speaker: None,
                media: &[],
                resolve_user: input.resolve_user,
                resolve_channel: input.resolve_channel,
            },
        )? {
            MessagePreparationOutcome::Ready(speech) => {
                Ok(CommandSpeechOutcome::Ready { lane, speech })
            }
            MessagePreparationOutcome::Empty => Ok(CommandSpeechOutcome::Empty),
            MessagePreparationOutcome::FullyBlocked => Ok(CommandSpeechOutcome::FullyBlocked),
        }
    }

    /// Called when the bot leaves a guild, matching the lifetime of Node's guild limiter map.
    pub fn forget_guild(&mut self, guild_id: &str) {
        self.rate_limiters.forget_guild(guild_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vozen_store::{ChannelProfilePatch, GuildConfigPatch};

    fn models() -> Vec<String> {
        vec!["en_US-amy-medium".into(), "pt_PT-tugao-medium".into()]
    }

    fn input<'a>(raw: &'a str, models: &'a [String]) -> CommandSpeechInput<'a> {
        CommandSpeechInput {
            guild_id: "guild",
            channel_id: "channel",
            user_id: "user",
            raw,
            caller_voice_channel_id: Some("voice"),
            bot_voice_channel_id: Some("voice"),
            member_role_ids: None,
            available_models: models,
            runtime_default_voice: "en_US-amy-medium",
            runtime_default_speed: 1.0,
            detected_language: None,
            resolve_user: &|id| format!("user-{id}"),
            resolve_channel: &|id| format!("channel-{id}"),
        }
    }

    #[test]
    fn same_call_denial_happens_before_spending_a_rate_limit_token() {
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
        let available = models();
        let mut pipeline = CommandSpeechPipeline::default();
        let mut denied = input("hello", &available);
        denied.caller_voice_channel_id = Some("other-voice");
        assert_eq!(
            pipeline.prepare(&store, denied, 0).expect("decision"),
            CommandSpeechOutcome::NotInSameVoice
        );
        assert!(matches!(
            pipeline
                .prepare(&store, input("hello", &available), 0)
                .expect("allowed"),
            CommandSpeechOutcome::Ready { .. }
        ));
    }

    #[test]
    fn non_blank_text_that_cleans_to_empty_still_matches_node_rate_ordering() {
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
        let available = models();
        let mut pipeline = CommandSpeechPipeline::default();
        assert_eq!(
            pipeline
                .prepare(&store, input("😀", &available), 0)
                .expect("empty"),
            CommandSpeechOutcome::Empty
        );
        assert_eq!(
            pipeline
                .prepare(&store, input("hello", &available), 0)
                .expect("limited"),
            CommandSpeechOutcome::RateLimited
        );
    }

    #[test]
    fn explicit_commands_do_not_inherit_channel_auto_read_voice() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    default_voice: Some("en_US-amy-medium".into()),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        store
            .save_channel_profile(
                "guild",
                "channel",
                &ChannelProfilePatch {
                    default_voice: Some("pt_PT-tugao-medium".into()),
                    ..ChannelProfilePatch::default()
                },
            )
            .expect("profile");
        let available = models();
        let mut pipeline = CommandSpeechPipeline::default();
        let CommandSpeechOutcome::Ready { speech, .. } = pipeline
            .prepare(&store, input("hello", &available), 0)
            .expect("prepared")
        else {
            panic!("speech should be prepared");
        };
        assert_eq!(speech.request.model, "en_US-amy-medium");
    }
}
