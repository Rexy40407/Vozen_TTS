//! Generic game-manager adapter for Heads or Tails.

use vozen_core::{CoinSide, GameWinner, GuessResult, HeadsOrTailsGame};

use crate::{GameDriver, GameDriverAction, GameMessage};

const GUESS_WINDOW_MS: i64 = 8_000;
const NEXT_ROUND_DELAY_MS: i64 = 2_500;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HeadsOrTailsDriverAction {
    RoundOpened {
        round: u8,
        total: u8,
    },
    GuessAccepted {
        user_id: String,
        name: String,
    },
    Revealed {
        round: u8,
        side: CoinSide,
        winners: Vec<GameWinner>,
    },
    RoundPaused {
        delay_ms: i64,
    },
    Finished,
    Ignored,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    Guess,
    Pause,
    Ended,
}

#[derive(Debug)]
pub struct HeadsOrTailsDriver {
    game: HeadsOrTailsGame,
    phase: Phase,
    deadline_ms: Option<i64>,
}

pub struct HeadsOrTailsGameDriver {
    inner: HeadsOrTailsDriver,
}

impl HeadsOrTailsGameDriver {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        Self {
            inner: HeadsOrTailsDriver::new(seed),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &HeadsOrTailsDriver {
        &self.inner
    }
}

impl GameDriver for HeadsOrTailsGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.start(now_ms))
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, _now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.guess(
            &message.author_id,
            &message.author_name,
            &message.content,
        ))
    }

    fn on_tick(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        let Some(action) = self.inner.advance(now_ms) else {
            return Vec::new();
        };
        let mut actions = to_manager_actions(action);
        if self.inner.is_finished() {
            actions.extend(to_manager_actions(HeadsOrTailsDriverAction::Finished));
        }
        actions
    }
}

fn to_manager_actions(action: HeadsOrTailsDriverAction) -> Vec<GameDriverAction> {
    let awards = match &action {
        HeadsOrTailsDriverAction::Revealed { winners, .. } => winners
            .iter()
            .map(|winner| GameDriverAction::Award {
                user_id: winner.user_id.clone(),
                points: 1,
            })
            .collect::<Vec<_>>(),
        _ => Vec::new(),
    };
    let finished = matches!(action, HeadsOrTailsDriverAction::Finished);
    let mut actions = awards;
    actions.push(GameDriverAction::HeadsOrTails(action));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl HeadsOrTailsDriver {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        Self {
            game: HeadsOrTailsGame::new(seed),
            phase: Phase::Ended,
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.phase == Phase::Ended
    }

    pub fn start(&mut self, now_ms: i64) -> HeadsOrTailsDriverAction {
        let round = self
            .game
            .begin_round()
            .expect("heads or tails has five rounds");
        self.phase = Phase::Guess;
        self.deadline_ms = Some(now_ms.saturating_add(GUESS_WINDOW_MS));
        HeadsOrTailsDriverAction::RoundOpened {
            round,
            total: HeadsOrTailsGame::rounds(),
        }
    }

    pub fn guess(&mut self, user_id: &str, name: &str, raw: &str) -> HeadsOrTailsDriverAction {
        if self.phase != Phase::Guess {
            return HeadsOrTailsDriverAction::Ignored;
        }
        match self.game.guess(user_id, name, raw) {
            GuessResult::Accepted => HeadsOrTailsDriverAction::GuessAccepted {
                user_id: user_id.to_owned(),
                name: name.to_owned(),
            },
            GuessResult::Duplicate | GuessResult::Closed | GuessResult::Invalid => {
                HeadsOrTailsDriverAction::Ignored
            }
        }
    }

    pub fn advance(&mut self, now_ms: i64) -> Option<HeadsOrTailsDriverAction> {
        let deadline = self.deadline_ms?;
        if now_ms < deadline {
            return None;
        }
        match self.phase {
            Phase::Guess => {
                let round = self.game.round();
                let reveal = self.game.reveal()?;
                let action = HeadsOrTailsDriverAction::Revealed {
                    round,
                    side: reveal.side,
                    winners: reveal.winners,
                };
                if self.game.is_finished() || self.game.round() >= HeadsOrTailsGame::rounds() {
                    self.phase = Phase::Ended;
                    self.deadline_ms = None;
                } else {
                    self.phase = Phase::Pause;
                    self.deadline_ms = Some(now_ms.saturating_add(NEXT_ROUND_DELAY_MS));
                }
                Some(action)
            }
            Phase::Pause => {
                let round = self.game.begin_round()?;
                self.phase = Phase::Guess;
                self.deadline_ms = Some(now_ms.saturating_add(GUESS_WINDOW_MS));
                Some(HeadsOrTailsDriverAction::RoundOpened {
                    round,
                    total: HeadsOrTailsGame::rounds(),
                })
            }
            Phase::Ended => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    #[test]
    fn accepts_one_guess_per_player_and_reveals_after_eight_seconds() {
        let mut driver = HeadsOrTailsDriver::new(42);
        assert_eq!(
            driver.start(1_000),
            HeadsOrTailsDriverAction::RoundOpened { round: 1, total: 5 }
        );
        assert_eq!(driver.deadline_ms(), Some(9_000));
        assert!(matches!(
            driver.guess("u", "Rexy", "heads"),
            HeadsOrTailsDriverAction::GuessAccepted { .. }
        ));
        assert_eq!(
            driver.guess("u", "Rexy", "tails"),
            HeadsOrTailsDriverAction::Ignored
        );
        assert!(driver.advance(8_999).is_none());
        assert!(matches!(
            driver.advance(9_000),
            Some(HeadsOrTailsDriverAction::Revealed { round: 1, .. })
        ));
        assert_eq!(driver.deadline_ms(), Some(11_500));
        assert!(matches!(
            driver.advance(11_500),
            Some(HeadsOrTailsDriverAction::RoundOpened { round: 2, .. })
        ));
    }

    #[test]
    fn final_reveal_finishes_after_five_rounds() {
        let mut driver = HeadsOrTailsDriver::new(7);
        let _ = driver.start(0);
        let mut now = 8_000;
        for round in 1..=5 {
            let action = driver.advance(now).expect("reveal");
            assert!(
                matches!(action, HeadsOrTailsDriverAction::Revealed { round: actual, .. } if actual == round)
            );
            if round < 5 {
                now += NEXT_ROUND_DELAY_MS;
                assert!(matches!(
                    driver.advance(now),
                    Some(HeadsOrTailsDriverAction::RoundOpened { .. })
                ));
                now += GUESS_WINDOW_MS;
            }
        }
        assert_eq!(driver.advance(now), None);
        assert_eq!(driver.deadline_ms(), None);
    }

    #[test]
    fn manager_adapter_persists_reveal_winners() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "headsOrTails".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: true,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) =
            manager.start_at(session, Box::new(HeadsOrTailsGameDriver::new(1)), 0);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::HeadsOrTails(
                HeadsOrTailsDriverAction::RoundOpened { .. }
            )]
        ));
        let _ = manager.handle_message_at(
            &GameMessage {
                guild_id: "guild".into(),
                channel_id: "game".into(),
                author_id: "u".into(),
                author_name: "Rexy".into(),
                content: "heads".into(),
                can_trigger_speech: true,
            },
            1_000,
        );
        let event = manager.advance(8_000);
        assert!(matches!(
            event.as_slice(),
            [GameManagerEvent::Consumed { .. }]
        ));
    }
}
