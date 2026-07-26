//! Transport-free adapter for the two-player Chess game.

use vozen_core::{ChessColor, ChessEvent, ChessGame};

use crate::{GameDriver, GameDriverAction, GameMessage};

const IDLE_MS: i64 = 300_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChessDriverAction {
    Intro {
        fen: String,
        white_id: Option<String>,
        black_id: Option<String>,
        white_name: Option<String>,
        black_name: Option<String>,
    },
    NotYourTurn {
        user_id: String,
        name: String,
        color: ChessColor,
    },
    IllegalMove {
        text: String,
        fen: String,
    },
    Spectator,
    Moved {
        user_id: String,
        name: String,
        text: String,
        next: ChessColor,
        in_check: bool,
        fen: String,
        white_name: Option<String>,
        black_name: Option<String>,
    },
    Checkmate {
        winner_id: String,
        winner_name: String,
        text: String,
        fen: String,
        white_name: Option<String>,
        black_name: Option<String>,
    },
    Draw {
        text: String,
        fen: String,
        white_id: Option<String>,
        black_id: Option<String>,
        white_name: Option<String>,
        black_name: Option<String>,
    },
    Resigned {
        user_id: String,
        user_name: String,
        winner_id: String,
        winner_name: String,
        fen: String,
    },
    Idle {
        fen: String,
    },
    Ignored,
}

#[derive(Debug)]
pub struct ChessDriver {
    game: ChessGame,
    deadline_ms: Option<i64>,
}

pub struct ChessGameDriver {
    inner: ChessDriver,
}

impl ChessGameDriver {
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: ChessDriver::new(),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &ChessDriver {
        &self.inner
    }
}

impl Default for ChessGameDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl GameDriver for ChessGameDriver {
    fn on_start(&mut self, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.start(now_ms))
    }

    fn on_message(&mut self, message: &GameMessage) -> Vec<GameDriverAction> {
        self.on_message_at(message, 0)
    }

    fn on_message_at(&mut self, message: &GameMessage, now_ms: i64) -> Vec<GameDriverAction> {
        to_manager_actions(self.inner.play(
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

fn to_manager_actions(action: ChessDriverAction) -> Vec<GameDriverAction> {
    let (awards, finished) = match &action {
        ChessDriverAction::Checkmate { winner_id, .. }
        | ChessDriverAction::Resigned { winner_id, .. } => (vec![(winner_id.clone(), 3)], true),
        ChessDriverAction::Draw {
            white_id, black_id, ..
        } => (
            white_id
                .iter()
                .chain(black_id.iter())
                .map(|user_id| (user_id.clone(), 1))
                .collect(),
            true,
        ),
        ChessDriverAction::Idle { .. } => (Vec::new(), true),
        _ => (Vec::new(), false),
    };
    let mut actions = awards
        .into_iter()
        .map(|(user_id, points)| GameDriverAction::Award { user_id, points })
        .collect::<Vec<_>>();
    actions.push(GameDriverAction::Chess(action));
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl ChessDriver {
    #[must_use]
    pub fn new() -> Self {
        Self {
            game: ChessGame::new(),
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    #[must_use]
    pub fn game(&self) -> &ChessGame {
        &self.game
    }

    pub fn start(&mut self, now_ms: i64) -> ChessDriverAction {
        self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
        ChessDriverAction::Intro {
            fen: self.game.board_fen(),
            white_id: self.game.white_id().map(str::to_owned),
            black_id: self.game.black_id().map(str::to_owned),
            white_name: self.game.white_name().map(str::to_owned),
            black_name: self.game.black_name().map(str::to_owned),
        }
    }

    pub fn play(&mut self, now_ms: i64, user_id: &str, name: &str, raw: &str) -> ChessDriverAction {
        match self.game.play(user_id, name, raw) {
            ChessEvent::Ignored | ChessEvent::Closed => ChessDriverAction::Ignored,
            ChessEvent::Spectator => ChessDriverAction::Spectator,
            ChessEvent::NotYourTurn { color } => ChessDriverAction::NotYourTurn {
                user_id: user_id.to_owned(),
                name: name.to_owned(),
                color,
            },
            ChessEvent::IllegalMove { text } => ChessDriverAction::IllegalMove {
                text,
                fen: self.game.board_fen(),
            },
            ChessEvent::Moved {
                user_id,
                name,
                text,
                next,
                in_check,
            } => {
                self.rearm(now_ms);
                ChessDriverAction::Moved {
                    user_id,
                    name,
                    text,
                    next,
                    in_check,
                    fen: self.game.board_fen(),
                    white_name: self.game.white_name().map(str::to_owned),
                    black_name: self.game.black_name().map(str::to_owned),
                }
            }
            ChessEvent::Checkmate {
                winner_id,
                winner_name,
                text,
            } => {
                self.deadline_ms = None;
                ChessDriverAction::Checkmate {
                    winner_id,
                    winner_name,
                    text,
                    fen: self.game.board_fen(),
                    white_name: self.game.white_name().map(str::to_owned),
                    black_name: self.game.black_name().map(str::to_owned),
                }
            }
            ChessEvent::Draw { text } => {
                self.deadline_ms = None;
                ChessDriverAction::Draw {
                    text,
                    fen: self.game.board_fen(),
                    white_id: self.game.white_id().map(str::to_owned),
                    black_id: self.game.black_id().map(str::to_owned),
                    white_name: self.game.white_name().map(str::to_owned),
                    black_name: self.game.black_name().map(str::to_owned),
                }
            }
            ChessEvent::Resigned {
                user_id,
                user_name,
                winner_id,
                winner_name,
            } => {
                self.deadline_ms = None;
                ChessDriverAction::Resigned {
                    user_id,
                    user_name,
                    winner_id,
                    winner_name,
                    fen: self.game.board_fen(),
                }
            }
        }
    }

    pub fn tick(&mut self, now_ms: i64) -> ChessDriverAction {
        let Some(deadline) = self.deadline_ms else {
            return ChessDriverAction::Ignored;
        };
        if now_ms < deadline {
            return ChessDriverAction::Ignored;
        }
        self.deadline_ms = None;
        ChessDriverAction::Idle {
            fen: self.game.board_fen(),
        }
    }

    fn rearm(&mut self, now_ms: i64) {
        self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
    }
}

impl Default for ChessDriver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    #[test]
    fn starts_with_fen_and_valid_moves_rearm_the_five_minute_idle_deadline() {
        let mut driver = ChessDriver::new();
        assert!(matches!(
            driver.start(1_000),
            ChessDriverAction::Intro { fen, white_id: None, black_id: None, .. }
                if fen.starts_with("rnbqkbnr/")
        ));
        assert_eq!(driver.deadline_ms(), Some(301_000));
        assert!(matches!(
            driver.play(10_000, "w", "White", "e2e4"),
            ChessDriverAction::Moved {
                next: ChessColor::Black,
                ..
            }
        ));
        assert_eq!(driver.deadline_ms(), Some(310_000));
        assert_eq!(driver.tick(309_999), ChessDriverAction::Ignored);
        assert!(matches!(
            driver.tick(310_000),
            ChessDriverAction::Idle { .. }
        ));
    }

    #[test]
    fn resignation_awards_the_opponent_and_finishes() {
        let mut driver = ChessDriver::new();
        let _ = driver.start(0);
        let _ = driver.play(1_000, "w", "White", "e2e4");
        let _ = driver.play(2_000, "b", "Black", "e7e5");
        assert!(matches!(
            to_manager_actions(driver.play(3_000, "w", "White", "resign")).as_slice(),
            [
                GameDriverAction::Award { user_id, points: 3 },
                GameDriverAction::Chess(ChessDriverAction::Resigned { winner_id, .. }),
                GameDriverAction::Finished
            ] if user_id == "b" && winner_id == "b"
        ));
        assert_eq!(driver.deadline_ms(), None);
    }

    #[test]
    fn draw_awards_both_seated_players_one_point() {
        let actions = to_manager_actions(ChessDriverAction::Draw {
            text: "draw".into(),
            fen: "fen".into(),
            white_id: Some("w".into()),
            black_id: Some("b".into()),
            white_name: Some("White".into()),
            black_name: Some("Black".into()),
        });
        assert!(matches!(
            actions.as_slice(),
            [
                GameDriverAction::Award { user_id: first, points: 1 },
                GameDriverAction::Award { user_id: second, points: 1 },
                GameDriverAction::Chess(ChessDriverAction::Draw { .. }),
                GameDriverAction::Finished
            ] if first == "w" && second == "b"
        ));
    }

    #[test]
    fn manager_adapter_finishes_after_idle_without_a_score() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "chess".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: false,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) = manager.start_at(session, Box::new(ChessGameDriver::new()), 5_000);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::Chess(ChessDriverAction::Intro { .. })]
        ));
        assert!(matches!(
            manager.advance(305_000).as_slice(),
            [GameManagerEvent::Finished { session, .. }] if session.scores.is_empty()
        ));
    }
}
