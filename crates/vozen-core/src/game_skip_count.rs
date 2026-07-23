//! Pure state for the five-round skipped-number game.

use crate::first_integer;

const ROUNDS: u8 = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NumberSequence {
    pub spoken: Vec<u32>,
    pub missing: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkipCountGuessResult {
    Accepted,
    Wrong,
    Invalid,
    Closed,
}

#[derive(Debug)]
pub struct SkipCountGame {
    sequences: Vec<NumberSequence>,
    round: u8,
    open: bool,
    finished: bool,
}

impl SkipCountGame {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        let mut rng = XorShift::new(seed);
        let mut sequences = Vec::with_capacity(ROUNDS as usize);
        for _ in 0..ROUNDS {
            let len = rng.next() % 5 + 7;
            let missing = rng.next() % (len - 2) + 2;
            let spoken = (1..=len).filter(|number| *number != missing).collect();
            sequences.push(NumberSequence { spoken, missing });
        }
        Self {
            sequences,
            round: 0,
            open: false,
            finished: false,
        }
    }

    #[must_use]
    pub fn rounds() -> u8 {
        ROUNDS
    }

    #[must_use]
    pub fn round(&self) -> u8 {
        self.round
    }

    #[must_use]
    pub fn sequence(&self) -> Option<&NumberSequence> {
        (self.round > 0 && self.round <= ROUNDS).then(|| &self.sequences[(self.round - 1) as usize])
    }

    #[must_use]
    pub fn begin_round(&mut self) -> Option<&NumberSequence> {
        if self.finished || self.round >= ROUNDS {
            self.finished = true;
            self.open = false;
            return None;
        }
        self.round += 1;
        self.open = true;
        self.sequence()
    }

    #[must_use]
    pub fn guess(&mut self, raw: &str) -> SkipCountGuessResult {
        if !self.open {
            return SkipCountGuessResult::Closed;
        }
        let Some(answer) = first_integer(raw) else {
            return SkipCountGuessResult::Invalid;
        };
        let missing = self.sequence().expect("open round has a sequence").missing as i64;
        if answer != missing {
            return SkipCountGuessResult::Wrong;
        }
        self.open = false;
        SkipCountGuessResult::Accepted
    }

    pub fn timeout(&mut self) -> bool {
        if !self.open {
            return false;
        }
        self.open = false;
        true
    }

    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.finished
    }
}

#[derive(Debug, Clone, Copy)]
struct XorShift {
    state: i32,
}

impl XorShift {
    fn new(seed: i64) -> Self {
        let state = seed as i32;
        Self {
            state: if state == 0 {
                0x9e37_79b9u32 as i32
            } else {
                state
            },
        }
    }

    fn next(&mut self) -> u32 {
        self.state ^= self.state.wrapping_shl(13);
        self.state ^= self.state.wrapping_shr(17);
        self.state ^= self.state.wrapping_shl(5);
        self.state.unsigned_abs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sequences_are_seeded_and_the_missing_number_is_inside_the_middle() {
        let first = SkipCountGame::new(42);
        let second = SkipCountGame::new(42);
        assert_eq!(first.sequences, second.sequences);
        assert!(first.sequences.iter().all(|sequence| {
            sequence.spoken.len() >= 6
                && sequence.missing >= 2
                && sequence.missing <= sequence.spoken.len() as u32 + 1
                && !sequence.spoken.contains(&sequence.missing)
        }));
    }

    #[test]
    fn accepts_only_the_first_correct_number_until_timeout() {
        let mut game = SkipCountGame::new(9);
        let missing = game.begin_round().expect("round").missing;
        assert_eq!(game.guess("nope"), SkipCountGuessResult::Invalid);
        assert_eq!(game.guess("0"), SkipCountGuessResult::Wrong);
        assert_eq!(
            game.guess(&format!("the answer is {missing}")),
            SkipCountGuessResult::Accepted
        );
        assert_eq!(
            game.guess(&missing.to_string()),
            SkipCountGuessResult::Closed
        );
        assert!(!game.timeout());
    }
}
