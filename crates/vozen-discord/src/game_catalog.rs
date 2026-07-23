//! Contract-backed metadata for the `/game` registry.
//!
//! The Node registry is ordered user-facing data: it drives `/game list`, autocomplete and the
//! start gate. Keeping the same order and flags in Rust gives the future game runtime one source
//! of truth without importing game implementation code or enabling any interaction authority.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GameDefinition {
    pub id: &'static str,
    pub name_key: &'static str,
    pub desc_key: &'static str,
    pub needs_voice: bool,
    pub premium: bool,
    pub uses_language: bool,
}

include!("generated_game_catalog.rs");

#[must_use]
pub fn game_by_id(id: &str) -> Option<&'static GameDefinition> {
    GAME_CATALOG.iter().find(|game| game.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_matches_node_order_and_metadata() {
        assert_eq!(GAME_CATALOG.len(), 16);
        let ids = GAME_CATALOG.iter().map(|game| game.id).collect::<Vec<_>>();
        assert_eq!(
            ids,
            vec![
                "guess-language",
                "math",
                "skip-count",
                "spelling",
                "spell-out",
                "fast-speech",
                "accent-swap",
                "reflexes",
                "vozen-says",
                "roulette",
                "hangman",
                "wordle",
                "tictactoe",
                "chess",
                "word-chain",
                "headsOrTails",
            ]
        );
        assert_eq!(GAME_CATALOG[0].id, "guess-language");
        assert_eq!(GAME_CATALOG[14].id, "word-chain");
        assert_eq!(GAME_CATALOG[14].desc_key, "game.wordChain.descr");
        assert_eq!(GAME_CATALOG[15].id, "headsOrTails");
        assert!(GAME_CATALOG[11].premium);
        assert!(GAME_CATALOG[14].uses_language);
        assert!(!GAME_CATALOG[10].needs_voice);
        assert!(game_by_id("headsOrTails").is_some());
        assert!(game_by_id("word-chain").is_some());
        assert!(game_by_id("not-a-game").is_none());
    }
}
