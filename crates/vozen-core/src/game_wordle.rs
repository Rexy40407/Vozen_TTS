//! Pure state for the collaborative five-letter Wordle game.
//!
//! Rendering (emoji tiles/ANSI), localisation and the idle timer stay in the Discord adapter.
//! The repeated-letter accounting preserves the public Wordle contract so a guess cannot
//! mark more occurrences yellow than the target contains.

use std::collections::{BTreeMap, BTreeSet};

use crate::normalize_game_answer;

const WORD_LENGTH: usize = 5;
const MAX_GUESSES: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CellState {
    Green,
    Yellow,
    Gray,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WordleRow {
    pub letters: String,
    pub states: [CellState; WORD_LENGTH],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WordleEvent {
    Invalid,
    Closed,
    Guess {
        user_id: String,
        name: String,
        row: WordleRow,
        guesses_left: u8,
    },
    Won {
        user_id: String,
        name: String,
        word: String,
        row: WordleRow,
        guesses: u8,
    },
    Lost {
        word: String,
        row: WordleRow,
    },
}

#[derive(Debug, Clone)]
pub struct WordleGame {
    target: String,
    guesses: usize,
    over: bool,
    rows: Vec<WordleRow>,
    present: BTreeSet<char>,
    absent: BTreeSet<char>,
}

impl WordleGame {
    #[must_use]
    pub fn new(target: &str) -> Self {
        let target = normalize_word(target);
        Self {
            target: if target.chars().count() == WORD_LENGTH {
                target
            } else {
                "apple".to_owned()
            },
            guesses: 0,
            over: false,
            rows: Vec::new(),
            present: BTreeSet::new(),
            absent: BTreeSet::new(),
        }
    }

    #[must_use]
    pub fn target(&self) -> &str {
        &self.target
    }

    #[must_use]
    pub fn guesses(&self) -> usize {
        self.guesses
    }

    #[must_use]
    pub fn guesses_left(&self) -> usize {
        MAX_GUESSES.saturating_sub(self.guesses)
    }

    #[must_use]
    pub fn is_over(&self) -> bool {
        self.over
    }

    #[must_use]
    pub fn rows(&self) -> &[WordleRow] {
        &self.rows
    }

    #[must_use]
    pub fn present_letters(&self) -> &BTreeSet<char> {
        &self.present
    }

    #[must_use]
    pub fn absent_letters(&self) -> &BTreeSet<char> {
        &self.absent
    }

    #[must_use]
    pub fn guess(&mut self, user_id: &str, name: &str, raw: &str) -> WordleEvent {
        if self.over {
            return WordleEvent::Closed;
        }
        let guess = normalize_word(raw);
        if guess.chars().count() != WORD_LENGTH {
            return WordleEvent::Invalid;
        }
        let row = self.evaluate(&guess);
        self.guesses += 1;
        self.track_letters(&guess);
        self.rows.push(row.clone());
        if guess == self.target {
            self.over = true;
            return WordleEvent::Won {
                user_id: user_id.to_owned(),
                name: name.to_owned(),
                word: self.target.clone(),
                row,
                guesses: self.guesses as u8,
            };
        }
        if self.guesses >= MAX_GUESSES {
            self.over = true;
            return WordleEvent::Lost {
                word: self.target.clone(),
                row,
            };
        }
        WordleEvent::Guess {
            user_id: user_id.to_owned(),
            name: name.to_owned(),
            row,
            guesses_left: self.guesses_left() as u8,
        }
    }

    fn evaluate(&self, guess: &str) -> WordleRow {
        let guess_chars = guess.chars().collect::<Vec<_>>();
        let target_chars = self.target.chars().collect::<Vec<_>>();
        let mut states = [CellState::Gray; WORD_LENGTH];
        let mut counts = BTreeMap::<char, usize>::new();
        for character in &target_chars {
            *counts.entry(*character).or_default() += 1;
        }
        for index in 0..WORD_LENGTH {
            if guess_chars[index] == target_chars[index] {
                states[index] = CellState::Green;
                if let Some(count) = counts.get_mut(&guess_chars[index]) {
                    *count = count.saturating_sub(1);
                }
            }
        }
        for index in 0..WORD_LENGTH {
            if states[index] == CellState::Green {
                continue;
            }
            if let Some(count) = counts.get_mut(&guess_chars[index])
                && *count > 0
            {
                states[index] = CellState::Yellow;
                *count -= 1;
            }
        }
        WordleRow {
            letters: guess.to_owned(),
            states,
        }
    }

    fn track_letters(&mut self, guess: &str) {
        for character in guess.chars().collect::<BTreeSet<_>>() {
            if self.target.contains(character) {
                self.present.insert(character);
            } else {
                self.absent.insert(character);
            }
        }
    }
}

fn normalize_word(raw: &str) -> String {
    normalize_game_answer(raw)
        .chars()
        .filter(char::is_ascii_lowercase)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repeated_letters_use_remaining_target_counts() {
        let mut game = WordleGame::new("apple");
        let WordleEvent::Guess { row, .. } = game.guess("u", "User", "allee") else {
            panic!("expected an open guess");
        };
        assert_eq!(
            row.states,
            [
                CellState::Green,
                CellState::Yellow,
                CellState::Gray,
                CellState::Gray,
                CellState::Green
            ]
        );
    }

    #[test]
    fn winner_closes_game_and_records_keyboard_sets() {
        let mut game = WordleGame::new("crane");
        assert!(matches!(
            game.guess("u", "Rexy", "crane"),
            WordleEvent::Won { guesses: 1, .. }
        ));
        assert_eq!(game.present_letters().len(), 5);
        assert!(game.absent_letters().is_empty());
        assert_eq!(game.guess("u2", "Other", "apple"), WordleEvent::Closed);
    }

    #[test]
    fn invalid_lengths_do_not_consume_attempts_and_eight_valid_guesses_lose() {
        let mut game = WordleGame::new("apple");
        assert_eq!(game.guess("u", "User", "four"), WordleEvent::Invalid);
        assert_eq!(game.guesses(), 0);
        for _ in 0..7 {
            assert!(matches!(
                game.guess("u", "User", "zzzzz"),
                WordleEvent::Guess { .. }
            ));
        }
        assert!(matches!(
            game.guess("u", "User", "zzzzz"),
            WordleEvent::Lost { .. }
        ));
        assert!(game.is_over());
    }
}
