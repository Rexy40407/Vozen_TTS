//! Transport-free lifecycle coordinator for the Heads-or-Tails game.
//!
//! The Node manager owns timers and one active match per guild. This coordinator ports those
//! invariants behind an explicit clock boundary; a future gateway adapter only needs to translate
//! the returned actions into Discord messages and voice calls.

use std::collections::BTreeMap;

use vozen_core::{CoinSide, GameWinner, GuessResult};

use crate::{
    GameScore, GameSession, GameSessionStore, HeadsOrTailsMessage, HeadsOrTailsSession,
    HeadsOrTailsStart,
};

pub const GUESS_WINDOW_MS: i64 = 8_000;
pub const NEXT_ROUND_DELAY_MS: i64 = 2_500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    Guess,
    NextRound,
}

#[derive(Debug)]
struct ActiveGame {
    session: HeadsOrTailsSession,
    phase: Phase,
    deadline_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HeadsOrTailsAction {
    Started {
        round: u8,
    },
    AlreadyActive {
        channel_id: String,
    },
    Ignored,
    Guess(GuessResult),
    Revealed {
        round: u8,
        side: CoinSide,
        winners: Vec<GameWinner>,
    },
    RoundOpened {
        round: u8,
    },
    Finished {
        scores: Vec<GameScore>,
    },
    Stopped,
    NoActiveGame,
    VoiceLeft,
}

#[derive(Debug, Default)]
pub struct HeadsOrTailsCoordinator {
    store: GameSessionStore,
    active: BTreeMap<String, ActiveGame>,
}

impl HeadsOrTailsCoordinator {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start(&mut self, metadata: GameSession, seed: i64, now_ms: i64) -> HeadsOrTailsAction {
        match HeadsOrTailsSession::try_register(&mut self.store, metadata.clone(), seed) {
            Ok(session) => HeadsOrTailsAction::Started {
                round: {
                    let round = session.round();
                    self.active.insert(
                        metadata.guild_id.clone(),
                        ActiveGame {
                            session,
                            phase: Phase::Guess,
                            deadline_ms: now_ms.saturating_add(GUESS_WINDOW_MS),
                        },
                    );
                    round
                },
            },
            Err(HeadsOrTailsStart::AlreadyActive { channel_id }) => {
                HeadsOrTailsAction::AlreadyActive { channel_id }
            }
            Err(HeadsOrTailsStart::Started { .. }) => unreachable!("start cannot return Started"),
        }
    }

    #[must_use]
    pub fn active(&self, guild_id: &str) -> bool {
        self.active.contains_key(guild_id)
    }

    #[must_use]
    pub fn channel_of(&self, guild_id: &str) -> Option<&str> {
        self.active
            .get(guild_id)
            .map(|game| game.session.metadata.channel_id.as_str())
    }

    #[must_use]
    pub fn is_starter(&self, guild_id: &str, user_id: &str) -> bool {
        self.active
            .get(guild_id)
            .is_some_and(|game| game.session.metadata.starter_id == user_id)
    }

    pub fn guess(
        &mut self,
        guild_id: &str,
        channel_id: &str,
        user_id: &str,
        display_name: &str,
        raw: &str,
    ) -> HeadsOrTailsAction {
        let Some(game) = self.active.get_mut(guild_id) else {
            return HeadsOrTailsAction::Ignored;
        };
        match game
            .session
            .guess(guild_id, channel_id, user_id, display_name, raw)
        {
            HeadsOrTailsMessage::Ignored => HeadsOrTailsAction::Ignored,
            HeadsOrTailsMessage::Guess(result) => HeadsOrTailsAction::Guess(result),
        }
    }

    /// Advances every due game. A single tick may emit a reveal and, after the configured delay,
    /// a newly opened round. The caller owns scheduling and can use any monotonic clock.
    pub fn advance(&mut self, now_ms: i64) -> Vec<HeadsOrTailsAction> {
        let due = self
            .active
            .iter()
            .filter_map(|(guild_id, game)| (now_ms >= game.deadline_ms).then_some(guild_id.clone()))
            .collect::<Vec<_>>();
        let mut actions = Vec::new();
        for guild_id in due {
            let Some(game) = self.active.get_mut(&guild_id) else {
                continue;
            };
            match game.phase {
                Phase::Guess => {
                    let round = game.session.round();
                    let Some(reveal) = game.session.reveal() else {
                        continue;
                    };
                    actions.push(HeadsOrTailsAction::Revealed {
                        round,
                        side: reveal.side,
                        winners: reveal.winners,
                    });
                    if game.session.finished() || game.session.is_final_round() {
                        let scores = self.finish_game(&guild_id);
                        actions.push(HeadsOrTailsAction::Finished { scores });
                    } else {
                        game.phase = Phase::NextRound;
                        game.deadline_ms = now_ms.saturating_add(NEXT_ROUND_DELAY_MS);
                    }
                }
                Phase::NextRound => {
                    let Some(round) = game.session.next_round() else {
                        let scores = self.finish_game(&guild_id);
                        actions.push(HeadsOrTailsAction::Finished { scores });
                        continue;
                    };
                    game.phase = Phase::Guess;
                    game.deadline_ms = now_ms.saturating_add(GUESS_WINDOW_MS);
                    actions.push(HeadsOrTailsAction::RoundOpened { round });
                }
            }
        }
        actions
    }

    pub fn stop(
        &mut self,
        guild_id: &str,
        user_id: &str,
        can_manage_guild: bool,
    ) -> HeadsOrTailsAction {
        match self
            .store
            .stop_authorized(guild_id, user_id, can_manage_guild)
        {
            Ok(Some(_)) => {
                self.active.remove(guild_id);
                HeadsOrTailsAction::Stopped
            }
            Ok(None) => HeadsOrTailsAction::NoActiveGame,
            Err(_) => HeadsOrTailsAction::Ignored,
        }
    }

    pub fn on_voice_left(&mut self, guild_id: &str) -> HeadsOrTailsAction {
        if self
            .store
            .on_voice_left(guild_id)
            .is_some_and(|_| self.active.remove(guild_id).is_some())
        {
            HeadsOrTailsAction::VoiceLeft
        } else {
            HeadsOrTailsAction::NoActiveGame
        }
    }

    pub fn end_guild(&mut self, guild_id: &str) {
        self.store.end_guild(guild_id);
        self.active.remove(guild_id);
    }

    fn finish_game(&mut self, guild_id: &str) -> Vec<GameScore> {
        let Some(game) = self.active.remove(guild_id) else {
            return Vec::new();
        };
        let scores = game.session.scores();
        for score in &scores {
            self.store.award(guild_id, &score.user_id, score.points);
        }
        self.store.finish_scores(guild_id).unwrap_or(scores)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata() -> GameSession {
        GameSession {
            guild_id: "guild".into(),
            channel_id: "channel".into(),
            game_id: "headsOrTails".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        }
    }

    #[test]
    fn enforces_window_delay_and_five_round_finish() {
        let mut coordinator = HeadsOrTailsCoordinator::new();
        assert_eq!(
            coordinator.start(metadata(), 7, 1_000),
            HeadsOrTailsAction::Started { round: 1 }
        );
        assert_eq!(coordinator.advance(8_999), Vec::<HeadsOrTailsAction>::new());
        assert!(matches!(
            coordinator.guess("guild", "channel", "u1", "Ana", "heads"),
            HeadsOrTailsAction::Guess(GuessResult::Accepted)
        ));
        assert!(matches!(
            coordinator.advance(9_000).as_slice(),
            [HeadsOrTailsAction::Revealed { round: 1, .. }]
        ));
        assert!(coordinator.active("guild"));
        assert!(matches!(coordinator.advance(11_499).as_slice(), []));
        assert_eq!(
            coordinator.advance(11_500),
            vec![HeadsOrTailsAction::RoundOpened { round: 2 }]
        );
        let mut reveal_at = 19_500;
        for round in 2..=5 {
            let actions = coordinator.advance(reveal_at);
            assert!(matches!(
                actions.as_slice(),
                [HeadsOrTailsAction::Revealed { round: actual, .. }, ..]
                    if *actual == round
            ));
            if round < 5 {
                let open_at = reveal_at + NEXT_ROUND_DELAY_MS;
                assert_eq!(
                    coordinator.advance(open_at),
                    vec![HeadsOrTailsAction::RoundOpened { round: round + 1 }]
                );
                reveal_at = open_at + GUESS_WINDOW_MS;
            }
        }
        assert!(!coordinator.active("guild"));
    }

    #[test]
    fn stop_and_voice_loss_are_scoped() {
        let mut coordinator = HeadsOrTailsCoordinator::new();
        coordinator.start(metadata(), 1, 0);
        assert_eq!(
            coordinator.stop("guild", "other", false),
            HeadsOrTailsAction::Ignored
        );
        assert!(coordinator.active("guild"));
        assert_eq!(
            coordinator.on_voice_left("guild"),
            HeadsOrTailsAction::VoiceLeft
        );
        assert!(!coordinator.active("guild"));
    }
}
