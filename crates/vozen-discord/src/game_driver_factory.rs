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
    RouletteGameDriver, TextQuizGameDriver, TextQuizMode, TicTacToeGameDriver, VoiceDisplayCatalog,
    VozenSaysGameDriver, WordChainGameDriver, WordleGameDriver, game_content,
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
    display_names: VoiceDisplayCatalog,
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
            display_names: VoiceDisplayCatalog::from_generated_contract()
                .expect("generated voice display contract must be valid"),
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

        let (word_base, word_source, word_model) = self.words_for_voice(locale);
        let locale_words = self.words_for_locale(locale);
        let driver: Box<dyn GameDriver> = match id {
            "guess-language" => {
                let (prompts, models) = self.language_prompts(seed, locale);
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
                word_model.clone(),
            )),
            "spell-out" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::SpellOut,
                spell_out_pairs(&word_source, seed),
                word_model.clone(),
            )),
            "fast-speech" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::FastSpeech,
                pairs(
                    self.content
                        .short_phrases
                        .get(&locale_base(locale))
                        .or_else(|| self.content.short_phrases.get("en"))
                        .ok_or_else(|| GameFactoryError::NoContent(id.to_owned()))?,
                    seed,
                ),
                self.phrase_model(locale),
            )),
            "accent-swap" => Box::new(TextQuizGameDriver::new(
                TextQuizMode::AccentSwap,
                pairs(&word_source, seed),
                self.available_models
                    .iter()
                    .find(|model| voice_base(model) != word_base)
                    .cloned()
                    .or(word_model.clone()),
            )),
            "reflexes" => Box::new(ReflexesGameDriver::new(seed)),
            "vozen-says" => Box::new(VozenSaysGameDriver::new(
                take_rotated(&word_source, seed),
                seed,
                word_model.clone(),
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
            "word-chain" => {
                let language = word_chain_language(language, locale);
                let words = self.words_for_locale(&language);
                let model = self
                    .available_models
                    .iter()
                    .find(|model| voice_base(model) == language)
                    .cloned()
                    .or_else(|| {
                        (!self.default_voice.trim().is_empty()).then(|| self.default_voice.clone())
                    });
                Box::new(WordChainGameDriver::new(language, words, seed as u64).with_voice(model))
            }
            "headsOrTails" => Box::new(HeadsOrTailsGameDriver::new(seed)),
            _ => unreachable!("game id was checked against GAME_CATALOG"),
        };
        Ok(driver)
    }

    fn words_for_voice(&self, locale: &str) -> (String, Vec<String>, Option<String>) {
        let base = locale_base(locale);
        if let Some(words) = self
            .content
            .word_bank
            .get(&base)
            .filter(|words| !words.is_empty())
        {
            return (base, words.clone(), self.model_for_locale(locale));
        }
        (
            "en".to_owned(),
            self.content
                .word_bank
                .get("en")
                .cloned()
                .unwrap_or_default(),
            self.available_models
                .iter()
                .find(|model| voice_base(model) == "en")
                .cloned()
                .or_else(|| {
                    (!self.default_voice.trim().is_empty()).then(|| self.default_voice.clone())
                }),
        )
    }

    fn phrase_model(&self, locale: &str) -> Option<String> {
        let base = locale_base(locale);
        if self
            .content
            .short_phrases
            .get(&base)
            .is_some_and(|phrases| !phrases.is_empty())
        {
            return self.model_for_locale(locale);
        }
        self.available_models
            .iter()
            .find(|model| voice_base(model) == "en")
            .cloned()
            .or_else(|| self.model_for_locale(locale))
    }

    fn model_for_locale(&self, locale: &str) -> Option<String> {
        let base = locale_base(locale);
        self.available_models
            .iter()
            .find(|model| voice_base(model) == base)
            .cloned()
            .or_else(|| (!self.default_voice.trim().is_empty()).then(|| self.default_voice.clone()))
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

    fn language_prompts(
        &self,
        seed: i64,
        locale: &str,
    ) -> (Vec<LanguagePrompt>, Vec<Option<String>>) {
        let mut seen = std::collections::BTreeSet::new();
        let mut candidates = Vec::new();
        for model in &self.available_models {
            let base = voice_base(model);
            if !seen.insert(base.clone()) {
                continue;
            }
            let Some(phrases) = self.content.language_phrases.get(&base) else {
                continue;
            };
            candidates.push((base, model.clone(), phrases.clone()));
        }
        seeded_shuffle(&mut candidates, seed);
        let mut phrase_rng = XorShift::new(seed);
        let mut prompts = Vec::new();
        let mut models = Vec::new();
        for (base, model, phrases) in candidates.into_iter().take(5) {
            let phrase = phrases[(phrase_rng.next() as usize) % phrases.len()].clone();
            let language = self
                .display_names
                .localized_language_name(Some(locale), &base);
            prompts.push(LanguagePrompt {
                phrase,
                language,
                accepted_answers: self.accepted_language_answers(&base, locale),
            });
            models.push(Some(model));
        }
        (prompts, models)
    }

    fn accepted_language_answers(&self, base: &str, locale: &str) -> Vec<String> {
        let mut answers = vec![base.to_owned()];
        for answer_locale in [base, locale, "en", "pt", "es", "fr", "de", "it", "nl"] {
            answers.push(
                self.display_names
                    .localized_language_name(Some(answer_locale), base),
            );
        }
        answers.sort();
        answers.dedup();
        answers
    }
}

fn pairs(words: &[String], seed: i64) -> Vec<(String, String)> {
    let mut words = words.to_vec();
    seeded_shuffle(&mut words, seed);
    words
        .into_iter()
        .take(5)
        .map(|word| (word.clone(), word))
        .collect()
}

fn spell_out_pairs(words: &[String], seed: i64) -> Vec<(String, String)> {
    let mut words = words
        .iter()
        .filter(|word| !word.contains('-'))
        .cloned()
        .collect::<Vec<_>>();
    seeded_shuffle(&mut words, seed);
    words
        .into_iter()
        .take(5)
        .map(|word| {
            let spoken = word
                .to_uppercase()
                .chars()
                .map(|character| character.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            (spoken, word)
        })
        .collect()
}

fn take_rotated(words: &[String], seed: i64) -> Vec<String> {
    let mut words = words.to_vec();
    seeded_shuffle(&mut words, seed);
    words.into_iter().take(5).collect()
}

fn pick_word(words: &[String], seed: i64) -> Option<String> {
    words.get(seeded_index(seed, words.len())).cloned()
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
        .get(seeded_index(seed, words.len()))
        .map(|word| (*word).clone())
}

fn seeded_index(seed: i64, length: usize) -> usize {
    if length == 0 {
        return 0;
    }
    (XorShift::new(seed).next() as usize) % length
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

fn seeded_shuffle<T>(values: &mut [T], seed: i64) {
    let mut rng = XorShift::new(seed);
    for index in (1..values.len()).rev() {
        let other = (rng.next() as usize) % (index + 1);
        values.swap(index, other);
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
    fn visible_round_rules_match_the_legacy_game_contract() {
        let factory = GameDriverFactory::new(
            vec![
                "en_US-amy-medium".into(),
                "de_DE-google-medium".into(),
                "es_ES-google-medium".into(),
                "fr_FR-google-medium".into(),
                "it_IT-google-medium".into(),
                "pt_PT-google-medium".into(),
            ],
            "en_US-amy-medium",
            "en",
        );
        let expected = [
            ("guess-language", "game.guessLanguage.intro", "5"),
            ("math", "game.math.intro", "5"),
            ("skip-count", "game.skipCount.intro", "5"),
            ("spelling", "game.spelling.intro", "5"),
            ("spell-out", "game.spellOut.intro", "5"),
            ("fast-speech", "game.fastSpeech.intro", "5"),
            ("accent-swap", "game.accentSwap.intro", "5"),
            ("reflexes", "game.reflexes.intro", "3"),
            ("vozen-says", "game.vozenSays.intro", "6"),
            ("headsOrTails", "game.headsOrTails.intro", "5"),
        ];

        for (game_id, intro_key, rounds) in expected {
            let mut driver = factory
                .create(game_id, None, 42)
                .unwrap_or_else(|error| panic!("{game_id}: {error}"));
            let actions = driver.on_start(0);
            let intro = actions.iter().find_map(|action| match action {
                crate::GameDriverAction::Announcement(intro) if intro.key == intro_key => {
                    Some(intro)
                }
                _ => None,
            });
            assert_eq!(
                intro.and_then(|intro| intro.parameters.get("rounds").map(String::as_str)),
                Some(rounds),
                "{game_id} exposed the wrong round count"
            );
        }
    }

    #[test]
    fn selected_game_locale_drives_the_game_voice_model() {
        let factory = GameDriverFactory::new(
            vec!["en_US-amy-medium".into(), "pt_PT-google-medium".into()],
            "en_US-amy-medium",
            "en",
        );
        let mut driver = factory
            .create_for_locale("spelling", None, "pt", 42)
            .expect("spelling driver");
        let model = driver
            .on_start(0)
            .into_iter()
            .find_map(|action| match action {
                crate::GameDriverAction::TextQuiz(crate::TextQuizDriverAction::RoundOpened {
                    model,
                    ..
                }) => model,
                _ => None,
            });
        assert_eq!(model.as_deref(), Some("pt_PT-google-medium"));
    }

    #[test]
    fn guess_language_uses_complete_names_and_accepts_the_players_language() {
        let factory = GameDriverFactory::new(
            vec![
                "zh_CN-google-medium".into(),
                "fi_FI-google-medium".into(),
                "sv_SE-google-medium".into(),
            ],
            "en_US-amy-medium",
            "pt",
        );
        let (prompts, _) = factory.language_prompts(42, "pt");

        let chinese = prompts
            .iter()
            .find(|prompt| prompt.accepted_answers.iter().any(|answer| answer == "zh"))
            .expect("Chinese prompt");
        assert_eq!(chinese.language, "Chinês");
        assert!(
            chinese
                .accepted_answers
                .iter()
                .any(|answer| answer == "Chinês")
        );
        assert!(
            chinese
                .accepted_answers
                .iter()
                .any(|answer| answer == "Chinese")
        );
        assert!(
            chinese
                .accepted_answers
                .iter()
                .any(|answer| answer == "中文")
        );
        let mut answered_game = vozen_core::GuessLanguageGame::new(vec![chinese.clone()]);
        assert!(matches!(
            answered_game.begin_round(),
            vozen_core::GuessLanguageEvent::RoundOpened { .. }
        ));
        assert!(matches!(
            answered_game.answer("user", "Diogo", "chines"),
            vozen_core::GuessLanguageEvent::Accepted { language, .. } if language == "Chinês"
        ));
        let mut timed_out_game = vozen_core::GuessLanguageGame::new(vec![chinese.clone()]);
        let _ = timed_out_game.begin_round();
        assert!(matches!(
            timed_out_game.timeout(),
            vozen_core::GuessLanguageEvent::TimedOut { language } if language == "Chinês"
        ));

        let finnish = prompts
            .iter()
            .find(|prompt| prompt.accepted_answers.iter().any(|answer| answer == "fi"))
            .expect("Finnish prompt");
        assert_eq!(finnish.language, "Finlandês");

        let swedish = prompts
            .iter()
            .find(|prompt| prompt.accepted_answers.iter().any(|answer| answer == "sv"))
            .expect("Swedish prompt");
        assert_eq!(swedish.language, "Sueco");
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
