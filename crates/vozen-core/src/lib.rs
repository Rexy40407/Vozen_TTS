#![forbid(unsafe_code)]

//! Pure product policies. Adapters for Discord, SQLite and HTTP live in later crates.

mod abbreviations;
mod accent_restoration;
mod kofi;
mod message_speech_policy;
mod play_queue;
mod rate_limiter;
mod speech_preparation;
mod speech_safety;
mod text_cleaning;
mod voice_selection;

pub use abbreviations::{
    SlangSegment, expand_abbreviations, is_all_english_abbrev, split_english_slang,
};
pub use accent_restoration::restore_accents;
pub use kofi::{
    KofiEvent, KofiGrant, KofiPlan, PREMIUM_MAX_SEATS, PREMIUM_PASS_SEATS, ShopProduct,
    extract_kofi_discord_id, hash_kofi_email, map_kofi_to_grant, parse_kofi_payload,
    parse_kofi_shop_map, verify_kofi_token,
};
pub use message_speech_policy::{
    MessageSpeechDecision, MessageSpeechDenial, MessageSpeechInput, admit_message_speech,
};
pub use play_queue::{
    MAX_ACCESSIBILITY_BURST, PlayQueue, PublicQueueItem, QueueEnqueueOptions, QueueSource,
    QueueWorkItem,
};
pub use rate_limiter::{
    DEFAULT_RATE_LIMIT_IDLE_MS, GuildRateLimiters, MAX_RATE_LIMIT_BUCKETS, RateLimiter,
};
pub use speech_preparation::{
    MediaAnnouncement, MediaAnnouncementKind, PreparedSpeech, SpeechPreparationInput,
    VoicePreference, prepare_speech,
};
pub use speech_safety::{
    MAX_SYNTH_CHARS, PronunciationEntry, SpeechSegment, SynthRequest, apply_pronunciation,
    cap_synth_request, has_readable_text, is_blocked, redact_blocked, redact_request,
};
pub use text_cleaning::{
    CleanTextOptions, MediaKind, clean_text, collect_markdown_media, collect_url_media,
};
pub use voice_selection::{accent_language_of_model, pick_voice, pick_voice_for_language};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueueLane {
    Standard,
    Accessibility,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserSpeechDenial {
    NotInSameVoice,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserSpeechAdmission {
    Allowed { lane: QueueLane },
    Denied { reason: UserSpeechDenial },
}

#[derive(Debug, Clone, Copy, Default)]
pub struct RolePolicy<'a> {
    pub priority_role_id: Option<&'a str>,
    pub blocked_role_id: Option<&'a str>,
}

/// Mirrors the Node admission rule for every member-originated speech action.
///
/// A caller must always share the bot's current voice channel. When a role policy is configured,
/// a missing member cache entry fails closed. Blocked roles always beat priority roles.
pub fn admit_user_speech(
    caller_voice_channel_id: Option<&str>,
    bot_voice_channel_id: Option<&str>,
    member_role_ids: Option<&[&str]>,
    policy: RolePolicy<'_>,
) -> UserSpeechAdmission {
    if caller_voice_channel_id.is_none()
        || bot_voice_channel_id.is_none()
        || caller_voice_channel_id != bot_voice_channel_id
    {
        return UserSpeechAdmission::Denied {
            reason: UserSpeechDenial::NotInSameVoice,
        };
    }

    let policy_enabled = policy.priority_role_id.is_some() || policy.blocked_role_id.is_some();
    let Some(role_ids) = member_role_ids else {
        return if policy_enabled {
            UserSpeechAdmission::Denied {
                reason: UserSpeechDenial::NotInSameVoice,
            }
        } else {
            UserSpeechAdmission::Allowed {
                lane: QueueLane::Standard,
            }
        };
    };

    if policy
        .blocked_role_id
        .is_some_and(|blocked| role_ids.contains(&blocked))
    {
        return UserSpeechAdmission::Denied {
            reason: UserSpeechDenial::Blocked,
        };
    }

    let lane = if policy
        .priority_role_id
        .is_some_and(|priority| role_ids.contains(&priority))
    {
        QueueLane::Accessibility
    } else {
        QueueLane::Standard
    };
    UserSpeechAdmission::Allowed { lane }
}

#[cfg(test)]
mod tests {
    use super::*;

    const POLICY: RolePolicy<'static> = RolePolicy {
        priority_role_id: Some("priority"),
        blocked_role_id: Some("blocked"),
    };

    #[test]
    fn same_call_is_required_before_every_other_policy() {
        assert_eq!(
            admit_user_speech(Some("voice-a"), Some("voice-b"), Some(&["blocked"]), POLICY),
            UserSpeechAdmission::Denied {
                reason: UserSpeechDenial::NotInSameVoice,
            }
        );
    }

    #[test]
    fn blocked_role_wins_over_priority_role() {
        assert_eq!(
            admit_user_speech(
                Some("voice"),
                Some("voice"),
                Some(&["priority", "blocked"]),
                POLICY
            ),
            UserSpeechAdmission::Denied {
                reason: UserSpeechDenial::Blocked,
            }
        );
    }

    #[test]
    fn priority_role_uses_accessibility_lane() {
        assert_eq!(
            admit_user_speech(Some("voice"), Some("voice"), Some(&["priority"]), POLICY),
            UserSpeechAdmission::Allowed {
                lane: QueueLane::Accessibility,
            }
        );
    }

    #[test]
    fn missing_member_cache_fails_closed_only_when_role_policy_exists() {
        assert_eq!(
            admit_user_speech(Some("voice"), Some("voice"), None, POLICY),
            UserSpeechAdmission::Denied {
                reason: UserSpeechDenial::NotInSameVoice,
            }
        );
        assert_eq!(
            admit_user_speech(Some("voice"), Some("voice"), None, RolePolicy::default()),
            UserSpeechAdmission::Allowed {
                lane: QueueLane::Standard,
            }
        );
    }
}
