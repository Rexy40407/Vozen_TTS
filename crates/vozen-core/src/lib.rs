#![forbid(unsafe_code)]

//! Pure product policies. Adapters for Discord, SQLite and HTTP live in later crates.

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
