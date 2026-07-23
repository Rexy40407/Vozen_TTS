//! Transport-free adapter for the collaborative Hangman game.
//!
//! `vozen-core` owns the normalized guesses and win/loss rules. This adapter owns the Discord
//! lifecycle boundary: the rendered state needed by a future gateway, an idle deadline, and the
//! generic score/finish actions consumed by [`crate::GameManager`].

use vozen_core::{HangmanEvent, HangmanGame};

use crate::{GameDriver, GameDriverAction, GameMessage};

const IDLE_MS: i64 = 180_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HangmanDriverAction {
    Intro {
        masked: String,
        remaining: u8,
    },
    Hit {
        user_id: String,
        name: String,
        letter: char,
        masked: String,
        remaining: u8,
    },
    Miss {
        user_id: String,
        name: String,
        letter: char,
        masked: String,
        remaining: u8,
    },
    Won {
        user_id: String,
        name: String,
        word: String,
        masked: String,
    },
    Lost {
        word: String,
        masked: String,
    },
    Idle {
        word: String,
        masked: String,
    },
    WrongWord,
    AlreadyTried,
    Ignored,
}

#[derive(Debug)]
pub struct HangmanDriver {
    game: HangmanGame,
    deadline_ms: Option<i64>,
}

/// Adapter that lets [`HangmanDriver`] run inside the generic game lifecycle.
pub struct HangmanGameDriver {
    inner: HangmanDriver,
}

impl HangmanGameDriver {
    #[must_use]
    pub fn new(word: &str) -> Self {
        Self {
            inner: HangmanDriver::new(word),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &HangmanDriver {
        &self.inner
    }
}

impl GameDriver for HangmanGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.start(now_ms))
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.guess(
            now_ms,
            &message.author_id,
            &message.author_name,
            &message.content,
        ))
    }

    fn on_tick(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.tick(now_ms))
    }
}

fn to_manager_actions(action: HangmanDriverAction) -> Vec<GameDriverAction> {
    let score = match &action {
        HangmanDriverAction::Won { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(
        action,
        HangmanDriverAction::Won { .. }
            | HangmanDriverAction::Lost { .. }
            | HangmanDriverAction::Idle { .. }
    );
    let mut actions = vec![GameDriverAction::Hangman(action)];
    if let Some(user_id) = score {
        actions.insert(0, GameDriverAction::Award { user_id, points: 1 });
    }
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl HangmanDriver {
    #[must_use]
    pub fn new(word: &str) -> Self {
        Self {
            game: HangmanGame::new(word),
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    #[must_use]
    pub fn game(&self) -> &HangmanGame {
        &self.game
    }

    pub fn start(&mut self, now_ms: i64) -> HangmanDriverAction {
        self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
        HangmanDriverAction::Intro {
            masked: self.game.masked(),
            remaining: self.game.remaining_lives() as u8,
        }
    }

    pub fn guess(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> HangmanDriverAction {
        let event = self.game.guess(user_id, name, raw);
        match event {
            HangmanEvent::Hit {
                user_id,
                name,
                letter,
                ..
            } => {
                self.rearm(now_ms);
                HangmanDriverAction::Hit {
                    user_id,
                    name,
                    letter,
                    masked: self.game.masked(),
                    remaining: self.game.remaining_lives() as u8,
                }
            }
            HangmanEvent::Miss {
                user_id,
                name,
                letter,
                remaining,
            } => {
                self.rearm(now_ms);
                HangmanDriverAction::Miss {
                    user_id,
                    name,
                    letter,
                    masked: self.game.masked(),
                    remaining,
                }
            }
            HangmanEvent::Won {
                user_id,
                name,
                word,
            } => {
                self.deadline_ms = None;
                HangmanDriverAction::Won {
                    user_id,
                    name,
                    word,
                    masked: self.game.masked(),
                }
            }
            HangmanEvent::Lost { word } => {
                self.deadline_ms = None;
                HangmanDriverAction::Lost {
                    word,
                    masked: self.game.masked(),
                }
            }
            HangmanEvent::WrongWord => HangmanDriverAction::WrongWord,
            HangmanEvent::AlreadyTried => HangmanDriverAction::AlreadyTried,
            HangmanEvent::Invalid | HangmanEvent::Closed => HangmanDriverAction::Ignored,
        }
    }

    pub fn tick(&mut self, now_ms: i64) -> HangmanDriverAction {
        let Some(deadline) = self.deadline_ms else {
            return HangmanDriverAction::Ignored;
        };
        if now_ms < deadline {
            return HangmanDriverAction::Ignored;
        }
        self.deadline_ms = None;
        HangmanDriverAction::Idle {
            word: self.game.word().to_owned(),
            masked: self.game.masked(),
        }
    }

    fn rearm(&mut self, now_ms: i64) {
        self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    #[test]
    fn starts_with_mask_and_rearms_idle_after_valid_move() {
        let mut driver = HangmanDriver::new("cat");
        assert_eq!(
            driver.start(1_000),
            HangmanDriverAction::Intro {
                masked: "_ _ _".into(),
                remaining: 6,
            }
        );
        assert_eq!(driver.deadline_ms(), Some(181_000));
        assert!(matches!(
            driver.guess(10_000, "u", "Rexy", "a"),
            HangmanDriverAction::Hit { letter: 'a', .. }
        ));
        assert_eq!(driver.deadline_ms(), Some(190_000));
        assert_eq!(driver.tick(189_999), HangmanDriverAction::Ignored);
        assert!(matches!(
            driver.tick(190_000),
            HangmanDriverAction::Idle { word, .. } if word == "cat"
        ));
    }

    #[test]
    fn wrong_word_does_not_rearm_idle_and_win_awards_and_finishes() {
        let mut driver = HangmanDriver::new("cat");
        let _ = driver.start(0);
        assert_eq!(
            driver.guess(1_000, "u", "Rexy", "dog"),
            HangmanDriverAction::WrongWord
        );
        assert_eq!(driver.deadline_ms(), Some(180_000));
        assert!(matches!(
            to_manager_actions(driver.guess(2_000, "u", "Rexy", "cat")).as_slice(),
            [
                GameDriverAction::Award { user_id, points: 1 },
                GameDriverAction::Hangman(HangmanDriverAction::Won { .. }),
                GameDriverAction::Finished
            ] if user_id == "u"
        ));
        assert_eq!(driver.deadline_ms(), None);
    }

    #[test]
    fn manager_adapter_finishes_on_idle() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "hangman".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: false,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) =
            manager.start_at(session, Box::new(HangmanGameDriver::new("cat")), 5_000);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::Hangman(HangmanDriverAction::Intro { .. })]
        ));
        assert!(matches!(
            manager.advance(185_000).as_slice(),
            [GameManagerEvent::Finished { session, .. }] if session.scores.is_empty()
        ));
        assert!(!manager.active("guild"));
    }
}
