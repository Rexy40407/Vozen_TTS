//! Pure admission policy for a Discord message that may trigger speech.
//!
//! This is intentionally below the Discord adapter: it receives only already-resolved IDs and
//! booleans, performs no cache/network/database work, and cannot inspect message content. The
//! key product invariant is structural here: a human message can never reach TTS unless its
//! author is in the same voice channel as Vozen (apart from the one author that just caused a
//! permitted auto-join). `read_bots` remains the explicit legacy exception for bot messages.

use crate::{QueueLane, RolePolicy, UserSpeechAdmission, admit_user_speech};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageSpeechDenial {
    Disabled,
    BotsDisabled,
    NotTriggered,
    BoundVoiceMismatch,
    RequiredRoleMissing,
    PassiveOptOut,
    NotInSameVoice,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageSpeechDecision {
    Allowed { lane: QueueLane },
    Denied { reason: MessageSpeechDenial },
}

/// Everything the gateway has to establish before a message can be considered for TTS.
///
/// `member_role_ids = None` means the member cache was unavailable. With any configured role
/// gate, this fails closed. `autojoined_for_author` is valid only for the exact human message
/// whose author initiated the join; a caller must never set it for a later message.
#[derive(Debug, Clone, Copy)]
pub struct MessageSpeechInput<'a> {
    pub enabled: bool,
    pub author_is_bot: bool,
    pub read_bots: bool,
    pub auto_read: bool,
    pub mentioned_bot: bool,
    pub replied_to_bot: bool,
    pub text_in_voice: bool,
    pub opted_out: bool,
    pub required_tts_role_id: Option<&'a str>,
    /// Optional per-channel binding. A binding narrows eligibility; it never grants a bypass.
    pub profile_voice_channel_id: Option<&'a str>,
    pub author_voice_channel_id: Option<&'a str>,
    pub bot_voice_channel_id: Option<&'a str>,
    pub autojoined_for_author: bool,
    pub member_role_ids: Option<&'a [&'a str]>,
    pub queue_role_policy: RolePolicy<'a>,
}

/// Applies the Node message-handler ordering through the point where a request enters a queue.
/// Content clean-up, rate limits, anti-spam and blocklists run later and can only reject more
/// messages; they cannot turn a denial here into speech.
pub fn admit_message_speech(input: MessageSpeechInput<'_>) -> MessageSpeechDecision {
    if !input.enabled {
        return deny(MessageSpeechDenial::Disabled);
    }
    if input.author_is_bot && !input.read_bots {
        return deny(MessageSpeechDenial::BotsDisabled);
    }

    let explicitly_requested = input.mentioned_bot || input.replied_to_bot;
    let passive_trigger = input.auto_read || input.text_in_voice;
    if !explicitly_requested && !passive_trigger {
        return deny(MessageSpeechDenial::NotTriggered);
    }

    // A profile binding applies before an autojoin. Otherwise a text channel bound to voice A
    // could cause Vozen to join voice B merely because the author happened to be there.
    if let Some(bound_voice) = input.profile_voice_channel_id
        && !input.author_is_bot
        && input.author_voice_channel_id != Some(bound_voice)
    {
        return deny(MessageSpeechDenial::BoundVoiceMismatch);
    }
    if let Some(required_role) = input.required_tts_role_id {
        let has_role = input
            .member_role_ids
            .is_some_and(|roles| roles.contains(&required_role));
        if !has_role {
            return deny(MessageSpeechDenial::RequiredRoleMissing);
        }
    }
    // Opt-out stops only unsolicited automatic reading. Mention/reply remains an intentional
    // action by that user, exactly as the existing bot does.
    if input.opted_out && passive_trigger && !explicitly_requested {
        return deny(MessageSpeechDenial::PassiveOptOut);
    }

    // A binding must also agree with the call where Vozen already is. The autojoin exception is
    // safe because the prior author-to-bound-channel check forced this exact channel.
    if input.profile_voice_channel_id.is_some()
        && input.profile_voice_channel_id != input.bot_voice_channel_id
        && !input.autojoined_for_author
    {
        return deny(MessageSpeechDenial::BoundVoiceMismatch);
    }

    // `read_bots` is deliberately the only class allowed to skip the same-human-call rule.
    // It still went through enabled, trigger, required role and channel-binding checks above.
    if input.author_is_bot {
        return role_lane(input.member_role_ids, input.queue_role_policy);
    }

    let (author_voice, bot_voice) = if input.autojoined_for_author {
        // The adapter establishes that the autojoin is for this exact message. Discord's member
        // cache can lag after a successful join, so compare to the author's resolved channel.
        (input.author_voice_channel_id, input.author_voice_channel_id)
    } else {
        (input.author_voice_channel_id, input.bot_voice_channel_id)
    };
    match admit_user_speech(
        author_voice,
        bot_voice,
        input.member_role_ids,
        input.queue_role_policy,
    ) {
        UserSpeechAdmission::Allowed { lane } => MessageSpeechDecision::Allowed { lane },
        UserSpeechAdmission::Denied { reason } => match reason {
            crate::UserSpeechDenial::Blocked => deny(MessageSpeechDenial::Blocked),
            crate::UserSpeechDenial::NotInSameVoice => deny(MessageSpeechDenial::NotInSameVoice),
        },
    }
}

fn role_lane(member_role_ids: Option<&[&str]>, policy: RolePolicy<'_>) -> MessageSpeechDecision {
    // A synthetic same-call fulfils only the voice comparison for bot messages. It preserves the
    // existing blocked-wins and missing-role-cache fail-closed rules from `admit_user_speech`.
    match admit_user_speech(Some("bot"), Some("bot"), member_role_ids, policy) {
        UserSpeechAdmission::Allowed { lane } => MessageSpeechDecision::Allowed { lane },
        UserSpeechAdmission::Denied { reason } => match reason {
            crate::UserSpeechDenial::Blocked => deny(MessageSpeechDenial::Blocked),
            crate::UserSpeechDenial::NotInSameVoice => deny(MessageSpeechDenial::NotInSameVoice),
        },
    }
}

fn deny(reason: MessageSpeechDenial) -> MessageSpeechDecision {
    MessageSpeechDecision::Denied { reason }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn human() -> MessageSpeechInput<'static> {
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

    #[test]
    fn human_speech_requires_same_call_even_when_the_channel_triggers() {
        let mut input = human();
        input.author_voice_channel_id = Some("other-voice");
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::NotInSameVoice)
        );
        input.author_voice_channel_id = None;
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::NotInSameVoice)
        );
    }

    #[test]
    fn explicit_mentions_respect_same_call_but_bypass_passive_opt_out() {
        let mut input = human();
        input.opted_out = true;
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::PassiveOptOut)
        );
        input.mentioned_bot = true;
        assert_eq!(
            admit_message_speech(input),
            MessageSpeechDecision::Allowed {
                lane: QueueLane::Standard
            }
        );
        input.bot_voice_channel_id = Some("other");
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::NotInSameVoice)
        );
    }

    #[test]
    fn profile_binding_and_required_role_only_narrow_access() {
        let mut input = human();
        input.profile_voice_channel_id = Some("bound");
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::BoundVoiceMismatch)
        );
        input.author_voice_channel_id = Some("bound");
        input.bot_voice_channel_id = Some("bound");
        input.required_tts_role_id = Some("reader");
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::RequiredRoleMissing)
        );
        input.member_role_ids = Some(&["reader"]);
        assert!(matches!(
            admit_message_speech(input),
            MessageSpeechDecision::Allowed { .. }
        ));
    }

    #[test]
    fn bot_exception_is_explicit_but_keeps_all_other_gates() {
        let mut input = human();
        input.author_is_bot = true;
        input.author_voice_channel_id = None;
        input.bot_voice_channel_id = Some("voice");
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::BotsDisabled)
        );
        input.read_bots = true;
        assert!(matches!(
            admit_message_speech(input),
            MessageSpeechDecision::Allowed { .. }
        ));
        input.enabled = false;
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::Disabled)
        );
    }

    #[test]
    fn autojoin_exception_is_limited_to_the_initiating_author_and_keeps_role_blocks() {
        let mut input = human();
        input.bot_voice_channel_id = None;
        input.autojoined_for_author = true;
        assert!(matches!(
            admit_message_speech(input),
            MessageSpeechDecision::Allowed { .. }
        ));
        input.autojoined_for_author = false;
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::NotInSameVoice)
        );
        input.autojoined_for_author = true;
        input.queue_role_policy = RolePolicy {
            priority_role_id: Some("priority"),
            blocked_role_id: Some("blocked"),
        };
        input.member_role_ids = Some(&["priority", "blocked"]);
        assert_eq!(
            admit_message_speech(input),
            deny(MessageSpeechDenial::Blocked)
        );
    }
}
