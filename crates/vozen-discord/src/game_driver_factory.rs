//! Deterministic construction of Rust game drivers from the generated content contract.
//!
//! This is deliberately transport-free. The future gateway adapter supplies the guild/user
//! entitlement facts and the Discord channel; this factory only turns a validated game id into
//! the same kind of driver that the manager tests already exercise.

use thiserror::Error;
use vozen_core::LanguagePrompt;

use crate::{
    ChessGameDriver, GAME_CATALOG, GameContent, GameDriver, GuessLanguageGameDriver,
    HangmanGameDriver, HeadsOrTailsGameDriver, NumericQuizGameDriver, ReflexesGameDriver,
    RouletteGameDriver, TextQuizGameDriver, TextQuizMode, TicTacToeGameDriver, VozenSaysGameDriver,
    WordChainGameDriver, WordleGameDriver, game_content,
};

#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum GameFactoryError {
    #[error("unknown game: {0}")]
    UnknownGame(String),
    #[error("game has no usable content: {0}")]
    NoContent(String),
}

/// Builds every registered driver without importing Serenity, SQLite, or the voice transport.
pub struct GameDriverFactory {
    content: GameContent,
    available_models: Vec<String>,
    default_voice: String,
    locale: String,
}

impl GameDriverFactory {
    #[must_use]
    pub fn new(
        available_models: Vec<String>,
        default_voice: impl Into<String>,
        locale: impl Into<String>,
    ) -> Self {
        Self {
            content: game_content().clone(),
            available_models,
            default_voice: default_voice.into(),
            locale: locale.into(),
        }
    }

    #[must_use]
    pub fn content(&self) -> &GameContent {
        &self.content
    }

    /// Creates a driver using the same locale/content fallback boundary as Node. A missing
    /// optional language means the guild locale; invalid values fall back to English for the
    /// language-specific word-chain bank.
    pub fn create(
        &self,
        game_id: &str,
        language: Option<&str>,
        seed: i64,
    ) -> Result<Box<dyn GameDriver>, GameFactoryError> {
        self.create_for_locale(game_id, language, &self.locale, seed)
    }

    /// Creates a driver for the locale of the user who started the match.  The Node game
    /// manager stores that locale per session; keeping this override here prevents a global
    /// factory locale from making every guild use the same word/roulette bank.
    pub fn create_for_locale(
        &self,
        game_id: &str,
        language: Option<&str>,
        locale: &str,
        seed: i64,
    ) -> Result<Box<dyn GameDriver>, GameFactoryError> {
        let id = game_id.trim();
        if !GAME_CATALOG.iter().any(|game| game.id == id) {
            return Err(GameFactoryError::UnknownGame(id.to_owned()));
        }

        let word_source = self.words_for_voice();
        let locale_words = self.words_for_locale(locale);
        let model = (!self.default_voice.trim().is_empty()).then(|| self.default_voice.clone());
        let driver: Box<dyn GameDriver> = match id {
            "guess-language" => {
                let (prompts, models) = self.language_prompts();
                if prompts.is_empty() {
                    return Err(GameFactoryError::NoContent(id.to_owned()));
                }
                Box::new(GuessLanguageGameDriver::new(prompts, models))
            }
            "math" => Box::new(NumericQuizGameDriver::math(seed)),
            "skip-count" => Box::new(NumericQuizGameDriver::skip_count(seed)),
            "spelling" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::Spelling,
                pairs(&word_source, seed),
                model.clone(),
            )),
            "spell-out" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::SpellOut,
                pairs(&word_source, seed),
                model.clone(),
            )),
            "fast-speech" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::FastSpeech,
                pairs(
                    self.content
                        .short_phrases
                        .get(&voice_base(&self.default_voice))
                        .or_else(|| self.content.short_phrases.get("en"))
                        .ok_or_else(|| GameFactoryError::NoContent(id.to_owned()))?,
                    seed,
                ),
                model.clone(),
            )),
            "accent-swap" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::AccentSwap,
                pairs(&word_source, seed),
                model.clone(),
            )),
            "reflexes" => Box::new(ReflexesGameDriver::new(seed)),
            "vozen-says" => Box::new(VozenSaysGameDriver::new(
                take_rotated(&word_source, seed),
                seed,
                model.clone(),
            )),
            "roulette" => Box::new(RouletteGameDriver::new(
                pick_locale_bank(&self.content.roulette_prompts, locale, seed)
                    .ok_or_else(|| GameFactoryError::NoContent(id.to_owned()))?,
            )),
            "hangman" => {
                let word = pick_word(&locale_words, seed)
                    .ok_or_else(|| GameFactoryError::NoContent(id.to_owned()))?;
                Box::new(HangmanGameDriver::new(&word))
            }
            "wordle" => {
                let word = pick_wordle(&self.content.wordle_words, locale, seed)
                    .ok_or_else(|| GameFactoryError::NoContent(id.to_owned()))?;
                Box::new(WordleGameDriver::new(&word))
            }
            "tictactoe" => Box::new(TicTacToeGameDriver::new()),
            "chess" => Box::new(ChessGameDriver::new()),
            "word-chain" => Box::new(WordChainGameDriver::new(
                word_chain_language(language, locale),
                locale_words,
                seed as u64,
            )),
            "headsOrTails" => Box::new(HeadsOrTailsGameDriver::new(seed)),
            _ => unreachable!("game id was checked against GAME_CATALOG"),
        };
        Ok(driver)
    }

    fn words_for_voice(&self) -> Vec<String> {
        let base = voice_base(&self.default_voice);
        self.content
            .word_bank
            .get(&base)
            .filter(|words| !words.is_empty())
            .cloned()
            .or_else(|| self.content.word_bank.get("en").cloned())
            .unwrap_or_default()
    }

    fn words_for_locale(&self, locale: &str) -> Vec<String> {
        let base = locale_base(locale);
        self.content
            .word_bank
            .get(&base)
            .filter(|words| !words.is_empty())
            .cloned()
            .or_else(|| self.content.word_bank.get("en").cloned())
            .unwrap_or_default()
            .into_iter()
            .filter(|word| !word.contains(['-', ' ']))
            .collect()
    }

    fn language_prompts(&self) -> (Vec<LanguagePrompt>, Vec<Option<String>>) {
        let mut seen = std::collections::BTreeSet::new();
        let mut prompts = Vec::new();
        let mut models = Vec::new();
        for model in &self.available_models {
            let base = voice_base(model);
            if !seen.insert(base.clone()) {
                continue;
            }
            let Some(phrases) = self.content.language_phrases.get(&base) else {
                continue;
            };
            for phrase in phrases.iter().take(1) {
                let language = language_name(&base);
                let mut accepted = vec![base.clone(), language.clone()];
                accepted.push(language.to_lowercase());
                prompts.push(LanguagePrompt {
                    phrase: phrase.clone(),
                    language,
                    accepted_answers: accepted,
                });
                models.push(Some(model.clone()));
            }
            if prompts.len() >= 5 {
                break;
            }
        }
        (prompts, models)
    }
}

fn pairs(words: &[String], seed: i64) -> Vec<(String, String)> {
    take_rotated(words, seed)
        .into_iter()
        .map(|word| (word.clone(), word))
        .collect()
}

fn take_rotated(words: &[String], seed: i64) -> Vec<String> {
    if words.is_empty() {
        return Vec::new();
    }
    let start = seed.rem_euclid(words.len() as i64) as usize;
    (0..words.len().min(5))
        .map(|offset| words[(start + offset) % words.len()].clone())
        .collect()
}

fn pick_word(words: &[String], seed: i64) -> Option<String> {
    words
        .get(seed.rem_euclid(words.len().max(1) as i64) as usize)
        .cloned()
}

fn pick_locale_bank(
    banks: &std::collections::BTreeMap<String, Vec<String>>,
    locale: &str,
    seed: i64,
) -> Option<String> {
    let words = banks
        .get(&locale_base(locale))
        .or_else(|| banks.get("en"))?;
    pick_word(words, seed)
}

fn pick_wordle(
    banks: &std::collections::BTreeMap<String, Vec<String>>,
    locale: &str,
    seed: i64,
) -> Option<String> {
    let words = banks
        .get(&locale_base(locale))
        .or_else(|| banks.get("en"))?;
    let words = words
        .iter()
        .filter(|word| word.chars().count() == 5)
        .collect::<Vec<_>>();
    words
        .get(seed.rem_euclid(words.len().max(1) as i64) as usize)
        .map(|word| (*word).clone())
}

fn word_chain_language(language: Option<&str>, locale: &str) -> String {
    match language
        .map(str::trim)
        .filter(|value| matches!(*value, "pt" | "en" | "es" | "fr"))
    {
        Some(language) => language.to_owned(),
        None => {
            let base = locale_base(locale);
            matches!(base.as_str(), "pt" | "en" | "es" | "fr")
                .then_some(base)
                .unwrap_or_else(|| "en".into())
        }
    }
}

fn voice_base(value: &str) -> String {
    value
        .split(['-', '_'])
        .next()
        .unwrap_or(value)
        .to_ascii_lowercase()
}

fn locale_base(value: &str) -> String {
    value
        .split(['-', '_'])
        .next()
        .unwrap_or(value)
        .to_ascii_lowercase()
}

fn language_name(base: &str) -> String {
    match base {
        "ar" => "Arabic",
        "de" => "German",
        "en" => "English",
        "es" => "Spanish",
        "fr" => "French",
        "it" => "Italian",
        "nl" => "Dutch",
        "pt" => "Portuguese",
        "ru" => "Russian",
        "zh" => "Chinese",
        other => other,
    }
    .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_every_registered_driver_from_the_generated_content() {
        let factory = GameDriverFactory::new(
            vec!["en_US-amy-medium".into(), "pt_PT-cadu-medium".into()],
            "en_US-amy-medium",
            "en",
        );
        for definition in GAME_CATALOG {
            let mut driver = factory
                .create(definition.id, None, 42)
                .unwrap_or_else(|error| panic!("{}: {error}", definition.id));
            let actions = driver.on_start(0);
            assert!(!actions.is_empty(), "{} did not start", definition.id);
        }
    }

    #[test]
    fn unknown_and_empty_content_fail_closed() {
        let factory = GameDriverFactory::new(Vec::new(), "", "en");
        assert!(matches!(
            factory.create("not-a-game", None, 1),
            Err(GameFactoryError::UnknownGame(game)) if game == "not-a-game"
        ));
        assert!(matches!(
            factory.create("guess-language", None, 1),
            Err(GameFactoryError::NoContent(_))
        ));
    }

    #[test]
    fn word_chain_language_falls_back_to_supported_locale() {
        let factory = GameDriverFactory::new(Vec::new(), "", "pt-PT");
        let mut driver = factory.create("word-chain", None, 1).expect("driver");
        assert!(!driver.on_start(0).is_empty());
    }
}
