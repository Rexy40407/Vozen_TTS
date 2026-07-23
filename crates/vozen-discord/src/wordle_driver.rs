//! Transport-free adapter for the collaborative Wordle game.
//!
//! The core owns repeated-letter accounting and attempt limits. This layer exposes the complete
//! grid/keyboard state needed for Discord rendering and applies the same three-minute idle end
//! used by the Node game.

use vozen_core::{WordleEvent, WordleGame, WordleRow};

use crate::{GameDriver, GameDriverAction, GameMessage};

const IDLE_MS: i64 = 180_000;
const MAX_GUESSES: u8 = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WordleDriverAction {
    Intro {
        max_guesses: u8,
    },
    Guess {
        user_id: String,
        name: String,
        row: WordleRow,
        rows: Vec<WordleRow>,
        guesses_left: u8,
        present: Vec<char>,
        absent: Vec<char>,
    },
    Won {
        user_id: String,
        name: String,
        word: String,
        row: WordleRow,
        rows: Vec<WordleRow>,
        guesses: u8,
    },
    Lost {
        word: String,
        row: WordleRow,
        rows: Vec<WordleRow>,
    },
    Idle {
        word: String,
        rows: Vec<WordleRow>,
    },
    Invalid,
    Ignored,
}

#[derive(Debug)]
pub struct WordleDriver {
    game: WordleGame,
    deadline_ms: Option<i64>,
}

/// Adapter that lets [`WordleDriver`] run inside the generic game lifecycle.
pub struct WordleGameDriver {
    inner: WordleDriver,
}

impl WordleGameDriver {
    #[must_use]
    pub fn new(target: &str) -> Self {
        Self {
            inner: WordleDriver::new(target),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &WordleDriver {
        &self.inner
    }
}

impl GameDriver for WordleGameDriver {
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

fn to_manager_actions(action: WordleDriverAction) -> Vec<GameDriverAction> {
    let score = match &action {
        WordleDriverAction::Won { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(
        action,
        WordleDriverAction::Won { .. }
            | WordleDriverAction::Lost { .. }
            | WordleDriverAction::Idle { .. }
    );
    let mut actions = vec![GameDriverAction::Wordle(action)];
    if let Some(user_id) = score {
        actions.insert(0, GameDriverAction::Award { user_id, points: 1 });
    }
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl WordleDriver {
    #[must_use]
    pub fn new(target: &str) -> Self {
        Self {
            game: WordleGame::new(target),
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    #[must_use]
    pub fn game(&self) -> &WordleGame {
        &self.game
    }

    pub fn start(&mut self, now_ms: i64) -> WordleDriverAction {
        self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
        WordleDriverAction::Intro {
            max_guesses: MAX_GUESSES,
        }
    }

    pub fn guess(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> WordleDriverAction {
        match self.game.guess(user_id, name, raw) {
            WordleEvent::Guess {
                user_id,
                name,
                row,
                guesses_left,
            } => {
                self.rearm(now_ms);
                WordleDriverAction::Guess {
                    user_id,
                    name,
                    row,
                    rows: self.game.rows().to_vec(),
                    guesses_left,
                    present: self.game.present_letters().iter().copied().collect(),
                    absent: self.game.absent_letters().iter().copied().collect(),
                }
            }
            WordleEvent::Won {
                user_id,
                name,
                word,
                row,
                guesses,
            } => {
                self.deadline_ms = None;
                WordleDriverAction::Won {
                    user_id,
                    name,
                    word,
                    row,
                    rows: self.game.rows().to_vec(),
                    guesses,
                }
            }
            WordleEvent::Lost { word, row } => {
                self.deadline_ms = None;
                WordleDriverAction::Lost {
                    word,
                    row,
                    rows: self.game.rows().to_vec(),
                }
            }
            WordleEvent::Invalid => WordleDriverAction::Invalid,
            WordleEvent::Closed => WordleDriverAction::Ignored,
        }
    }

    pub fn tick(&mut self, now_ms: i64) -> WordleDriverAction {
        let Some(deadline) = self.deadline_ms else {
            return WordleDriverAction::Ignored;
        };
        if now_ms < deadline {
            return WordleDriverAction::Ignored;
        }
        self.deadline_ms = None;
        WordleDriverAction::Idle {
            word: self.game.target().to_owned(),
            rows: self.game.rows().to_vec(),
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
    fn starts_and_rearms_idle_after_a_valid_guess() {
        let mut driver = WordleDriver::new("apple");
        assert_eq!(
            driver.start(1_000),
            WordleDriverAction::Intro { max_guesses: 8 }
        );
        assert_eq!(driver.deadline_ms(), Some(181_000));
        assert!(matches!(
            driver.guess(10_000, "u", "Rexy", "allee"),
            WordleDriverAction::Guess {
                guesses_left: 7,
                rows,
                ..
            } if rows.len() == 1
        ));
        assert_eq!(driver.deadline_ms(), Some(190_000));
        assert_eq!(driver.tick(189_999), WordleDriverAction::Ignored);
        assert!(matches!(
            driver.tick(190_000),
            WordleDriverAction::Idle { word, rows } if word == "apple" && rows.len() == 1
        ));
    }

    #[test]
    fn winning_guess_awards_and_finishes_with_complete_grid() {
        let mut driver = WordleDriver::new("crane");
        let _ = driver.start(0);
        assert!(matches!(
            to_manager_actions(driver.guess(1_000, "u", "Rexy", "crane")).as_slice(),
            [
                GameDriverAction::Award { user_id, points: 1 },
                GameDriverAction::Wordle(WordleDriverAction::Won { guesses: 1, rows, .. }),
                GameDriverAction::Finished
            ] if user_id == "u" && rows.len() == 1
        ));
        assert_eq!(driver.deadline_ms(), None);
    }

    #[test]
    fn manager_adapter_finishes_after_eight_guesses() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "wordle".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: false,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) =
            manager.start_at(session, Box::new(WordleGameDriver::new("apple")), 5_000);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::Wordle(WordleDriverAction::Intro {
                max_guesses: 8
            })]
        ));
        for _ in 0..7 {
            let _ = manager.handle_message_at(
                &GameMessage {
                    guild_id: "guild".into(),
                    channel_id: "game".into(),
                    author_id: "u".into(),
                    author_name: "Rexy".into(),
                    content: "zzzzz".into(),
                    can_trigger_speech: false,
                },
                1_000,
            );
        }
        assert!(matches!(
            manager.handle_message_at(
                &GameMessage {
                    guild_id: "guild".into(),
                    channel_id: "game".into(),
                    author_id: "u".into(),
                    author_name: "Rexy".into(),
                    content: "zzzzz".into(),
                    can_trigger_speech: false,
                },
                2_000,
            ),
            Some(GameManagerEvent::Finished { session, .. })
                if session.scores.is_empty()
        ));
        assert!(!manager.active("guild"));
    }
}
