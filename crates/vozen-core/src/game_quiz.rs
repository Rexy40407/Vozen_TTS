//! Shared round lifecycle for voice-to-answer games.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuizAnswer {
    Accepted,
    Wrong,
    Invalid,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QuizRoundOpened {
    pub round: u8,
    pub total: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QuizState {
    total: u8,
    round: u8,
    open: bool,
    finished: bool,
}

impl QuizState {
    #[must_use]
    pub fn new(total: u8) -> Self {
        Self {
            total,
            round: 0,
            open: false,
            finished: total == 0,
        }
    }

    #[must_use]
    pub fn total(&self) -> u8 {
        self.total
    }

    #[must_use]
    pub fn round(&self) -> u8 {
        self.round
    }

    #[must_use]
    pub fn is_open(&self) -> bool {
        self.open
    }

    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.finished
    }

    #[must_use]
    pub fn begin_round(&mut self) -> Option<QuizRoundOpened> {
        if self.finished || self.round >= self.total {
            self.open = false;
            self.finished = true;
            return None;
        }
        self.round += 1;
        self.open = true;
        Some(QuizRoundOpened {
            round: self.round,
            total: self.total,
        })
    }

    /// `correct` is calculated by the game-specific content adapter. Wrong/invalid guesses keep
    /// the round open; the first accepted answer closes it.
    #[must_use]
    pub fn answer(&mut self, correct: Option<bool>) -> QuizAnswer {
        if !self.open {
            return QuizAnswer::Closed;
        }
        match correct {
            None => QuizAnswer::Invalid,
            Some(false) => QuizAnswer::Wrong,
            Some(true) => {
                self.open = false;
                QuizAnswer::Accepted
            }
        }
    }

    /// Closes a live round. The caller can then call `begin_round` immediately, matching the
    /// Node QuizGame timeout path.
    pub fn timeout(&mut self) -> bool {
        if !self.open {
            return false;
        }
        self.open = false;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_correct_answer_closes_only_the_current_round() {
        let mut state = QuizState::new(2);
        assert_eq!(
            state.begin_round(),
            Some(QuizRoundOpened { round: 1, total: 2 })
        );
        assert_eq!(state.answer(None), QuizAnswer::Invalid);
        assert_eq!(state.answer(Some(false)), QuizAnswer::Wrong);
        assert_eq!(state.answer(Some(true)), QuizAnswer::Accepted);
        assert_eq!(state.answer(Some(true)), QuizAnswer::Closed);
        assert!(state.begin_round().is_some());
        assert!(state.timeout());
        assert!(state.begin_round().is_none());
        assert!(state.is_finished());
    }

    #[test]
    fn zero_round_content_is_finished_without_opening() {
        let mut state = QuizState::new(0);
        assert!(state.is_finished());
        assert_eq!(state.begin_round(), None);
    }
}
