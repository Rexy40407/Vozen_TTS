//! Localised rendering for promoted voice command responses.
//!
//! The source strings are generated from the Node catalogue. This adapter owns no user content
//! and makes no network request; callers pass only already-sanitised display values for the small
//! set of existing placeholders.

use std::collections::BTreeMap;

use thiserror::Error;
use vozen_contracts::{VoiceResponseCatalog, VoiceResponseContractError};

use crate::CoreVoiceResponse;

const VOICE_RESPONSE_I18N: &str = include_str!("../../../contracts/voice-response-i18n.json");

#[derive(Debug, Error)]
pub enum VoiceResponseLocalizerError {
    #[error("generated voice response i18n contract is invalid: {0}")]
    Contract(#[from] VoiceResponseContractError),
}

pub struct VoiceResponseLocalizer {
    catalog: VoiceResponseCatalog,
}

impl VoiceResponseLocalizer {
    pub fn from_generated_contract() -> Result<Self, VoiceResponseLocalizerError> {
        Ok(Self {
            catalog: VoiceResponseCatalog::from_json(VOICE_RESPONSE_I18N)?,
        })
    }

    /// Uses Node's locale ordering and keeps an unresolved placeholder literal, matching the
    /// existing TypeScript `t()` function. A `NotPromoted` response intentionally renders no
    /// text so an event handler cannot accidentally claim ownership of it.
    #[must_use]
    pub fn render(
        &self,
        response: CoreVoiceResponse,
        interaction_locale: Option<&str>,
        guild_locale: Option<&str>,
        parameters: &BTreeMap<&str, String>,
    ) -> Option<String> {
        let key = response.catalog_key()?;
        let locale = self
            .catalog
            .resolve_locale(interaction_locale, guild_locale);
        self.catalog
            .message(key, locale)
            .map(|template| interpolate(template, parameters))
    }
}

fn interpolate(template: &str, parameters: &BTreeMap<&str, String>) -> String {
    let mut output = String::with_capacity(template.len());
    let mut remaining = template;
    while let Some(open) = remaining.find('{') {
        output.push_str(&remaining[..open]);
        let after_open = &remaining[open + 1..];
        let Some(close) = after_open.find('}') else {
            output.push_str(&remaining[open..]);
            return output;
        };
        let key = &after_open[..close];
        if !key.is_empty()
            && key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        {
            if let Some(value) = parameters.get(key) {
                output.push_str(value);
            } else {
                output.push_str(&remaining[open..open + close + 2]);
            }
        } else {
            output.push_str(&remaining[open..open + close + 2]);
        }
        remaining = &after_open[close + 1..];
    }
    output.push_str(remaining);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn localizer_uses_node_locale_fallback_and_preserves_missing_placeholders() {
        let localizer = VoiceResponseLocalizer::from_generated_contract().expect("catalog");
        let mut parameters = BTreeMap::new();
        parameters.insert("channel", "#general".into());

        let french = localizer
            .render(
                CoreVoiceResponse::JoinPermissionDenied,
                Some("fr-CA"),
                Some("pt"),
                &parameters,
            )
            .expect("French response");
        assert!(french.contains("#general"));

        let fallback = localizer
            .render(
                CoreVoiceResponse::JoinPermissionDenied,
                Some("ko"),
                Some("pt-BR"),
                &BTreeMap::new(),
            )
            .expect("Portuguese fallback");
        assert!(fallback.contains("{channel}"));
    }
}
