//! Pure rules engine for the Word Chain game.
//!
//! This preserves the public word-chain rules; orchestration (turns, lives, voice and Discord
//! messages) remains outside the core. Dictionaries are supplied by the adapter as already
//! normalised words, so validation never performs I/O.

use std::collections::BTreeSet;

const ALPHABET: &str = "abcdefghijklmnopqrstuvwxyz";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WordChainLanguage {
    Pt,
    En,
    Es,
    Fr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChainValidationReason {
    Ok,
    NotLatin,
    TooShort,
    WrongLetter,
    Repeated,
    NotAWord,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChainValidation {
    pub ok: bool,
    pub reason: ChainValidationReason,
    pub normalized: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WordChainConfig {
    pub start_turn_ms: u64,
    pub min_turn_ms: u64,
    pub turn_decrement_ms: u64,
    pub base_min_length: usize,
}

impl Default for WordChainConfig {
    fn default() -> Self {
        Self {
            start_turn_ms: 15_000,
            min_turn_ms: 6_000,
            turn_decrement_ms: 400,
            base_min_length: 3,
        }
    }
}

#[derive(Debug, Clone)]
pub struct WordChainEngine {
    words: BTreeSet<String>,
    played: BTreeSet<String>,
    first_letters: BTreeSet<char>,
    config: WordChainConfig,
    letter: char,
    accepted: usize,
}

impl WordChainEngine {
    #[must_use]
    pub fn new<I, S>(words: I, seed: u64, config: WordChainConfig) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        let words = words.into_iter().map(Into::into).collect::<BTreeSet<_>>();
        let first_letters = words
            .iter()
            .filter_map(|word| word.chars().next())
            .collect::<BTreeSet<_>>();
        let candidates = ALPHABET
            .chars()
            .filter(|letter| first_letters.contains(letter))
            .collect::<Vec<_>>();
        let pool = if candidates.is_empty() {
            ALPHABET.chars().collect::<Vec<_>>()
        } else {
            candidates
        };
        let index = (Mulberry32::new(seed).next_f64() * pool.len() as f64).floor() as usize;
        Self {
            words,
            played: BTreeSet::new(),
            first_letters,
            config,
            letter: pool[index.min(pool.len().saturating_sub(1))],
            accepted: 0,
        }
    }

    #[must_use]
    pub fn with_defaults<I, S>(words: I, seed: u64) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        Self::new(words, seed, WordChainConfig::default())
    }

    #[must_use]
    pub fn required_letter(&self) -> char {
        self.letter
    }

    #[must_use]
    pub fn chain_length(&self) -> usize {
        self.accepted
    }

    #[must_use]
    pub fn min_length(&self) -> usize {
        if self.accepted >= 16 {
            self.config.base_min_length + 2
        } else if self.accepted >= 8 {
            self.config.base_min_length + 1
        } else {
            self.config.base_min_length
        }
    }

    #[must_use]
    pub fn turn_ms(&self) -> u64 {
        self.config
            .start_turn_ms
            .saturating_sub(self.accepted as u64 * self.config.turn_decrement_ms)
            .max(self.config.min_turn_ms)
    }

    #[must_use]
    pub fn validate(&self, raw_word: &str) -> ChainValidation {
        let normalized = normalize_chain_word(raw_word.trim());
        if normalized.is_empty() || !is_playable_form(&normalized) {
            return ChainValidation {
                ok: false,
                reason: ChainValidationReason::NotLatin,
                normalized,
            };
        }
        if !normalized.starts_with(self.letter) {
            return ChainValidation {
                ok: false,
                reason: ChainValidationReason::WrongLetter,
                normalized,
            };
        }
        if normalized.chars().count() < self.min_length() {
            return ChainValidation {
                ok: false,
                reason: ChainValidationReason::TooShort,
                normalized,
            };
        }
        if self.words.contains(&normalized) && !self.played.contains(&normalized) {
            return ChainValidation {
                ok: true,
                reason: ChainValidationReason::Ok,
                normalized,
            };
        }
        let reason = if self.played.contains(&normalized) {
            ChainValidationReason::Repeated
        } else {
            ChainValidationReason::NotAWord
        };
        ChainValidation {
            ok: false,
            reason,
            normalized,
        }
    }

    /// Accepts a value that the caller has validated, matching the TS engine's deliberate trust
    /// boundary. The normal adapter should pass `ChainValidation.normalized` only when `ok`.
    pub fn accept(&mut self, normalized_word: &str) {
        let word = normalized_word.to_owned();
        self.played.insert(word.clone());
        self.accepted += 1;
        let chars = word.chars().collect::<Vec<_>>();
        let last = *chars.last().unwrap_or(&self.letter);
        let penultimate = if chars.len() >= 2 {
            chars[chars.len() - 2]
        } else {
            last
        };
        self.letter = if self.first_letters.contains(&last) {
            last
        } else if self.first_letters.contains(&penultimate) {
            penultimate
        } else {
            self.first_letters
                .iter()
                .copied()
                .find(|candidate| candidate.is_ascii_lowercase())
                .unwrap_or(last)
        };
    }

    #[must_use]
    pub fn is_used(&self, normalized_word: &str) -> bool {
        self.played.contains(normalized_word)
    }

    #[must_use]
    pub fn played_words(&self) -> &BTreeSet<String> {
        &self.played
    }
}

fn normalize_chain_word(input: &str) -> String {
    let mut out = String::new();
    for character in input.nfd() {
        if is_combining_mark(character) {
            continue;
        }
        match character.to_lowercase().next().unwrap_or(character) {
            'ß' => out.push_str("ss"),
            'æ' => out.push_str("ae"),
            'œ' => out.push_str("oe"),
            'ø' => out.push('o'),
            'đ' => out.push('d'),
            'ł' => out.push('l'),
            lowered => out.push(lowered),
        }
    }
    out
}

fn is_playable_form(input: &str) -> bool {
    input
        .chars()
        .all(|character| character.is_ascii_lowercase())
}

fn is_combining_mark(character: char) -> bool {
    matches!(character, '\u{0300}'..='\u{036f}' | '\u{1ab0}'..='\u{1aff}' | '\u{1dc0}'..='\u{1dff}' | '\u{20d0}'..='\u{20ff}' | '\u{fe20}'..='\u{fe2f}')
}

#[derive(Debug, Clone, Copy)]
struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    const fn new(seed: u64) -> Self {
        Self { state: seed as u32 }
    }

    fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut t = self.state ^ (self.state >> 15);
        t = t.wrapping_mul(1 | self.state);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t));
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }
}

use unicode_normalization::UnicodeNormalization;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_accents_and_enforces_letter_dictionary_and_repeats() {
        let mut engine =
            WordChainEngine::with_defaults(["cães", "sapo", "pato"].map(normalize_chain_word), 1);
        let first = engine.required_letter();
        let candidate = match first {
            'c' => "caes",
            's' => "sapo",
            'p' => "pato",
            _ => "caes",
        };
        let valid = engine.validate(candidate);
        assert!(valid.ok, "{valid:?}");
        engine.accept(&valid.normalized);
        assert_eq!(engine.chain_length(), 1);
        assert!(engine.is_used(candidate));
        engine.letter = first;
        assert_eq!(
            engine.validate(candidate).reason,
            ChainValidationReason::Repeated
        );
    }

    #[test]
    fn dead_last_letter_falls_back_to_penultimate_or_any_live_letter() {
        let mut engine = WordChainEngine::new(["cat", "at", "tea"], 1, WordChainConfig::default());
        engine.letter = 'c';
        let valid = engine.validate("cat");
        assert!(valid.ok);
        engine.accept(&valid.normalized);
        assert_eq!(engine.required_letter(), 't');
    }

    #[test]
    fn difficulty_and_turn_floor_match_node_defaults() {
        let mut engine = WordChainEngine::new(
            (0..17).map(|i| format!("a{i:02}")),
            2,
            WordChainConfig::default(),
        );
        assert_eq!(engine.min_length(), 3);
        assert_eq!(engine.turn_ms(), 15_000);
        for _ in 0..16 {
            engine.accept("aaa");
        }
        assert_eq!(engine.min_length(), 5);
        assert_eq!(engine.turn_ms(), 8_600);
    }
}
