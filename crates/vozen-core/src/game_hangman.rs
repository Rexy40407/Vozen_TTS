//! Pure state for the collaborative text Hangman game.
//!
//! Discord rendering, localisation and the idle timer remain adapter concerns. The state mirrors
//! `src/games/hangman.ts`: whole-word guesses only win when correct, single letters are tolerant
//! to accents/case, repeated letters do not consume a life, and six misses end the game.

use std::collections::BTreeSet;

use crate::normalize_game_answer;

const MAX_WRONG: usize = 6;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HangmanEvent {
    Hit {
        user_id: String,
        name: String,
        letter: char,
        complete: bool,
    },
    Miss {
        user_id: String,
        name: String,
        letter: char,
        remaining: u8,
    },
    Won {
        user_id: String,
        name: String,
        word: String,
    },
    Lost {
        word: String,
    },
    WrongWord,
    AlreadyTried,
    Invalid,
    Closed,
}

#[derive(Debug, Clone)]
pub struct HangmanGame {
    word: String,
    revealed: BTreeSet<char>,
    wrong: BTreeSet<char>,
    over: bool,
}

impl HangmanGame {
    #[must_use]
    pub fn new(word: &str) -> Self {
        let word = normalize_game_answer(word);
        Self {
            word: if word.is_empty() {
                "computer".to_owned()
            } else {
                word
            },
            revealed: BTreeSet::new(),
            wrong: BTreeSet::new(),
            over: false,
        }
    }

    #[must_use]
    pub fn word(&self) -> &str {
        &self.word
    }

    #[must_use]
    pub fn wrong_count(&self) -> usize {
        self.wrong.len()
    }

    #[must_use]
    pub fn remaining_lives(&self) -> usize {
        MAX_WRONG.saturating_sub(self.wrong.len())
    }

    #[must_use]
    pub fn is_over(&self) -> bool {
        self.over
    }

    #[must_use]
    pub fn masked(&self) -> String {
        self.word
            .chars()
            .map(|character| {
                if character == ' ' {
                    String::new()
                } else if self.revealed.contains(&character) {
                    character.to_ascii_uppercase().to_string()
                } else {
                    "_".to_owned()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    #[must_use]
    pub fn guess(&mut self, user_id: &str, name: &str, raw: &str) -> HangmanEvent {
        if self.over {
            return HangmanEvent::Closed;
        }
        let guess = normalize_game_answer(raw);
        if guess.is_empty() {
            return HangmanEvent::Invalid;
        }
        if guess.chars().count() > 1 {
            if guess == self.word {
                return self.win(user_id, name);
            }
            return HangmanEvent::WrongWord;
        }
        let Some(letter) = guess.chars().next() else {
            return HangmanEvent::Invalid;
        };
        if !letter.is_ascii_lowercase() {
            return HangmanEvent::Invalid;
        }
        if self.revealed.contains(&letter) || self.wrong.contains(&letter) {
            return HangmanEvent::AlreadyTried;
        }
        if self.word.contains(letter) {
            self.revealed.insert(letter);
            let complete = self
                .word
                .chars()
                .filter(|character| *character != ' ')
                .all(|character| self.revealed.contains(&character));
            if complete {
                return self.win(user_id, name);
            }
            return HangmanEvent::Hit {
                user_id: user_id.to_owned(),
                name: name.to_owned(),
                letter,
                complete: false,
            };
        }
        self.wrong.insert(letter);
        if self.wrong.len() >= MAX_WRONG {
            self.over = true;
            return HangmanEvent::Lost {
                word: self.word.clone(),
            };
        }
        HangmanEvent::Miss {
            user_id: user_id.to_owned(),
            name: name.to_owned(),
            letter,
            remaining: self.remaining_lives() as u8,
        }
    }

    fn win(&mut self, user_id: &str, name: &str) -> HangmanEvent {
        self.over = true;
        self.revealed.extend(self.word.chars());
        HangmanEvent::Won {
            user_id: user_id.to_owned(),
            name: name.to_owned(),
            word: self.word.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn letters_reveal_without_duplicate_life_loss_and_mask_is_stable() {
        let mut game = HangmanGame::new("café");
        assert_eq!(game.masked(), "_ _ _ _");
        assert!(matches!(
            game.guess("u1", "Rexy", "E"),
            HangmanEvent::Hit {
                letter: 'e',
                complete: false,
                ..
            }
        ));
        assert_eq!(game.masked(), "_ _ _ E");
        assert_eq!(game.guess("u2", "Other", "e"), HangmanEvent::AlreadyTried);
        assert_eq!(game.wrong_count(), 0);
    }

    #[test]
    fn wrong_whole_word_does_not_consume_a_life_but_six_letters_lose() {
        let mut game = HangmanGame::new("abc");
        assert_eq!(game.guess("u", "User", "xyz"), HangmanEvent::WrongWord);
        assert_eq!(game.wrong_count(), 0);
        for letter in ['d', 'e', 'f', 'g', 'h'] {
            assert!(matches!(
                game.guess("u", "User", &letter.to_string()),
                HangmanEvent::Miss { .. }
            ));
        }
        assert!(matches!(
            game.guess("u", "User", "i"),
            HangmanEvent::Lost { word } if word == "abc"
        ));
        assert!(game.is_over());
    }

    #[test]
    fn correct_whole_word_awards_winner_and_closes_game() {
        let mut game = HangmanGame::new("árvore");
        assert!(matches!(
            game.guess("u", "Rexy", " arvore "),
            HangmanEvent::Won { word, .. } if word == "arvore"
        ));
        assert_eq!(game.masked(), "A R V O R E");
        assert_eq!(game.guess("u2", "Other", "a"), HangmanEvent::Closed);
    }
}
