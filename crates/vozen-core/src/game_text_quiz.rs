//! Shared state for the text-answer games (spelling, spell-out and accent-swap).
//!
//! The Node implementation shares one `QuizGame` lifecycle and only changes the content. This
//! type ports that lifecycle without Discord, timers or localisation: the adapter opens rounds,
//! speaks the prompt, and calls `advance` on the timeout path.

use std::collections::BTreeMap;

use unicode_normalization::UnicodeNormalization;

const MAX_ROUNDS: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextQuizScore {
    pub user_id: String,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextQuizEvent {
    RoundOpened {
        round: u8,
        total: u8,
        prompt: String,
    },
    Accepted {
        user_id: String,
        name: String,
        answer: String,
    },
    Wrong,
    Invalid,
    Closed,
    TimedOut {
        answer: String,
    },
    Finished {
        scores: Vec<TextQuizScore>,
    },
}

#[derive(Debug)]
pub struct TextQuizGame {
    prompts: Vec<(String, String)>,
    round: usize,
    open: bool,
    finished: bool,
    scores: BTreeMap<String, i64>,
}

impl TextQuizGame {
    /// Creates a game with at most five prompts. Each tuple is `(spoken_prompt, expected_answer)`.
    #[must_use]
    pub fn new(prompts: Vec<(String, String)>) -> Self {
        let prompts = prompts.into_iter().take(MAX_ROUNDS).collect::<Vec<_>>();
        Self {
            prompts,
            round: 0,
            open: false,
            finished: false,
            scores: BTreeMap::new(),
        }
    }

    #[must_use]
    pub fn rounds(&self) -> u8 {
        self.prompts.len() as u8
    }

    #[must_use]
    pub fn round(&self) -> u8 {
        self.round as u8
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
    pub fn begin_round(&mut self) -> TextQuizEvent {
        if self.finished || self.round >= self.prompts.len() {
            self.open = false;
            self.finished = true;
            return TextQuizEvent::Finished {
                scores: self.scoreboard(),
            };
        }
        self.round += 1;
        self.open = true;
        TextQuizEvent::RoundOpened {
            round: self.round as u8,
            total: self.prompts.len() as u8,
            prompt: self.prompts[self.round - 1].0.clone(),
        }
    }

    #[must_use]
    pub fn answer(&mut self, user_id: &str, name: &str, raw: &str) -> TextQuizEvent {
        if !self.open {
            return TextQuizEvent::Closed;
        }
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return TextQuizEvent::Invalid;
        }
        let expected = &self.prompts[self.round - 1].1;
        if normalize_game_answer(trimmed) != normalize_game_answer(expected) {
            return TextQuizEvent::Wrong;
        }
        self.open = false;
        *self.scores.entry(user_id.to_owned()).or_default() += 1;
        TextQuizEvent::Accepted {
            user_id: user_id.to_owned(),
            name: name.to_owned(),
            answer: expected.clone(),
        }
    }

    #[must_use]
    pub fn timeout(&mut self) -> TextQuizEvent {
        if !self.open {
            return TextQuizEvent::Closed;
        }
        self.open = false;
        TextQuizEvent::TimedOut {
            answer: self.prompts[self.round - 1].1.clone(),
        }
    }

    #[must_use]
    pub fn scoreboard(&self) -> Vec<TextQuizScore> {
        self.scores
            .iter()
            .map(|(user_id, points)| TextQuizScore {
                user_id: user_id.clone(),
                points: *points,
            })
            .collect()
    }
}

/// Matches the Node `normalizeAnswer`: NFD diacritic stripping, lowercase, trim and collapsed
/// whitespace. This keeps accented and unaccented user input equivalent across locales.
#[must_use]
pub fn normalize_game_answer(input: &str) -> String {
    input
        .nfd()
        .filter(|character| !is_combining_mark(*character))
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_combining_mark(character: char) -> bool {
    matches!(character, '\u{0300}'..='\u{036f}' | '\u{1ab0}'..='\u{1aff}' | '\u{1dc0}'..='\u{1dff}' | '\u{20d0}'..='\u{20ff}' | '\u{fe20}'..='\u{fe2f}')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caps_accents_and_whitespace_are_tolerated() {
        assert_eq!(normalize_game_answer("  ÁRVORE\n"), "arvore");
    }

    #[test]
    fn first_correct_answer_closes_round_and_scores_user() {
        let mut game = TextQuizGame::new(vec![("computer".into(), "computer".into())]);
        assert!(matches!(
            game.begin_round(),
            TextQuizEvent::RoundOpened {
                round: 1,
                total: 1,
                ..
            }
        ));
        assert_eq!(game.answer("u1", "Rexy", "wrong"), TextQuizEvent::Wrong);
        assert!(matches!(
            game.answer("u1", "Rexy", " COMPUTER "),
            TextQuizEvent::Accepted { .. }
        ));
        assert_eq!(
            game.answer("u2", "Other", "computer"),
            TextQuizEvent::Closed
        );
        assert_eq!(
            game.scoreboard(),
            vec![TextQuizScore {
                user_id: "u1".into(),
                points: 1
            }]
        );
        assert!(matches!(game.begin_round(), TextQuizEvent::Finished { .. }));
    }

    #[test]
    fn timeout_reveals_expected_answer_and_empty_game_finishes() {
        let mut game = TextQuizGame::new(vec![("prompt".into(), "answer".into())]);
        assert!(matches!(
            game.begin_round(),
            TextQuizEvent::RoundOpened { .. }
        ));
        assert_eq!(
            game.timeout(),
            TextQuizEvent::TimedOut {
                answer: "answer".into()
            }
        );
        assert!(
            matches!(game.begin_round(), TextQuizEvent::Finished { scores } if scores.is_empty())
        );
        assert!(!TextQuizGame::new(Vec::new()).is_finished());
        let mut empty = TextQuizGame::new(Vec::new());
        assert!(
            matches!(empty.begin_round(), TextQuizEvent::Finished { scores } if scores.is_empty())
        );
        assert!(empty.is_finished());
    }
}
