//! Fail-closed admission policy for automatic channel translation.
//!
//! This policy contains no Discord SDK types, database access or provider code. It makes the
//! Node listener's ordering explicit so a future Rust gateway adapter can only request an
//! external translation after every local opt-out and kill switch has been checked.

use crate::TRANSLATION_MARKER;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AutomaticTranslationFacts<'a> {
    pub content: &'a str,
    pub is_self: bool,
    pub is_bot: bool,
    pub is_webhook: bool,
    /// Global server kill switch (`guild_config.enabled`), shared with all automated features.
    pub server_enabled: bool,
    /// Translation's guild-level default (`guild_config.translation_enabled`).
    pub guild_translation_enabled: bool,
    /// `None` inherits the guild translation setting, exactly like `channel_profile` in Node.
    pub channel_translation_enabled: Option<bool>,
    pub has_mapping: bool,
    pub opted_out: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutomaticTranslationDenial {
    NoReadableContent,
    BotOrWebhook,
    LoopMarker,
    GuildDisabled,
    ChannelDisabled,
    NoMapping,
    OptedOut,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutomaticTranslationDecision {
    Translate,
    Ignore(AutomaticTranslationDenial),
}

/// Mirrors the Node listener's local decisions before it checks Discord channel permissions,
/// reserves quota or sends content to Azure. Missing data always denies instead of guessing.
#[must_use]
pub fn admit_automatic_translation(
    facts: AutomaticTranslationFacts<'_>,
) -> AutomaticTranslationDecision {
    if facts.content.trim().is_empty() {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::NoReadableContent);
    }
    if facts.is_self || facts.is_bot || facts.is_webhook {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::BotOrWebhook);
    }
    if facts.content.contains(TRANSLATION_MARKER) {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::LoopMarker);
    }
    if !facts.server_enabled {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::GuildDisabled);
    }
    if !facts
        .channel_translation_enabled
        .unwrap_or(facts.guild_translation_enabled)
    {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::ChannelDisabled);
    }
    if !facts.has_mapping {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::NoMapping);
    }
    if facts.opted_out {
        return AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::OptedOut);
    }
    AutomaticTranslationDecision::Translate
}

#[cfg(test)]
mod tests {
    use super::*;

    fn facts() -> AutomaticTranslationFacts<'static> {
        AutomaticTranslationFacts {
            content: "hello",
            is_self: false,
            is_bot: false,
            is_webhook: false,
            server_enabled: true,
            guild_translation_enabled: true,
            channel_translation_enabled: None,
            has_mapping: true,
            opted_out: false,
        }
    }

    #[test]
    fn admits_only_a_plain_member_message_with_an_enabled_mapping() {
        assert_eq!(
            admit_automatic_translation(facts()),
            AutomaticTranslationDecision::Translate
        );
        let mut overridden = facts();
        overridden.channel_translation_enabled = Some(false);
        assert_eq!(
            admit_automatic_translation(overridden),
            AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::ChannelDisabled)
        );
        overridden.channel_translation_enabled = Some(true);
        assert_eq!(
            admit_automatic_translation(overridden),
            AutomaticTranslationDecision::Translate
        );
        overridden.channel_translation_enabled = None;
        overridden.guild_translation_enabled = false;
        assert_eq!(
            admit_automatic_translation(overridden),
            AutomaticTranslationDecision::Ignore(AutomaticTranslationDenial::ChannelDisabled)
        );
        overridden.channel_translation_enabled = Some(true);
        assert_eq!(
            admit_automatic_translation(overridden),
            AutomaticTranslationDecision::Translate
        );
    }

    #[test]
    fn fails_closed_for_all_message_and_privacy_guards() {
        let cases = [
            (
                AutomaticTranslationFacts {
                    content: " ",
                    ..facts()
                },
                AutomaticTranslationDenial::NoReadableContent,
            ),
            (
                AutomaticTranslationFacts {
                    is_bot: true,
                    ..facts()
                },
                AutomaticTranslationDenial::BotOrWebhook,
            ),
            (
                AutomaticTranslationFacts {
                    content: TRANSLATION_MARKER,
                    ..facts()
                },
                AutomaticTranslationDenial::LoopMarker,
            ),
            (
                AutomaticTranslationFacts {
                    server_enabled: false,
                    ..facts()
                },
                AutomaticTranslationDenial::GuildDisabled,
            ),
            (
                AutomaticTranslationFacts {
                    has_mapping: false,
                    ..facts()
                },
                AutomaticTranslationDenial::NoMapping,
            ),
            (
                AutomaticTranslationFacts {
                    opted_out: true,
                    ..facts()
                },
                AutomaticTranslationDenial::OptedOut,
            ),
        ];
        for (facts, denial) in cases {
            assert_eq!(
                admit_automatic_translation(facts),
                AutomaticTranslationDecision::Ignore(denial)
            );
        }
    }
}
