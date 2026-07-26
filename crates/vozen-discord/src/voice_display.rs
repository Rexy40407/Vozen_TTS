//! Generated, Node-compatible voice display names for promoted interaction responses.
//!
//! Node uses `Intl.DisplayNames` at interaction time. Rust consumes the generated result for the
//! current supported UI locales, while retaining Node's raw-model/autonym fallback for an unknown
//! Discord locale or an operator-installed model outside the known Piper locale catalogue.

use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;
use thiserror::Error;

const VOICE_DISPLAY_I18N: &str = include_str!("../../../contracts/voice-display-i18n.json");

#[derive(Debug, Error)]
pub enum VoiceDisplayError {
    #[error("generated voice display contract is invalid")]
    Invalid,
    #[error("generated voice display contract JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Deserialize)]
struct VoiceDisplayContract {
    schema_version: u8,
    supported_locales: Vec<String>,
    autonyms: BTreeMap<String, String>,
    names: BTreeMap<String, LocalizedNames>,
}

#[derive(Debug, Deserialize)]
struct LocalizedNames {
    languages: BTreeMap<String, String>,
    regions: BTreeMap<String, String>,
}

/// Resolves the friendly voice label shown after `/voice set`.
pub struct VoiceDisplayCatalog {
    supported_locales: BTreeSet<String>,
    autonyms: BTreeMap<String, String>,
    names: BTreeMap<String, LocalizedNames>,
}

impl VoiceDisplayCatalog {
    pub fn from_generated_contract() -> Result<Self, VoiceDisplayError> {
        let contract: VoiceDisplayContract = serde_json::from_str(VOICE_DISPLAY_I18N)?;
        if contract.schema_version != 1
            || contract.supported_locales.is_empty()
            || contract.names.len() != contract.supported_locales.len()
            || contract
                .supported_locales
                .iter()
                .any(|locale| !contract.names.contains_key(locale))
        {
            return Err(VoiceDisplayError::Invalid);
        }
        Ok(Self {
            supported_locales: contract.supported_locales.into_iter().collect(),
            autonyms: contract.autonyms,
            names: contract.names,
        })
    }

    /// Mirrors Node's `makeLocalizedNamer(locale, availableModels)` for the response form that
    /// includes both language and voice name. The raw model is intentionally retained as the
    /// final fallback: a new model can never become invisible merely because the display contract
    /// predates it.
    #[must_use]
    pub fn voice_name(
        &self,
        interaction_locale: Option<&str>,
        available_models: &[String],
        model: &str,
    ) -> String {
        let fallback = self.autonym_or_model(model);
        let Some(locale) = interaction_locale.and_then(|value| self.supported_locale(value)) else {
            return fallback;
        };
        let Some((language, region)) = model_locale(model) else {
            return fallback;
        };
        let Some(names) = self.names.get(locale) else {
            return fallback;
        };
        let Some(language_name) = names.languages.get(language) else {
            return fallback;
        };
        let mut label = capitalized(language_name);
        if let Some(region) = region.filter(|_| has_multiple_regions(available_models, language))
            && let Some(region_name) = names.regions.get(region)
        {
            label.push_str(" (");
            label.push_str(region_name);
            label.push(')');
        }
        match voice_label(model) {
            Some(voice) => format!("{label} — {voice}"),
            None => label,
        }
    }

    /// Returns only the localized language/region portion used as a `/voice list` group header.
    #[must_use]
    pub fn language_name(
        &self,
        interaction_locale: Option<&str>,
        available_models: &[String],
        model: &str,
    ) -> String {
        self.voice_name(interaction_locale, available_models, model)
            .split_once(" — ")
            .map_or_else(
                || self.voice_name(interaction_locale, available_models, model),
                |(language, _)| language.to_owned(),
            )
    }

    /// Returns a language name in the requested UI locale without requiring a voice model.
    ///
    /// This mirrors Node's `Intl.DisplayNames` use in the minigames. Unsupported UI locales
    /// fall back to English, while an unknown language remains visible as its original code.
    #[must_use]
    pub fn localized_language_name(
        &self,
        interaction_locale: Option<&str>,
        language: &str,
    ) -> String {
        let locale = interaction_locale
            .and_then(|value| self.supported_locale(value))
            .unwrap_or("en");
        self.names
            .get(locale)
            .and_then(|names| names.languages.get(language))
            .or_else(|| {
                self.names
                    .get("en")
                    .and_then(|names| names.languages.get(language))
            })
            .map_or_else(|| language.to_owned(), |name| capitalized(name))
    }

    /// Returns the friendly voice label without its language prefix.
    #[must_use]
    pub fn voice_label(model: &str) -> String {
        voice_label(model).unwrap_or_else(|| model.to_owned())
    }

    fn supported_locale(&self, raw: &str) -> Option<&str> {
        let base = raw.split('-').next()?.to_ascii_lowercase();
        self.supported_locales.get(&base).map(String::as_str)
    }

    fn autonym_or_model(&self, model: &str) -> String {
        let locale = model.split('-').next().unwrap_or(model);
        let language = self
            .autonyms
            .get(locale)
            .cloned()
            .unwrap_or_else(|| model.to_owned());
        match voice_label(model) {
            Some(voice) if locale != model => format!("{language} — {voice}"),
            _ => language,
        }
    }
}

fn model_locale(model: &str) -> Option<(&str, Option<&str>)> {
    let locale = model.split('-').next()?;
    let (language, region) = locale.split_once('_')?;
    (!language.is_empty() && !region.is_empty()).then_some((language, Some(region)))
}

fn has_multiple_regions(models: &[String], language: &str) -> bool {
    models
        .iter()
        .filter_map(|model| model_locale(model))
        .filter(|(candidate, _)| *candidate == language)
        .map(|(_, region)| region.expect("model locale always has a region"))
        .collect::<BTreeSet<_>>()
        .len()
        > 1
}

fn voice_label(model: &str) -> Option<String> {
    let raw = model.split('-').nth(1)?;
    (!raw.is_empty()).then(|| capitalized(raw))
}

fn capitalized(value: &str) -> String {
    let Some(first) = value.chars().next() else {
        return String::new();
    };
    format!("{}{}", first.to_uppercase(), &value[first.len_utf8()..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn localises_names_and_only_shows_regions_when_needed() {
        let catalog = VoiceDisplayCatalog::from_generated_contract().expect("catalog");
        let models = vec!["en_US-amy-medium".into(), "en_GB-alan-medium".into()];
        assert_eq!(
            catalog.voice_name(Some("fr-CA"), &models, "en_US-amy-medium"),
            "Anglais (États-Unis) — Amy"
        );
        assert_eq!(
            catalog.voice_name(
                Some("pt-BR"),
                &["fr_FR-siwis-medium".into()],
                "fr_FR-siwis-medium"
            ),
            "Francês — Siwis"
        );
    }

    #[test]
    fn exposes_complete_localized_language_names_for_games() {
        let catalog = VoiceDisplayCatalog::from_generated_contract().expect("catalog");
        assert_eq!(
            catalog.localized_language_name(Some("pt-PT"), "zh"),
            "Chinês"
        );
        assert_eq!(
            catalog.localized_language_name(Some("pt"), "fi"),
            "Finlandês"
        );
        assert_eq!(catalog.localized_language_name(Some("pt"), "sv"), "Sueco");
        assert_eq!(catalog.localized_language_name(Some("zh"), "zh"), "中文");
        assert_eq!(
            catalog.localized_language_name(Some("unknown"), "zh"),
            "Chinese"
        );
    }

    #[test]
    fn unknown_ui_or_model_falls_back_without_hiding_the_voice() {
        let catalog = VoiceDisplayCatalog::from_generated_contract().expect("catalog");
        assert_eq!(
            catalog.voice_name(Some("ko"), &["en_US-amy-medium".into()], "en_US-amy-medium"),
            "English (US) — Amy"
        );
        assert_eq!(
            catalog.voice_name(Some("en"), &["custom-model".into()], "custom-model"),
            "custom-model — Model"
        );
    }
}
