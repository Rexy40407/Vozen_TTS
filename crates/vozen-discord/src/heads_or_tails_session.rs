//! Session adapter joining the generic game lifecycle to the pure Heads-or-Tails rules.
//!
//! This is intentionally transport-free. Discord timers, messages, speech and thread cleanup
//! belong to the runtime; this type guarantees that a round can only be guessed/revealed inside
//! the owning guild/channel and that a normal finish returns the exact score rows to persist.

use vozen_core::{CoinReveal, GameWinner, GuessResult, HeadsOrTailsGame};

use crate::{GameScore, GameSession, GameSessionStore, StartGameResult};

#[derive(Debug)]
pub struct HeadsOrTailsSession {
    pub metadata: GameSession,
    game: HeadsOrTailsGame,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HeadsOrTailsStart {
    Started { round: u8 },
    AlreadyActive { channel_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HeadsOrTailsMessage {
    Ignored,
    Guess(GuessResult),
}

impl HeadsOrTailsSession {
    pub fn start(metadata: GameSession, seed: i64) -> (Self, HeadsOrTailsStart) {
        let mut game = HeadsOrTailsGame::new(seed);
        let round = game.begin_round().expect("a new game has an opening round");
        (
            Self { metadata, game },
            HeadsOrTailsStart::Started { round },
        )
    }

    /// The session store remains the single guild lock. The returned value is suitable for a
    /// runtime that keeps the richer per-game state separately from the generic metadata.
    pub fn try_register(
        store: &mut GameSessionStore,
        metadata: GameSession,
        seed: i64,
    ) -> Result<Self, HeadsOrTailsStart> {
        let existing = store.start(metadata.clone());
        match existing {
            StartGameResult::Started => {
                let (session, started) = Self::start(metadata, seed);
                debug_assert!(matches!(started, HeadsOrTailsStart::Started { .. }));
                Ok(session)
            }
            StartGameResult::AlreadyActive { channel_id } => {
                Err(HeadsOrTailsStart::AlreadyActive { channel_id })
            }
        }
    }

    pub fn guess(
        &mut self,
        guild_id: &str,
        channel_id: &str,
        user_id: &str,
        display_name: &str,
        raw: &str,
    ) -> HeadsOrTailsMessage {
        if self.metadata.guild_id != guild_id || self.metadata.channel_id != channel_id {
            return HeadsOrTailsMessage::Ignored;
        }
        HeadsOrTailsMessage::Guess(self.game.guess(user_id, display_name, raw))
    }

    pub fn reveal(&mut self) -> Option<CoinReveal> {
        self.game.reveal()
    }

    pub fn next_round(&mut self) -> Option<u8> {
        self.game.begin_round()
    }

    #[must_use]
    pub fn round(&self) -> u8 {
        self.game.round()
    }

    pub fn finished(&self) -> bool {
        self.game.is_finished()
    }

    #[must_use]
    pub fn is_final_round(&self) -> bool {
        self.game.round() >= HeadsOrTailsGame::rounds()
    }

    pub fn scores(&self) -> Vec<GameScore> {
        self.game
            .scores()
            .map(|(user_id, points)| GameScore {
                user_id: user_id.to_owned(),
                points,
            })
            .collect()
    }

    pub fn winners(reveal: &CoinReveal) -> &[GameWinner] {
        &reveal.winners
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata() -> GameSession {
        GameSession {
            guild_id: "guild".into(),
            channel_id: "thread".into(),
            game_id: "headsOrTails".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: Some("parent".into()),
            scores: Vec::new(),
        }
    }

    #[test]
    fn registration_keeps_one_guild_lock_and_routes_only_the_game_channel() {
        let mut store = GameSessionStore::default();
        let mut game =
            HeadsOrTailsSession::try_register(&mut store, metadata(), 42).expect("started");
        assert!(matches!(
            HeadsOrTailsSession::try_register(&mut store, metadata(), 9),
            Err(HeadsOrTailsStart::AlreadyActive { channel_id })
                if channel_id == "thread"
        ));
        assert_eq!(
            game.guess("guild", "other", "u1", "Ana", "heads"),
            HeadsOrTailsMessage::Ignored
        );
        assert_eq!(
            game.guess("guild", "thread", "u1", "Ana", "heads"),
            HeadsOrTailsMessage::Guess(GuessResult::Accepted)
        );
    }

    #[test]
    fn normal_finish_exposes_scores_before_the_generic_store_is_removed() {
        let mut store = GameSessionStore::default();
        let mut game =
            HeadsOrTailsSession::try_register(&mut store, metadata(), 7).expect("started");
        for _ in 0..HeadsOrTailsGame::rounds() {
            let _ = game.reveal();
            if !game.finished() {
                let _ = game.next_round();
            }
        }
        assert!(game.finished());
        for score in game.scores() {
            store.award("guild", &score.user_id, score.points);
        }
        assert_eq!(store.finish_scores("guild"), Some(game.scores()));
    }
}
