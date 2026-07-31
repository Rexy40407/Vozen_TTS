//! Translation from Discord-resolved message facts to the pure speech policy.
//!
//! The Serenity event handler must resolve cache state and permission-sensitive facts first.
//! This adapter then reads only the durable configuration required for a decision; it does not
//! synthesize, enqueue, log, or retain message text.

use vozen_core::{MessageSpeechDecision, MessageSpeechInput, RolePolicy, admit_message_speech};
use vozen_store::{ChannelProfile, GuildConfig, SqliteStore, StoreError};

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

/// Durable values needed for a message admission decision.  Keeping this data separate from
/// [`SqliteStore`] lets the voice runtime use a short-lived in-memory cache without weakening
/// any of the Discord-derived permission checks in [`DiscordMessageFacts`].
#[derive(Debug, Clone)]
pub(crate) struct MessageAdmissionData {
    pub guild: GuildConfig,
    pub profile: Option<ChannelProfile>,
    pub opted_out: bool,
}

/// Builds the effective auto-read/read-bots/profile values with the same inheritance rules as
/// Node's `resolveChannelPolicy`, then delegates every security decision to `vozen-core`.
pub fn admit_discord_message(
    store: &SqliteStore,
    facts: DiscordMessageFacts<'_>,
) -> Result<MessageSpeechDecision, StoreError> {
    let data = MessageAdmissionData {
        guild: store.guild_config(facts.guild_id)?,
        profile: store.channel_profile(facts.guild_id, facts.channel_id)?,
        opted_out: store.is_opted_out(facts.guild_id, facts.author_id)?,
    };
    Ok(admit_discord_message_with_data(&data, facts))
}

/// Cache-friendly variant of [`admit_discord_message`].  It is deliberately pure: cache entries
/// contain only durable settings, while live Discord role and call state still comes from the
/// current event.
pub(crate) fn admit_discord_message_with_data(
    data: &MessageAdmissionData,
    facts: DiscordMessageFacts<'_>,
) -> MessageSpeechDecision {
    let config = &data.guild;
    let profile = &data.profile;
    let auto_read = effective_auto_read(config, profile.as_ref(), facts.channel_id);
    let read_bots = profile
        .as_ref()
        .and_then(|profile| profile.read_bots)
        .unwrap_or(config.read_bots);
    let role_ids = facts
        .member_role_ids
        .map(|roles| roles.iter().map(String::as_str).collect::<Vec<_>>());

    admit_message_speech(MessageSpeechInput {
        enabled: config.enabled,
        author_is_bot: facts.author_is_bot,
        read_bots,
        auto_read,
        mentioned_bot: facts.mentioned_bot,
        replied_to_bot: facts.replied_to_bot,
        text_in_voice: config.text_in_voice && facts.bot_voice_channel_id == Some(facts.channel_id),
        opted_out: data.opted_out,
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
    })
}

/// Decides whether the gateway may attempt auto-join before the normal admission pass. This
/// checks the guild switch, bot-reading, configured TTS-channel trigger, channel binding, required
/// role and passive opt-out before the transport is touched.
///
/// The transport and permission check remain in the runtime adapter. Returning `true` only says
/// that joining the author's current voice channel is worth attempting; it never grants speech
/// or bypasses the final same-call admission.
pub fn should_attempt_autojoin(
    store: &SqliteStore,
    facts: DiscordMessageFacts<'_>,
) -> Result<bool, StoreError> {
    let config = store.guild_config(facts.guild_id)?;
    if !config.enabled || !config.autojoin || facts.bot_voice_channel_id.is_some() {
        return Ok(false);
    }
    if facts.author_voice_channel_id.is_none() || (facts.author_is_bot && !config.read_bots) {
        return Ok(false);
    }
    let profile = store.channel_profile(facts.guild_id, facts.channel_id)?;
    let auto_read = effective_auto_read(&config, profile.as_ref(), facts.channel_id);
    let read_bots = profile
        .as_ref()
        .and_then(|profile| profile.read_bots)
        .unwrap_or(config.read_bots);
    if facts.author_is_bot && !read_bots {
        return Ok(false);
    }

    let explicitly_requested = facts.mentioned_bot || facts.replied_to_bot;
    let passive_trigger =
        auto_read || (config.text_in_voice && facts.bot_voice_channel_id == Some(facts.channel_id));
    if !explicitly_requested && !passive_trigger {
        return Ok(false);
    }
    if let Some(bound_voice) = profile
        .as_ref()
        .and_then(|profile| profile.voice_channel_id.as_deref())
        && !facts.author_is_bot
        && facts.author_voice_channel_id != Some(bound_voice)
    {
        return Ok(false);
    }
    if let Some(required_role) = config.tts_role_id.as_deref() {
        let has_role = facts
            .member_role_ids
            .is_some_and(|roles| roles.iter().any(|role| role == required_role));
        if !has_role {
            return Ok(false);
        }
    }
    if store.is_opted_out(facts.guild_id, facts.author_id)?
        && passive_trigger
        && !explicitly_requested
    {
        return Ok(false);
    }
    Ok(true)
}

/// Resolves the passive text-channel trigger. Auto-join is intentionally a trigger in the
/// configured TTS channel as well: `/config auto-join` promises to join when someone types there,
/// even when the older standalone `autoread` toggle is off. An explicit channel override still
/// wins, including `auto_read = false`.
fn effective_auto_read(
    config: &GuildConfig,
    profile: Option<&ChannelProfile>,
    channel_id: &str,
) -> bool {
    profile
        .and_then(|profile| profile.auto_read)
        .unwrap_or_else(|| {
            profile.is_none()
                && config.tts_channel_id.as_deref() == Some(channel_id)
                && (config.autoread || config.autojoin)
        })
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
    fn autojoin_requires_a_real_trigger_and_enabled_setting() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(!should_attempt_autojoin(&store, facts()).expect("decision"));
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    autojoin: Some(true),
                    autoread: Some(true),
                    tts_channel_id: Some(Some("text".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        let mut candidate = facts();
        candidate.bot_voice_channel_id = None;
        assert!(should_attempt_autojoin(&store, candidate).expect("decision"));
        let mut other = candidate;
        other.channel_id = "other";
        assert!(!should_attempt_autojoin(&store, other).expect("decision"));
    }

    #[test]
    fn autojoin_makes_the_configured_tts_channel_a_trigger_without_autoread() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    autojoin: Some(true),
                    autoread: Some(false),
                    tts_channel_id: Some(Some("text".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        let mut candidate = facts();
        candidate.bot_voice_channel_id = None;
        assert!(should_attempt_autojoin(&store, candidate).expect("decision"));
        candidate.autojoined_for_author = true;
        assert!(matches!(
            admit_discord_message(&store, candidate).expect("admission"),
            MessageSpeechDecision::Allowed { .. }
        ));
    }

    #[test]
    fn autojoin_respects_role_and_passive_opt_out_before_transport() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    autojoin: Some(true),
                    autoread: Some(true),
                    tts_channel_id: Some(Some("text".into())),
                    tts_role_id: Some(Some("reader".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("config");
        let mut candidate = facts();
        candidate.bot_voice_channel_id = None;
        assert!(!should_attempt_autojoin(&store, candidate).expect("missing role"));
        let reader_roles = ["reader".to_owned()];
        let mut authorized = candidate;
        authorized.member_role_ids = Some(&reader_roles);
        assert!(should_attempt_autojoin(&store, authorized).expect("role"));
        store.set_opt_out("guild", "user").expect("opt out");
        assert!(!should_attempt_autojoin(&store, authorized).expect("opt out"));
        authorized.mentioned_bot = true;
        assert!(should_attempt_autojoin(&store, authorized).expect("explicit mention"));
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
