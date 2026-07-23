//! Generated game content shared by the Rust drivers.
//!
//! The TypeScript content files remain the editable source of truth for now. The checked-in JSON
//! contract makes the migration explicit and lets Rust consume the exact same seeded banks without
//! copying or silently re-translating user-facing prompts.

use std::{collections::BTreeMap, sync::OnceLock};

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct GameContent {
    pub schema_version: u32,
    pub generated_from: String,
    pub language_phrases: BTreeMap<String, Vec<String>>,
    pub roulette_prompts: BTreeMap<String, Vec<String>>,
    pub short_phrases: BTreeMap<String, Vec<String>>,
    pub word_bank: BTreeMap<String, Vec<String>>,
    pub wordle_words: BTreeMap<String, Vec<String>>,
}

static CONTENT: OnceLock<GameContent> = OnceLock::new();

/// Returns the immutable content contract compiled into the Rust Discord adapter.
///
/// Parsing occurs once and is intentionally infallible after a successful build: a malformed
/// generated asset is a packaging error, not a reason to fall back to invented game content.
pub fn game_content() -> &'static GameContent {
    CONTENT.get_or_init(|| {
        serde_json::from_str(include_str!("../assets/game-content.json"))
            .expect("generated Rust game content contract must be valid JSON")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_contract_has_all_runtime_banks() {
        let content = game_content();
        assert_eq!(content.schema_version, 1);
        assert!(!content.generated_from.is_empty());
        assert!(content.language_phrases.contains_key("en"));
        assert!(content.roulette_prompts.contains_key("en"));
        assert!(content.short_phrases.contains_key("en"));
        assert!(content.word_bank.contains_key("en"));
        assert!(content.wordle_words.contains_key("en"));
        assert!(
            content
                .language_phrases
                .values()
                .all(|bank| !bank.is_empty())
        );
        assert!(
            content
                .roulette_prompts
                .values()
                .all(|bank| !bank.is_empty())
        );
        assert!(content.short_phrases.values().all(|bank| !bank.is_empty()));
        assert!(content.word_bank.values().all(|bank| !bank.is_empty()));
        assert!(content.wordle_words.values().all(|bank| !bank.is_empty()));
    }
}
