//! Pure state for the five-round spoken arithmetic game.
//!
//! Numbers and seeded generation preserve the public game contract; localization and voice delivery stay
//! in the adapter layer.

const ROUNDS: u8 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MathOperation {
    Plus,
    Minus,
    Times,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MathProblem {
    pub a: u32,
    pub b: u32,
    pub operation: MathOperation,
    pub result: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MathGuessResult {
    Accepted,
    Wrong,
    Invalid,
    Closed,
}

#[derive(Debug)]
pub struct MathGame {
    problems: [MathProblem; ROUNDS as usize],
    round: u8,
    open: bool,
    finished: bool,
}

impl MathGame {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        let mut rng = XorShift::new(seed);
        let mut problems = [MathProblem {
            a: 0,
            b: 0,
            operation: MathOperation::Plus,
            result: 0,
        }; ROUNDS as usize];
        for problem in &mut problems {
            *problem = generate_problem(&mut rng);
        }
        Self {
            problems,
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
    pub fn problem(&self) -> Option<MathProblem> {
        (self.round > 0 && self.round <= ROUNDS).then(|| self.problems[(self.round - 1) as usize])
    }

    #[must_use]
    pub fn begin_round(&mut self) -> Option<MathProblem> {
        if self.finished || self.round >= ROUNDS {
            self.finished = true;
            self.open = false;
            return None;
        }
        self.round += 1;
        self.open = true;
        self.problem()
    }

    #[must_use]
    pub fn guess(&mut self, raw: &str) -> MathGuessResult {
        if !self.open {
            return MathGuessResult::Closed;
        }
        let Some(answer) = first_integer(raw) else {
            return MathGuessResult::Invalid;
        };
        let expected = self.problem().expect("open round has a problem").result as i64;
        if answer != expected {
            return MathGuessResult::Wrong;
        }
        self.open = false;
        MathGuessResult::Accepted
    }

    pub fn timeout(&mut self) -> bool {
        if !self.open {
            return false;
        }
        self.open = false;
        true
    }

    #[must_use]
    pub fn is_open(&self) -> bool {
        self.open
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

fn generate_problem(rng: &mut XorShift) -> MathProblem {
    match rng.next() % 3 {
        0 => {
            let a = rng.next() % 40 + 10;
            let b = rng.next() % 40 + 10;
            MathProblem {
                a,
                b,
                operation: MathOperation::Plus,
                result: a + b,
            }
        }
        1 => {
            let a = rng.next() % 40 + 20;
            let b = rng.next() % a;
            MathProblem {
                a,
                b,
                operation: MathOperation::Minus,
                result: a - b,
            }
        }
        _ => {
            let a = rng.next() % 11 + 2;
            let b = rng.next() % 11 + 2;
            MathProblem {
                a,
                b,
                operation: MathOperation::Times,
                result: a * b,
            }
        }
    }
}

/// Returns the first signed integer, matching the Node `/\-?\d+/` answer rule.
#[must_use]
pub fn first_integer(input: &str) -> Option<i64> {
    let bytes = input.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        let start = index;
        if bytes[index] == b'-' {
            index += 1;
        }
        let digits = index;
        while index < bytes.len() && bytes[index].is_ascii_digit() {
            index += 1;
        }
        if index > digits {
            return input[start..index].parse().ok();
        }
        index = start + 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generation_is_seeded_and_problems_open_in_order() {
        let first = MathGame::new(42);
        let second = MathGame::new(42);
        assert_eq!(first.problems, second.problems);
        let mut game = first;
        assert_eq!(game.begin_round(), Some(game.problems[0]));
        assert!(game.is_open());
        assert_eq!(game.guess("not a number"), MathGuessResult::Invalid);
        assert_eq!(game.guess("wrong 0"), MathGuessResult::Wrong);
        let answer = game.problem().expect("problem").result;
        assert_eq!(
            game.guess(&format!("= {answer}")),
            MathGuessResult::Accepted
        );
        assert_eq!(game.guess(&answer.to_string()), MathGuessResult::Closed);
    }

    #[test]
    fn first_integer_matches_tolerant_chat_answers() {
        assert_eq!(first_integer("= 51"), Some(51));
        assert_eq!(first_integer("answer: -4"), Some(-4));
        assert_eq!(first_integer("hello"), None);
    }
}
