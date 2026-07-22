//! Privacy boundary for any text sent to a translation provider.
//!
//! This is deliberately pure and shared: no adapter may add Discord IDs, author names, message
//! links, attachments, embeds or history after this point. It mirrors the existing Node text
//! minimisation before Azure receives a request.

use std::sync::LazyLock;

use regex::Regex;

pub const TRANSLATION_MARKER: &str = "\u{200b}\u{2063}vozen-translation\u{2063}";
pub const TRANSLATION_INPUT_CAP: usize = 1_000;

static USER_MENTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<@!?[^>]+>").expect("valid user mention regex"));
static ROLE_MENTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<@&[^>]+>").expect("valid role mention regex"));
static CHANNEL_MENTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<#[^>]+>").expect("valid channel mention regex"));
static BROADCAST_MENTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)@everyone|@here").expect("valid broadcast regex"));
static URL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:https?://|www\.)[^\s<>()]+").expect("valid translation URL regex")
});
static WHITESPACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+").expect("valid whitespace regex"));

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationInput {
    pub text: String,
    pub truncated: bool,
}

/// Removes identity-bearing Discord constructs before content crosses an external boundary.
#[must_use]
pub fn minimise_translation_text(input: &str) -> String {
    let text = USER_MENTION.replace_all(input, "[member]");
    let text = ROLE_MENTION.replace_all(&text, "[role]");
    let text = CHANNEL_MENTION.replace_all(&text, "[channel]");
    let text = BROADCAST_MENTION.replace_all(&text, "[mention]");
    let text = URL.replace_all(&text, "[link]");
    let text = text.replace(TRANSLATION_MARKER, "");
    WHITESPACE.replace_all(&text, " ").trim().to_owned()
}

/// Minimises and bounds provider input without splitting a Unicode scalar value.
#[must_use]
pub fn translation_input(input: &str) -> TranslationInput {
    let minimised = minimise_translation_text(input);
    let mut units = 0;
    let mut end = minimised.len();
    for (index, character) in minimised.char_indices() {
        let character_units = character.len_utf16();
        if units + character_units > TRANSLATION_INPUT_CAP {
            end = index;
            break;
        }
        units += character_units;
    }
    TranslationInput {
        truncated: end < minimised.len(),
        text: minimised[..end].to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_discord_identifiers_and_urls_before_provider_input() {
        assert_eq!(
            minimise_translation_text(
                "Hi <@123> <@!456> <@&789> <#101> @EVERYONE https://example.test/a?secret=1 www.example.test",
            ),
            "Hi [member] [member] [member] [channel] [mention] [link] [link]"
        );
    }

    #[test]
    fn strips_the_loop_marker_and_normalises_whitespace() {
        assert_eq!(
            minimise_translation_text(&format!("  hello\n{TRANSLATION_MARKER}\tworld  ")),
            "hello world"
        );
    }

    #[test]
    fn caps_by_utf16_without_emitting_a_partial_unicode_scalar() {
        let source = format!("{}😀", "a".repeat(999));
        assert_eq!(
            translation_input(&source),
            TranslationInput {
                text: "a".repeat(999),
                truncated: true,
            }
        );
    }
}
