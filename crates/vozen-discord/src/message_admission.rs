//! Translation from Discord-resolved message facts to the pure speech policy.
//!
//! The Serenity event handler must resolve cache state and permission-sensitive facts first.
//! This adapter then reads only the durable configuration required for a decision; it does not
//! synthesize, enqueue, log, or retain message text.

use vozen_core::{MessageSpeechDecision, MessageSpeechInput, RolePolicy, admit_message_speech};
use vozen_store::{SqliteStore, StoreError};

/// Facts obtained from a single Discord message and the current gateway cache.
#[derive(Clone, Copy)]
pub struct DiscordMessageFacts<'a> {
    pub guild_id: &'a str,
    pub channel_id: &'a str,
    pub author_id: &'a str,
    pub author_is_bot: bool,
    pub mentioned_bot: bool,
    pub replied_to_bot: bool,
    pub author_voice_channel_id: Option<&'a str>,
    pub bot_voice_channel_id: Option<&'a str>,
    /// `None` means the cache could not resolve membership. Role-gated configurations must then
    /// fail closed through `admit_message_speech`.
    pub member_role_ids: Option<&'a [String]>,
    /// Set only for the exact author message which successfully created an autojoin session.
    pub autojoined_for_author: bool,
}

/// Builds the effective auto-read/read-bots/profile values with the same inheritance rules as
/// Node's `resolveChannelPolicy`, then delegates every security decision to `vozen-core`.
pub fn admit_discord_message(
    store: &SqliteStore,
    facts: DiscordMessageFacts<'_>,
) -> Result<MessageSpeechDecision, StoreError> {
    let config = store.guild_config(facts.guild_id)?;
    let profile = store.channel_profile(facts.guild_id, facts.channel_id)?;
    let auto_read = profile
        .as_ref()
        .and_then(|profile| profile.auto_read)
        .unwrap_or_else(|| {
            profile.is_none()
                && config.autoread
                && config.tts_channel_id.as_deref() == Some(facts.channel_id)
        });
    let read_bots = profile
        .as_ref()
        .and_then(|profile| profile.read_bots)
        .unwrap_or(config.read_bots);
    let role_ids = facts
        .member_role_ids
        .map(|roles| roles.iter().map(String::as_str).collect::<Vec<_>>());

    Ok(admit_message_speech(MessageSpeechInput {
        enabled: config.enabled,
        author_is_bot: facts.author_is_bot,
        read_bots,
        auto_read,
        mentioned_bot: facts.mentioned_bot,
        replied_to_bot: facts.replied_to_bot,
        text_in_voice: config.text_in_voice && facts.bot_voice_channel_id == Some(facts.channel_id),
        opted_out: store.is_opted_out(facts.guild_id, facts.author_id)?,
        required_tts_role_id: config.tts_role_id.as_deref(),
        profile_voice_channel_id: profile
            .as_ref()
            .and_then(|profile| profile.voice_channel_id.as_deref()),
        author_voice_channel_id: facts.author_voice_channel_id,
        bot_voice_channel_id: facts.bot_voice_channel_id,
        autojoined_for_author: facts.autojoined_for_author,
        member_role_ids: role_ids.as_deref(),
        queue_role_policy: RolePolicy {
            priority_role_id: config.priority_role_id.as_deref(),
            blocked_role_id: config.blocked_role_id.as_deref(),
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use vozen_core::{MessageSpeechDenial, QueueLane};
    use vozen_store::{ChannelProfilePatch, GuildConfigPatch};

    fn facts() -> DiscordMessageFacts<'static> {
        DiscordMessageFacts {
            guild_id: "guild",
            channel_id: "text",
            author_id: "user",
            author_is_bot: false,
            mentioned_bot: false,
            replied_to_bot: false,
            author_voice_channel_id: Some("voice"),
            bot_voice_channel_id: Some("voice"),
            member_role_ids: Some(&[]),
            autojoined_for_author: false,
        }
    }

    #[test]
    fn inherited_autoread_requires_the_configured_text_channel() {
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
        assert_eq!(
            admit_discord_message(&store, facts()).expect("admission"),
            MessageSpeechDecision::Allowed {
                lane: QueueLane::Standard
            }
        );
        let mut other = facts();
        other.channel_id = "other";
        assert_eq!(
            admit_discord_message(&store, other).expect("other"),
            MessageSpeechDecision::Denied {
                reason: MessageSpeechDenial::NotTriggered
            }
        );
    }

    #[test]
    fn channel_profile_can_narrow_trigger_but_never_same_call_access() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .save_channel_profile(
                "guild",
                "text",
                &ChannelProfilePatch {
                    auto_read: Some(true),
                    voice_channel_id: Some("bound".into()),
                    ..ChannelProfilePatch::default()
                },
            )
            .expect("profile");
        assert_eq!(
            admit_discord_message(&store, facts()).expect("admission"),
            MessageSpeechDecision::Denied {
                reason: MessageSpeechDenial::BoundVoiceMismatch
            }
        );
    }

    #[test]
    fn missing_member_cache_fails_closed_when_a_role_is_required() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    autoread: Some(true),
                    tts_channel_id: Some(Some("text".into())),
                    tts_role_id: Some(Some("reader".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        let mut missing = facts();
        missing.member_role_ids = None;
        assert_eq!(
            admit_discord_message(&store, missing).expect("admission"),
            MessageSpeechDecision::Denied {
                reason: MessageSpeechDenial::RequiredRoleMissing
            }
        );
    }
}
