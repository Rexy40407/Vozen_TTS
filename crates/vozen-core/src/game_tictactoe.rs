//! Pure Tic-tac-toe board and seat rules.

use crate::first_integer;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Mark {
    #[default]
    X,
    O,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TicTacToeMove {
    Ignored,
    NotYourTurn {
        expected: Mark,
    },
    Taken {
        cell: u8,
    },
    Accepted {
        mark: Mark,
        cell: u8,
        winner_user_id: Option<String>,
        draw: bool,
    },
}

#[derive(Debug, Default)]
pub struct TicTacToeGame {
    cells: [Option<Mark>; 9],
    x_user_id: Option<String>,
    o_user_id: Option<String>,
    turn: Mark,
    over: bool,
    moves: u32,
}

impl TicTacToeGame {
    #[must_use]
    pub fn new() -> Self {
        Self {
            turn: Mark::X,
            ..Self::default()
        }
    }

    #[must_use]
    pub fn board(&self) -> &[Option<Mark>; 9] {
        &self.cells
    }

    #[must_use]
    pub fn turn(&self) -> Mark {
        self.turn
    }

    #[must_use]
    pub fn moves(&self) -> u32 {
        self.moves
    }

    #[must_use]
    pub fn is_over(&self) -> bool {
        self.over
    }

    #[must_use]
    pub fn mark_of(&self, user_id: &str) -> Option<Mark> {
        if self.x_user_id.as_deref() == Some(user_id) {
            Some(Mark::X)
        } else if self.o_user_id.as_deref() == Some(user_id) {
            Some(Mark::O)
        } else {
            None
        }
    }

    /// Applies the first integer in a message, matching the Node game. Seat assignment happens
    /// before turn validation: the first two distinct users who attempt a cell become X and O.
    #[must_use]
    pub fn play(&mut self, user_id: &str, raw: &str) -> TicTacToeMove {
        if self.over {
            return TicTacToeMove::Ignored;
        }
        let Some(cell) = first_integer(raw).and_then(|number| u8::try_from(number).ok()) else {
            return TicTacToeMove::Ignored;
        };
        if !(1..=9).contains(&cell) {
            return TicTacToeMove::Ignored;
        }
        let mark = if let Some(mark) = self.mark_of(user_id) {
            mark
        } else if self.x_user_id.is_none() {
            self.x_user_id = Some(user_id.to_owned());
            Mark::X
        } else if self.o_user_id.is_none() {
            self.o_user_id = Some(user_id.to_owned());
            Mark::O
        } else {
            return TicTacToeMove::Ignored;
        };
        if mark != self.turn {
            return TicTacToeMove::NotYourTurn {
                expected: self.turn,
            };
        }
        let index = (cell - 1) as usize;
        if self.cells[index].is_some() {
            return TicTacToeMove::Taken { cell };
        }
        self.cells[index] = Some(mark);
        self.moves = self.moves.saturating_add(1);
        let winner_user_id = self.winner(mark).map(str::to_owned);
        let draw = winner_user_id.is_none() && self.cells.iter().all(Option::is_some);
        if winner_user_id.is_some() || draw {
            self.over = true;
        } else {
            self.turn = match mark {
                Mark::X => Mark::O,
                Mark::O => Mark::X,
            };
        }
        TicTacToeMove::Accepted {
            mark,
            cell,
            winner_user_id,
            draw,
        }
    }

    fn winner(&self, mark: Mark) -> Option<&str> {
        const LINES: [[usize; 3]; 8] = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
        LINES
            .iter()
            .any(|line| line.iter().all(|index| self.cells[*index] == Some(mark)))
            .then_some(match mark {
                Mark::X => self.x_user_id.as_deref(),
                Mark::O => self.o_user_id.as_deref(),
            })
            .flatten()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seats_two_players_and_rejects_spectators_and_wrong_turns() {
        let mut game = TicTacToeGame::new();
        assert!(matches!(
            game.play("x", "1"),
            TicTacToeMove::Accepted { mark: Mark::X, .. }
        ));
        assert_eq!(
            game.play("x", "2"),
            TicTacToeMove::NotYourTurn { expected: Mark::O }
        );
        assert!(matches!(
            game.play("o", "2"),
            TicTacToeMove::Accepted { mark: Mark::O, .. }
        ));
        assert_eq!(game.play("spectator", "3"), TicTacToeMove::Ignored);
    }

    #[test]
    fn detects_win_draw_and_taken_cells() {
        let mut game = TicTacToeGame::new();
        for (user, cell) in [("x", "1"), ("o", "4"), ("x", "2"), ("o", "5")] {
            assert!(matches!(
                game.play(user, cell),
                TicTacToeMove::Accepted { .. }
            ));
        }
        assert_eq!(game.play("x", "1"), TicTacToeMove::Taken { cell: 1 });
        assert!(matches!(
            game.play("x", "3"),
            TicTacToeMove::Accepted {
                winner_user_id: Some(ref winner),
                draw: false,
                ..
            } if winner == "x"
        ));
        assert!(game.is_over());
        assert_eq!(game.play("o", "6"), TicTacToeMove::Ignored);
    }
}
