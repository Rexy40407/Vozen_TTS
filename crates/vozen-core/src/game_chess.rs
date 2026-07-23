//! Pure state and move validation for the two-player Chess game.
//!
//! `chess.js` is the Node authority today. Rust uses an equivalent legal-move generator rather
//! than accepting coordinates as if they were valid. Discord rendering, idle timers and scoring
//! remain adapter concerns.

use chess::{ChessMove, Color, Game, Piece, Square};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChessColor {
    White,
    Black,
}

impl ChessColor {
    fn as_chess(self) -> Color {
        match self {
            Self::White => Color::White,
            Self::Black => Color::Black,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChessEvent {
    Ignored,
    Closed,
    Spectator,
    NotYourTurn {
        color: ChessColor,
    },
    IllegalMove {
        text: String,
    },
    Moved {
        user_id: String,
        name: String,
        text: String,
        next: ChessColor,
        in_check: bool,
    },
    Checkmate {
        winner_id: String,
        winner_name: String,
        text: String,
    },
    Draw {
        text: String,
    },
    Resigned {
        user_id: String,
        user_name: String,
        winner_id: String,
        winner_name: String,
    },
}

#[derive(Debug, Clone)]
pub struct ChessGame {
    game: Game,
    white_id: Option<String>,
    black_id: Option<String>,
    white_name: Option<String>,
    black_name: Option<String>,
    over: bool,
}

impl Default for ChessGame {
    fn default() -> Self {
        Self::new()
    }
}

impl ChessGame {
    #[must_use]
    pub fn new() -> Self {
        Self {
            game: Game::new(),
            white_id: None,
            black_id: None,
            white_name: None,
            black_name: None,
            over: false,
        }
    }

    #[must_use]
    pub fn is_over(&self) -> bool {
        self.over
    }

    #[must_use]
    pub fn white_id(&self) -> Option<&str> {
        self.white_id.as_deref()
    }

    #[must_use]
    pub fn black_id(&self) -> Option<&str> {
        self.black_id.as_deref()
    }

    #[must_use]
    pub fn turn(&self) -> ChessColor {
        chess_color(self.game.side_to_move())
    }

    /// Current board position in standard FEN form for a transport/rendering adapter. Keeping
    /// this as a value snapshot avoids exposing the third-party chess board type across crates.
    #[must_use]
    pub fn board_fen(&self) -> String {
        self.game.current_position().to_string()
    }

    /// Applies a move or resignation. The first two distinct users who submit a valid-looking
    /// move take White and Black, matching the Node game; later users become spectators.
    #[must_use]
    pub fn play(&mut self, user_id: &str, name: &str, raw: &str) -> ChessEvent {
        if self.over {
            return ChessEvent::Closed;
        }
        let text = raw.trim();
        if is_resignation(text) {
            return self.resign(user_id, name);
        }
        if !looks_like_move(text) {
            return ChessEvent::Ignored;
        }

        let Some(color) = self.seat(user_id, name) else {
            return ChessEvent::Spectator;
        };
        let turn = self.game.side_to_move();
        if color.as_chess() != turn {
            return ChessEvent::NotYourTurn {
                color: chess_color(turn),
            };
        }
        let Some(chess_move) = parse_move(&self.game.current_position(), text) else {
            return ChessEvent::IllegalMove {
                text: text.to_owned(),
            };
        };
        if !self.game.make_move(chess_move) {
            return ChessEvent::IllegalMove {
                text: text.to_owned(),
            };
        }
        match self.game.result() {
            Some(chess::GameResult::WhiteCheckmates | chess::GameResult::BlackCheckmates) => {
                self.over = true;
                let (winner_id, winner_name) = if color == ChessColor::White {
                    (
                        self.white_id.clone().unwrap_or_default(),
                        self.white_name.clone().unwrap_or_default(),
                    )
                } else {
                    (
                        self.black_id.clone().unwrap_or_default(),
                        self.black_name.clone().unwrap_or_default(),
                    )
                };
                ChessEvent::Checkmate {
                    winner_id,
                    winner_name,
                    text: text.to_owned(),
                }
            }
            Some(
                chess::GameResult::Stalemate
                | chess::GameResult::DrawAccepted
                | chess::GameResult::DrawDeclared,
            ) => {
                self.over = true;
                ChessEvent::Draw {
                    text: text.to_owned(),
                }
            }
            Some(chess::GameResult::WhiteResigns | chess::GameResult::BlackResigns) | None => {
                ChessEvent::Moved {
                    user_id: user_id.to_owned(),
                    name: name.to_owned(),
                    text: text.to_owned(),
                    next: chess_color(self.game.side_to_move()),
                    in_check: self.game.current_position().checkers().popcnt() > 0,
                }
            }
        }
    }

    fn seat(&mut self, user_id: &str, name: &str) -> Option<ChessColor> {
        if self.white_id.as_deref() == Some(user_id) {
            self.white_name = Some(name.to_owned());
            return Some(ChessColor::White);
        }
        if self.black_id.as_deref() == Some(user_id) {
            self.black_name = Some(name.to_owned());
            return Some(ChessColor::Black);
        }
        if self.white_id.is_none() {
            self.white_id = Some(user_id.to_owned());
            self.white_name = Some(name.to_owned());
            return Some(ChessColor::White);
        }
        if self.black_id.is_none() {
            self.black_id = Some(user_id.to_owned());
            self.black_name = Some(name.to_owned());
            return Some(ChessColor::Black);
        }
        None
    }

    fn resign(&mut self, user_id: &str, user_name: &str) -> ChessEvent {
        let Some(color) = self.color_of(user_id) else {
            return ChessEvent::Ignored;
        };
        let (Some(white), Some(black)) = (&self.white_id, &self.black_id) else {
            return ChessEvent::Ignored;
        };
        let winner_id = if color == ChessColor::White {
            black.clone()
        } else {
            white.clone()
        };
        let winner_name = if color == ChessColor::White {
            self.black_name.clone().unwrap_or_default()
        } else {
            self.white_name.clone().unwrap_or_default()
        };
        if !self.game.resign(color.as_chess()) {
            return ChessEvent::Ignored;
        }
        self.over = true;
        ChessEvent::Resigned {
            user_id: user_id.to_owned(),
            user_name: user_name.to_owned(),
            winner_id,
            winner_name,
        }
    }

    fn color_of(&self, user_id: &str) -> Option<ChessColor> {
        if self.white_id.as_deref() == Some(user_id) {
            Some(ChessColor::White)
        } else if self.black_id.as_deref() == Some(user_id) {
            Some(ChessColor::Black)
        } else {
            None
        }
    }
}

fn chess_color(color: Color) -> ChessColor {
    match color {
        Color::White => ChessColor::White,
        Color::Black => ChessColor::Black,
    }
}

fn is_resignation(text: &str) -> bool {
    matches!(
        text.to_ascii_lowercase().as_str(),
        "resign" | "resigns" | "i resign" | "desisto" | "desistir"
    )
}

fn looks_like_move(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    if (4..=5).contains(&bytes.len())
        && bytes[0].is_ascii_lowercase()
        && (b'1'..=b'8').contains(&bytes[1])
        && bytes[2].is_ascii_lowercase()
        && (b'1'..=b'8').contains(&bytes[3])
    {
        return bytes.len() == 4 || matches!(bytes[4], b'q' | b'r' | b'b' | b'n');
    }
    let normalized = lower.strip_suffix(['+', '#']).unwrap_or(&lower);
    let castle = matches!(normalized, "o-o" | "o-o-o");
    let destination = normalized
        .as_bytes()
        .windows(2)
        .any(|pair| (b'a'..=b'h').contains(&pair[0]) && (b'1'..=b'8').contains(&pair[1]));
    castle || destination
}

fn parse_move(board: &chess::Board, text: &str) -> Option<ChessMove> {
    let lower = text.to_ascii_lowercase();
    let coordinate = lower.as_bytes();
    if (4..=5).contains(&coordinate.len())
        && coordinate[0].is_ascii_lowercase()
        && (b'1'..=b'8').contains(&coordinate[1])
        && coordinate[2].is_ascii_lowercase()
        && (b'1'..=b'8').contains(&coordinate[3])
    {
        let source = Square::from_str(&lower[0..2]).ok()?;
        let dest = Square::from_str(&lower[2..4]).ok()?;
        let promotion = match coordinate.get(4) {
            None => None,
            Some(b'q') => Some(Piece::Queen),
            Some(b'r') => Some(Piece::Rook),
            Some(b'b') => Some(Piece::Bishop),
            Some(b'n') => Some(Piece::Knight),
            Some(_) => return None,
        };
        return Some(ChessMove::new(source, dest, promotion));
    }
    let san = if lower == "o-o" || lower == "o-o-o" {
        text.to_ascii_uppercase()
    } else {
        text.to_owned()
    };
    ChessMove::from_san(board, &san).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_two_players_are_seated_and_turns_are_enforced() {
        let mut game = ChessGame::new();
        assert!(matches!(
            game.play("w", "White", "e2e4"),
            ChessEvent::Moved {
                next: ChessColor::Black,
                ..
            }
        ));
        assert!(matches!(
            game.play("w", "White", "d2d4"),
            ChessEvent::NotYourTurn {
                color: ChessColor::Black
            }
        ));
        assert_eq!(game.white_id(), Some("w"));
        assert!(matches!(
            game.play("b", "Black", "e7e5"),
            ChessEvent::Moved {
                next: ChessColor::White,
                ..
            }
        ));
    }

    #[test]
    fn illegal_move_still_claims_a_seat_but_chat_does_not() {
        let mut game = ChessGame::new();
        assert!(matches!(
            game.play("w", "White", "e2e5"),
            ChessEvent::IllegalMove { .. }
        ));
        assert_eq!(game.white_id(), Some("w"));
        assert!(matches!(
            game.play("chat", "Chat", "hello"),
            ChessEvent::Ignored
        ));
        assert_eq!(game.black_id(), None);
        assert!(matches!(
            game.play("b", "Black", "e7e5"),
            ChessEvent::NotYourTurn {
                color: ChessColor::White
            }
        ));
        assert_eq!(game.black_id(), Some("b"));
    }

    #[test]
    fn illegal_move_does_not_change_board_and_resignation_awards_opponent() {
        let mut game = ChessGame::new();
        assert!(matches!(
            game.play("w", "White", "e2e4"),
            ChessEvent::Moved { .. }
        ));
        assert!(matches!(
            game.play("b", "Black", "e7e5"),
            ChessEvent::Moved { .. }
        ));
        assert!(matches!(
            game.play("w", "White", "e2e5"),
            ChessEvent::IllegalMove { .. }
        ));
        assert!(matches!(
            game.play("w", "White", "resign"),
            ChessEvent::Resigned { winner_id, .. } if winner_id == "b"
        ));
        assert!(game.is_over());
    }

    #[test]
    fn checkmate_is_detected_by_legal_move_generator() {
        let mut game = ChessGame::new();
        for (user, name, move_text) in [
            ("w", "White", "f2f3"),
            ("b", "Black", "e7e5"),
            ("w", "White", "g2g4"),
            ("b", "Black", "d8h4"),
        ] {
            let event = game.play(user, name, move_text);
            if move_text == "d8h4" {
                assert!(matches!(event, ChessEvent::Checkmate { .. }));
            }
        }
        assert!(game.is_over());
    }

    #[test]
    fn check_is_reported_before_checkmate() {
        let mut game = ChessGame::new();
        for (user, name, move_text) in [
            ("w", "White", "e2e4"),
            ("b", "Black", "e7e5"),
            ("w", "White", "d1h5"),
            ("b", "Black", "g7g6"),
            ("w", "White", "h5e5"),
        ] {
            let event = game.play(user, name, move_text);
            if move_text == "h5e5" {
                assert!(matches!(
                    event,
                    ChessEvent::Moved {
                        in_check: true,
                        next: ChessColor::Black,
                        ..
                    }
                ));
            }
        }
    }

    #[test]
    fn exposes_a_stable_fen_snapshot_without_leaking_the_board_type() {
        let game = ChessGame::new();
        assert!(
            game.board_fen()
                .starts_with("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w")
        );
    }
}
