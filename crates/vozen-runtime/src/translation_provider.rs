//! Azure Translator boundary for the opt-in Rust migration.
//!
//! The caller supplies only already-minimised message text. Configuration intentionally degrades
//! to disabled for every malformed value, matching the Node runtime and avoiding an accidental
//! external data flow merely because unrelated environment variables are present.

use std::{env, time::Duration};

use async_trait::async_trait;
use reqwest::{Client, Url, header::HeaderName};
use serde_json::json;
use vozen_discord::ExplicitTranslationProvider;

const TRANSLATION_TIMEOUT: Duration = Duration::from_secs(10);
const AZURE_SUBSCRIPTION_KEY: HeaderName = HeaderName::from_static("ocp-apim-subscription-key");

/// `None` means disabled. The type deliberately omits `Debug`, preventing endpoint or key
/// disclosure through a routine runtime error or log statement.
pub struct AzureTranslationProvider {
    endpoint: Url,
    api_key: String,
    client: Client,
}

impl AzureTranslationProvider {
    /// Returns `None` unless the existing `TRANSLATION_PROVIDER=azure` configuration is fully
    /// valid. It never reports individual credentials or URLs to Discord.
    pub fn from_environment() -> Option<Self> {
        let requested = env::var("TRANSLATION_PROVIDER")
            .ok()?
            .trim()
            .to_ascii_lowercase();
        if requested != "azure" {
            return None;
        }
        let endpoint = env::var("TRANSLATION_AZURE_ENDPOINT").ok()?;
        let api_key = env::var("TRANSLATION_AZURE_KEY").ok()?;
        Self::from_parts(&endpoint, &api_key)
    }

    fn from_parts(endpoint: &str, api_key: &str) -> Option<Self> {
        let endpoint = endpoint.trim().trim_end_matches('/');
        let api_key = api_key.trim();
        if endpoint.is_empty() || api_key.is_empty() {
            return None;
        }
        let endpoint = Url::parse(endpoint).ok()?;
        if endpoint.scheme() != "https"
            || endpoint.query().is_some()
            || endpoint.fragment().is_some()
        {
            return None;
        }
        let client = Client::builder()
            .timeout(TRANSLATION_TIMEOUT)
            .build()
            .ok()?;
        Some(Self {
            endpoint,
            api_key: api_key.to_owned(),
            client,
        })
    }

    fn translate_url(&self, target_locale: &str) -> Result<Url, ()> {
        if target_locale.trim().is_empty() {
            return Err(());
        }
        let mut url = self.endpoint.clone();
        let base_path = url.path().trim_end_matches('/');
        url.set_path(&format!("{base_path}/translate"));
        url.query_pairs_mut()
            .append_pair("api-version", "3.0")
            .append_pair("to", target_locale);
        Ok(url)
    }
}

#[async_trait]
impl ExplicitTranslationProvider for AzureTranslationProvider {
    fn is_enabled(&self) -> bool {
        true
    }

    async fn translate(&self, text: &str, target_locale: &str) -> Result<String, ()> {
        let url = self.translate_url(target_locale)?;
        let response = self
            .client
            .post(url)
            .header(AZURE_SUBSCRIPTION_KEY, &self.api_key)
            .json(&json!([{ "Text": text }]))
            .send()
            .await
            .map_err(|_| ())?;
        let status = response.status();
        if status.as_u16() == 429 || status.is_server_error() || !status.is_success() {
            return Err(());
        }
        let body: serde_json::Value = response.json().await.map_err(|_| ())?;
        body.as_array()
            .and_then(|responses| responses.first())
            .and_then(|first| first.get("translations"))
            .and_then(serde_json::Value::as_array)
            .and_then(|translations| translations.first())
            .and_then(|translation| translation.get("text"))
            .and_then(serde_json::Value::as_str)
            .filter(|text| !text.trim().is_empty())
            .map(str::to_owned)
            .ok_or(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_accepts_complete_https_azure_configuration() {
        assert!(AzureTranslationProvider::from_parts("", "key").is_none());
        assert!(AzureTranslationProvider::from_parts("https://translator.test", "").is_none());
        assert!(AzureTranslationProvider::from_parts("http://translator.test", "key").is_none());
        assert!(AzureTranslationProvider::from_parts("not a url", "key").is_none());
        assert!(
            AzureTranslationProvider::from_parts("https://translator.test///", "key").is_some()
        );
    }

    #[test]
    fn creates_the_node_compatible_translate_url_without_exposing_the_key() {
        let provider =
            AzureTranslationProvider::from_parts("https://translator.test/api/", "secret")
                .expect("provider");
        assert_eq!(
            provider.translate_url("pt-PT").expect("url").as_str(),
            "https://translator.test/api/translate?api-version=3.0&to=pt-PT"
        );
        assert!(provider.translate_url(" ").is_err());
    }
}
