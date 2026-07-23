//! Pure state for the five-round Guess the Language game.
//!
//! The adapter chooses the installed voices and phrases. It supplies all accepted language names
//! for each round so this module stays independent of locale catalogs and ICU.

use std::collections::BTreeMap;

use crate::normalize_game_answer;

const MAX_ROUNDS: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LanguagePrompt {
    pub phrase: String,
    pub language: String,
    pub accepted_answers: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuessLanguageScore {
    pub user_id: String,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GuessLanguageEvent {
    RoundOpened {
        round: u8,
        total: u8,
        phrase: String,
    },
    Accepted {
        user_id: String,
        name: String,
        language: String,
    },
    Wrong,
    Invalid,
    Closed,
    TimedOut {
        language: String,
    },
    Finished {
        scores: Vec<GuessLanguageScore>,
    },
}

#[derive(Debug, Clone)]
pub struct GuessLanguageGame {
    prompts: Vec<LanguagePrompt>,
    round: usize,
    open: bool,
    finished: bool,
    scores: BTreeMap<String, i64>,
}

impl GuessLanguageGame {
    #[must_use]
    pub fn new(prompts: Vec<LanguagePrompt>) -> Self {
        Self {
            prompts: prompts.into_iter().take(MAX_ROUNDS).collect(),
            round: 0,
            open: false,
            finished: false,
            scores: BTreeMap::new(),
        }
    }

    #[must_use]
    pub fn round(&self) -> u8 {
        self.round as u8
    }

    #[must_use]
    pub fn rounds(&self) -> u8 {
        self.prompts.len() as u8
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
    pub fn current_prompt(&self) -> Option<&LanguagePrompt> {
        self.open
            .then(|| self.prompts.get(self.round - 1))
            .flatten()
    }

    #[must_use]
    pub fn begin_round(&mut self) -> GuessLanguageEvent {
        if self.finished || self.round >= self.prompts.len() {
            self.open = false;
            self.finished = true;
            return GuessLanguageEvent::Finished {
                scores: self.scoreboard(),
            };
        }
        self.round += 1;
        self.open = true;
        let prompt = &self.prompts[self.round - 1];
        GuessLanguageEvent::RoundOpened {
            round: self.round as u8,
            total: self.prompts.len() as u8,
            phrase: prompt.phrase.clone(),
        }
    }

    #[must_use]
    pub fn answer(&mut self, user_id: &str, name: &str, raw: &str) -> GuessLanguageEvent {
        if !self.open {
            return GuessLanguageEvent::Closed;
        }
        let answer = normalize_game_answer(raw);
        if answer.is_empty() {
            return GuessLanguageEvent::Invalid;
        }
        let prompt = &self.prompts[self.round - 1];
        let accepted = prompt
            .accepted_answers
            .iter()
            .map(|candidate| normalize_game_answer(candidate))
            .any(|candidate| candidate == answer);
        if !accepted {
            return GuessLanguageEvent::Wrong;
        }
        self.open = false;
        *self.scores.entry(user_id.to_owned()).or_default() += 1;
        GuessLanguageEvent::Accepted {
            user_id: user_id.to_owned(),
            name: name.to_owned(),
            language: prompt.language.clone(),
        }
    }

    #[must_use]
    pub fn timeout(&mut self) -> GuessLanguageEvent {
        if !self.open {
            return GuessLanguageEvent::Closed;
        }
        self.open = false;
        GuessLanguageEvent::TimedOut {
            language: self.prompts[self.round - 1].language.clone(),
        }
    }

    #[must_use]
    pub fn scoreboard(&self) -> Vec<GuessLanguageScore> {
        self.scores
            .iter()
            .map(|(user_id, points)| GuessLanguageScore {
                user_id: user_id.clone(),
                points: *points,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prompt() -> LanguagePrompt {
        LanguagePrompt {
            phrase: "buenos dias".into(),
            language: "Spanish".into(),
            accepted_answers: vec!["es".into(), "español".into(), "spanish".into()],
        }
    }

    #[test]
    fn accepts_code_and_localised_name_once_per_round() {
        let mut game = GuessLanguageGame::new(vec![prompt()]);
        assert!(matches!(
            game.begin_round(),
            GuessLanguageEvent::RoundOpened { .. }
        ));
        assert_eq!(
            game.answer("u", "Rexy", "french"),
            GuessLanguageEvent::Wrong
        );
        assert!(matches!(
            game.answer("u", "Rexy", " ESPAÑOL "),
            GuessLanguageEvent::Accepted { language, .. } if language == "Spanish"
        ));
        assert_eq!(game.answer("u2", "Other", "es"), GuessLanguageEvent::Closed);
        assert_eq!(game.scoreboard()[0].points, 1);
    }

    #[test]
    fn timeout_reveals_language_and_empty_content_finishes() {
        let mut game = GuessLanguageGame::new(vec![prompt()]);
        let _ = game.begin_round();
        assert_eq!(
            game.timeout(),
            GuessLanguageEvent::TimedOut {
                language: "Spanish".into()
            }
        );
        assert!(matches!(
            game.begin_round(),
            GuessLanguageEvent::Finished { scores } if scores.is_empty()
        ));
        let mut empty = GuessLanguageGame::new(Vec::new());
        assert!(matches!(
            empty.begin_round(),
            GuessLanguageEvent::Finished { scores } if scores.is_empty()
        ));
        assert!(empty.is_finished());
    }
}
