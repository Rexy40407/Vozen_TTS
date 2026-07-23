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

pub const GAME_CATALOG: &[GameDefinition] = &[
    definition(
        "guess-language",
        "game.guessLanguage.name",
        "game.guessLanguage.desc",
        true,
        false,
        false,
    ),
    definition(
        "math",
        "game.math.name",
        "game.math.desc",
        true,
        false,
        false,
    ),
    definition(
        "skip-count",
        "game.skipCount.name",
        "game.skipCount.desc",
        true,
        false,
        false,
    ),
    definition(
        "spelling",
        "game.spelling.name",
        "game.spelling.desc",
        true,
        false,
        false,
    ),
    definition(
        "spell-out",
        "game.spellOut.name",
        "game.spellOut.desc",
        true,
        false,
        false,
    ),
    definition(
        "fast-speech",
        "game.fastSpeech.name",
        "game.fastSpeech.desc",
        true,
        false,
        false,
    ),
    definition(
        "accent-swap",
        "game.accentSwap.name",
        "game.accentSwap.desc",
        true,
        false,
        false,
    ),
    definition(
        "reflexes",
        "game.reflexes.name",
        "game.reflexes.desc",
        true,
        false,
        false,
    ),
    definition(
        "vozen-says",
        "game.vozenSays.name",
        "game.vozenSays.desc",
        true,
        false,
        false,
    ),
    definition(
        "roulette",
        "game.roulette.name",
        "game.roulette.desc",
        true,
        false,
        false,
    ),
    definition(
        "hangman",
        "game.hangman.name",
        "game.hangman.desc",
        false,
        false,
        false,
    ),
    definition(
        "wordle",
        "game.wordle.name",
        "game.wordle.desc",
        false,
        true,
        false,
    ),
    definition(
        "tictactoe",
        "game.tictactoe.name",
        "game.tictactoe.desc",
        false,
        false,
        false,
    ),
    definition(
        "chess",
        "game.chess.name",
        "game.chess.desc",
        false,
        true,
        false,
    ),
    definition(
        "word-chain",
        "game.wordChain.name",
        "game.wordChain.descr",
        false,
        true,
        true,
    ),
    definition(
        "headsOrTails",
        "game.headsOrTails.name",
        "game.headsOrTails.desc",
        true,
        false,
        false,
    ),
];

const fn definition(
    id: &'static str,
    name_key: &'static str,
    desc_key: &'static str,
    needs_voice: bool,
    premium: bool,
    uses_language: bool,
) -> GameDefinition {
    GameDefinition {
        id,
        name_key,
        desc_key,
        needs_voice,
        premium,
        uses_language,
    }
}

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
