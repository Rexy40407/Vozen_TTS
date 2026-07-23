//! Transport-free adapter for the two-player Tic-Tac-Toe game.

use vozen_core::{Mark, TicTacToeGame, TicTacToeMove};

use crate::{GameDriver, GameDriverAction, GameMessage};

const IDLE_MS: i64 = 180_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TicTacToeDriverAction {
    Intro {
        board: [Option<Mark>; 9],
    },
    NotYourTurn {
        user_id: String,
        name: String,
        expected: Mark,
    },
    Taken {
        cell: u8,
    },
    Accepted {
        user_id: String,
        name: String,
        mark: Mark,
        cell: u8,
        board: [Option<Mark>; 9],
        next: Option<Mark>,
    },
    Won {
        user_id: String,
        name: String,
        mark: Mark,
        cell: u8,
        board: [Option<Mark>; 9],
    },
    Draw {
        board: [Option<Mark>; 9],
    },
    Idle {
        board: [Option<Mark>; 9],
    },
    Ignored,
}

#[derive(Debug)]
pub struct TicTacToeDriver {
    game: TicTacToeGame,
    deadline_ms: Option<i64>,
}

pub struct TicTacToeGameDriver {
    inner: TicTacToeDriver,
}

impl TicTacToeGameDriver {
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: TicTacToeDriver::new(),
        }
    }

    #[must_use]
    pub fn inner(&self) -> &TicTacToeDriver {
        &self.inner
    }
}

impl Default for TicTacToeGameDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl GameDriver for TicTacToeGameDriver {
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

fn to_manager_actions(action: TicTacToeDriverAction) -> Vec<GameDriverAction> {
    let score = match &action {
        TicTacToeDriverAction::Won { user_id, .. } => Some(user_id.clone()),
        _ => None,
    };
    let finished = matches!(
        action,
        TicTacToeDriverAction::Won { .. }
            | TicTacToeDriverAction::Draw { .. }
            | TicTacToeDriverAction::Idle { .. }
    );
    let mut actions = vec![GameDriverAction::TicTacToe(action)];
    if let Some(user_id) = score {
        actions.insert(0, GameDriverAction::Award { user_id, points: 1 });
    }
    if finished {
        actions.push(GameDriverAction::Finished);
    }
    actions
}

impl TicTacToeDriver {
    #[must_use]
    pub fn new() -> Self {
        Self {
            game: TicTacToeGame::new(),
            deadline_ms: None,
        }
    }

    #[must_use]
    pub fn deadline_ms(&self) -> Option<i64> {
        self.deadline_ms
    }

    #[must_use]
    pub fn game(&self) -> &TicTacToeGame {
        &self.game
    }

    pub fn start(&mut self, now_ms: i64) -> TicTacToeDriverAction {
        self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
        TicTacToeDriverAction::Intro {
            board: self.game.board().to_owned(),
        }
    }

    pub fn play(
        &mut self,
        now_ms: i64,
        user_id: &str,
        name: &str,
        raw: &str,
    ) -> TicTacToeDriverAction {
        match self.game.play(user_id, raw) {
            TicTacToeMove::Ignored => TicTacToeDriverAction::Ignored,
            TicTacToeMove::NotYourTurn { expected } => TicTacToeDriverAction::NotYourTurn {
                user_id: user_id.to_owned(),
                name: name.to_owned(),
                expected,
            },
            TicTacToeMove::Taken { cell } => TicTacToeDriverAction::Taken { cell },
            TicTacToeMove::Accepted {
                mark,
                cell,
                winner_user_id,
                draw,
            } => {
                self.deadline_ms = None;
                let board = self.game.board().to_owned();
                if let Some(winner_user_id) = winner_user_id {
                    return TicTacToeDriverAction::Won {
                        user_id: winner_user_id,
                        name: name.to_owned(),
                        mark,
                        cell,
                        board,
                    };
                }
                if draw {
                    return TicTacToeDriverAction::Draw { board };
                }
                self.deadline_ms = Some(now_ms.saturating_add(IDLE_MS));
                TicTacToeDriverAction::Accepted {
                    user_id: user_id.to_owned(),
                    name: name.to_owned(),
                    mark,
                    cell,
                    board,
                    next: Some(self.game.turn()),
                }
            }
        }
    }

    pub fn tick(&mut self, now_ms: i64) -> TicTacToeDriverAction {
        let Some(deadline) = self.deadline_ms else {
            return TicTacToeDriverAction::Ignored;
        };
        if now_ms < deadline {
            return TicTacToeDriverAction::Ignored;
        }
        self.deadline_ms = None;
        TicTacToeDriverAction::Idle {
            board: self.game.board().to_owned(),
        }
    }
}

impl Default for TicTacToeDriver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameManager, GameManagerEvent, GameSession, StartGameResult};

    #[test]
    fn seats_players_preserves_turns_and_rearms_only_after_accepted_move() {
        let mut driver = TicTacToeDriver::new();
        assert!(matches!(
            driver.start(1_000),
            TicTacToeDriverAction::Intro { board } if board.iter().all(Option::is_none)
        ));
        assert!(matches!(
            driver.play(10_000, "x", "X", "1"),
            TicTacToeDriverAction::Accepted {
                mark: Mark::X,
                next: Some(Mark::O),
                ..
            }
        ));
        assert_eq!(driver.deadline_ms(), Some(190_000));
        assert!(matches!(
            driver.play(11_000, "x", "X", "2"),
            TicTacToeDriverAction::NotYourTurn {
                expected: Mark::O,
                ..
            }
        ));
        assert_eq!(driver.deadline_ms(), Some(190_000));
    }

    #[test]
    fn winner_awards_and_draw_finishes_without_a_score() {
        let mut driver = TicTacToeDriver::new();
        let _ = driver.start(0);
        for (user, name, cell) in [
            ("x", "X", "1"),
            ("o", "O", "4"),
            ("x", "X", "2"),
            ("o", "O", "5"),
        ] {
            let _ = driver.play(1_000, user, name, cell);
        }
        assert!(matches!(
            to_manager_actions(driver.play(2_000, "x", "X", "3")).as_slice(),
            [
                GameDriverAction::Award { user_id, points: 1 },
                GameDriverAction::TicTacToe(TicTacToeDriverAction::Won { mark: Mark::X, .. }),
                GameDriverAction::Finished
            ] if user_id == "x"
        ));
        assert_eq!(driver.deadline_ms(), None);
    }

    #[test]
    fn manager_adapter_finishes_on_idle() {
        let mut manager = GameManager::new();
        let session = GameSession {
            guild_id: "guild".into(),
            channel_id: "game".into(),
            game_id: "tictactoe".into(),
            starter_id: "starter".into(),
            locale: "en".into(),
            needs_voice: false,
            parent_channel_id: None,
            scores: Vec::new(),
        };
        let (status, initial) =
            manager.start_at(session, Box::new(TicTacToeGameDriver::new()), 5_000);
        assert_eq!(status, StartGameResult::Started);
        assert!(matches!(
            initial.as_slice(),
            [GameDriverAction::TicTacToe(
                TicTacToeDriverAction::Intro { .. }
            )]
        ));
        assert!(matches!(
            manager.advance(185_000).as_slice(),
            [GameManagerEvent::Finished { session }] if session.scores.is_empty()
        ));
    }
}
