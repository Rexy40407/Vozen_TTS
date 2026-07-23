//! Pure state machine for the five-round Heads-or-Tails game.
//!
//! Timers, Discord messages and speech are deliberately injected by the runtime. This module
//! owns only answer parsing, one-guess-per-round, deterministic coin flips and local scoring.

const ROUNDS: u8 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoinSide {
    Heads,
    Tails,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameWinner {
    pub user_id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoinReveal {
    pub side: CoinSide,
    pub winners: Vec<GameWinner>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GuessResult {
    Accepted,
    Duplicate,
    Closed,
    Invalid,
}

#[derive(Debug, Default)]
pub struct HeadsOrTailsGame {
    round: u8,
    open: bool,
    finished: bool,
    guesses: Vec<(String, String, CoinSide)>,
    scores: Vec<(String, i64)>,
    rng_state: u32,
}

impl HeadsOrTailsGame {
    pub fn new(seed: i64) -> Self {
        let seed = seed as i32;
        Self {
            rng_state: if seed == 0 { 0x9e37_79b9 } else { seed as u32 },
            ..Self::default()
        }
    }

    pub fn rounds() -> u8 {
        ROUNDS
    }

    pub fn round(&self) -> u8 {
        self.round
    }

    pub fn is_open(&self) -> bool {
        self.open
    }

    pub fn is_finished(&self) -> bool {
        self.finished
    }

    /// Opens the next round. `None` means all five rounds have already completed.
    pub fn begin_round(&mut self) -> Option<u8> {
        if self.finished || self.round >= ROUNDS {
            self.finished = true;
            self.open = false;
            return None;
        }
        self.round += 1;
        self.open = true;
        self.guesses.clear();
        Some(self.round)
    }

    pub fn guess(&mut self, user_id: &str, name: &str, raw: &str) -> GuessResult {
        let Some(side) = parse_coin_side(raw) else {
            return GuessResult::Invalid;
        };
        if !self.open {
            return GuessResult::Closed;
        }
        if self.guesses.iter().any(|(id, _, _)| id == user_id) {
            return GuessResult::Duplicate;
        }
        self.guesses
            .push((user_id.to_owned(), name.to_owned(), side));
        GuessResult::Accepted
    }

    /// Closes the current round and awards one point to every correct guess.
    pub fn reveal(&mut self) -> Option<CoinReveal> {
        if !self.open {
            return None;
        }
        self.open = false;
        let side = if self.next_random().is_multiple_of(2) {
            CoinSide::Heads
        } else {
            CoinSide::Tails
        };
        let mut winners = Vec::new();
        for (user_id, name, guess) in &self.guesses {
            if *guess == side {
                if let Some((_, points)) = self.scores.iter_mut().find(|(id, _)| id == user_id) {
                    *points += 1;
                } else {
                    self.scores.push((user_id.clone(), 1));
                }
                winners.push(GameWinner {
                    user_id: user_id.clone(),
                    name: name.clone(),
                });
            }
        }
        Some(CoinReveal { side, winners })
    }

    pub fn scores(&self) -> impl Iterator<Item = (&str, i64)> {
        self.scores
            .iter()
            .map(|(id, points)| (id.as_str(), *points))
    }

    fn next_random(&mut self) -> u32 {
        let mut state = self.rng_state as i32;
        state ^= state.wrapping_shl(13);
        state ^= state.wrapping_shr(17);
        state ^= state.wrapping_shl(5);
        self.rng_state = state as u32;
        state.unsigned_abs()
    }
}

pub fn parse_coin_side(raw: &str) -> Option<CoinSide> {
    match raw.trim().to_lowercase().as_str() {
        "heads" | "head" | "h" | "cara" | "cabeça" | "cabeca" => Some(CoinSide::Heads),
        "tails" | "tail" | "t" | "coroa" | "cruz" => Some(CoinSide::Tails),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_multilingual_guesses_once_per_round_and_ignores_chatter() {
        let mut game = HeadsOrTailsGame::new(42);
        assert_eq!(game.begin_round(), Some(1));
        assert_eq!(game.guess("u1", "Ana", "CABEÇA"), GuessResult::Accepted);
        assert_eq!(game.guess("u1", "Ana", "tails"), GuessResult::Duplicate);
        assert_eq!(game.guess("u2", "Kai", "hello"), GuessResult::Invalid);
        assert!(game.reveal().is_some());
        assert_eq!(game.guess("u3", "Lee", "heads"), GuessResult::Closed);
    }

    #[test]
    fn runs_exactly_five_rounds_and_scores_every_correct_player() {
        let mut game = HeadsOrTailsGame::new(7);
        for _ in 0..HeadsOrTailsGame::rounds() {
            assert!(game.begin_round().is_some());
            let _ = game.guess("u1", "Ana", "heads");
            let _ = game.guess("u2", "Kai", "tails");
            assert!(game.reveal().is_some());
        }
        assert_eq!(game.begin_round(), None);
        assert!(game.is_finished());
        let scores = game.scores().collect::<Vec<_>>();
        assert!(scores.iter().all(|(_, points)| *points > 0));
    }
}
