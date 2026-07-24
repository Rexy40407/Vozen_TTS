//! OpenAI `tts-1` provider used by the legacy `TTS_ENGINE=neural` mode.
//!
//! The adapter keeps the same WAV/cache boundary as the local and Google providers. The API
//! key is supplied only by the operator; no request field can alter the endpoint or command
//! line. A malformed/empty response is rejected before it can enter the playback queue.

use std::{path::PathBuf, time::Duration};

use reqwest::Client;
use serde_json::json;
use tokio::time::timeout;
use vozen_core::SynthRequest;

use super::{
    DEFAULT_MAX_CACHE_FILES, TtsError, cache_key, concat_wavs, evict_cache_files,
    lower_all_caps_runs, non_empty_file, parse_wav, prepend_silence_wav, validate_asset_wav,
};

pub const NEURAL_TIMEOUT: Duration = Duration::from_secs(15);
pub const OPENAI_TTS_MODEL: &str = "tts-1";

const OPENAI_TTS_URL: &str = "https://api.openai.com/v1/audio/speech";
const OPENAI_VOICES: [&str; 6] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

#[derive(Clone)]
pub struct NeuralOptions {
    pub api_key: String,
    pub cache_dir: PathBuf,
    pub request_timeout: Duration,
}

impl NeuralOptions {
    #[must_use]
    pub fn production(api_key: impl Into<String>, cache_dir: impl Into<PathBuf>) -> Self {
        Self {
            api_key: api_key.into(),
            cache_dir: cache_dir.into(),
            request_timeout: NEURAL_TIMEOUT,
        }
    }
}

pub struct NeuralEngine {
    client: Client,
    options: NeuralOptions,
}

impl NeuralEngine {
    pub fn new(options: NeuralOptions) -> Result<Self, TtsError> {
        if options.api_key.trim().is_empty() {
            return Err(TtsError::NeuralConfiguration);
        }
        let client = Client::builder()
            .user_agent("Vozen-Rust-TTS/1")
            .build()
            .map_err(|_| TtsError::NeuralRequest)?;
        Ok(Self { client, options })
    }

    pub async fn synth(&self, request: &SynthRequest) -> Result<PathBuf, TtsError> {
        if let Some(asset_path) = request.asset_path.as_deref() {
            return validate_asset_wav(asset_path).await;
        }
        let Some(segments) = request
            .segments
            .as_deref()
            .filter(|segments| !segments.is_empty())
        else {
            return self.synth_single(request, request.lead_silence_ms).await;
        };
        if segments.len() == 1 {
            let mut single = request.clone();
            single.text = segments[0].text.clone();
            single.model = segments[0].model.clone();
            single.segments = None;
            return self.synth_single(&single, request.lead_silence_ms).await;
        }

        let mut wavs = Vec::with_capacity(segments.len());
        for segment in segments {
            let mut single = request.clone();
            single.text = segment.text.clone();
            single.model = segment.model.clone();
            single.segments = None;
            single.lead_silence_ms = 0;
            wavs.push(tokio::fs::read(self.synth_single(&single, 0).await?).await?);
        }
        let combined = concat_wavs(&wavs, 60).map_err(TtsError::Wav)?;
        let combined = prepend_silence_wav(&combined, request.lead_silence_ms)?;
        let destination = self
            .options
            .cache_dir
            .join(format!("{}.wav", cache_key(request)));
        self.write_cached_wav(destination, combined).await
    }

    async fn synth_single(
        &self,
        request: &SynthRequest,
        lead_silence_ms: u32,
    ) -> Result<PathBuf, TtsError> {
        if request.text.trim().is_empty() {
            return Err(TtsError::NeuralResponse);
        }
        tokio::fs::create_dir_all(&self.options.cache_dir).await?;
        let destination = self
            .options
            .cache_dir
            .join(format!("{}.wav", cache_key(request)));
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }
        let mut wav = self.fetch_wav(request).await?;
        if lead_silence_ms > 0 {
            wav = prepend_silence_wav(&wav, lead_silence_ms)?;
        }
        self.write_cached_wav(destination, wav).await
    }

    async fn fetch_wav(&self, request: &SynthRequest) -> Result<Vec<u8>, TtsError> {
        let body = json!({
            "model": OPENAI_TTS_MODEL,
            "voice": openai_voice_for_model(&request.model),
            "input": lower_all_caps_runs(&request.text),
            "speed": if request.speed > 0.0 { request.speed } else { 1.0 },
            "response_format": "wav",
        });
        let response = timeout(
            self.options.request_timeout,
            self.client
                .post(OPENAI_TTS_URL)
                .bearer_auth(&self.options.api_key)
                .json(&body)
                .send(),
        )
        .await
        .map_err(|_| TtsError::NeuralTimeout)?
        .map_err(|_| TtsError::NeuralRequest)?;
        if !response.status().is_success() {
            return Err(TtsError::NeuralResponse);
        }
        let bytes = timeout(self.options.request_timeout, response.bytes())
            .await
            .map_err(|_| TtsError::NeuralTimeout)?
            .map_err(|_| TtsError::NeuralRequest)?;
        if bytes.is_empty() {
            return Err(TtsError::NeuralResponse);
        }
        parse_wav(&bytes).map_err(|_| TtsError::NeuralResponse)?;
        Ok(bytes.to_vec())
    }

    async fn write_cached_wav(
        &self,
        destination: PathBuf,
        wav: Vec<u8>,
    ) -> Result<PathBuf, TtsError> {
        tokio::fs::create_dir_all(&self.options.cache_dir).await?;
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }
        let temporary = self
            .options
            .cache_dir
            .join(format!(".neural-{}.wav", uuid::Uuid::new_v4()));
        tokio::fs::write(&temporary, wav).await?;
        match tokio::fs::rename(&temporary, &destination).await {
            Ok(()) => {
                let _ = evict_cache_files(
                    &self.options.cache_dir,
                    &destination,
                    DEFAULT_MAX_CACHE_FILES,
                )
                .await;
                Ok(destination)
            }
            Err(_) if non_empty_file(&destination).await.unwrap_or(false) => {
                let _ = tokio::fs::remove_file(&temporary).await;
                Ok(destination)
            }
            Err(error) => {
                let _ = tokio::fs::remove_file(&temporary).await;
                Err(TtsError::Io(error))
            }
        }
    }
}

/// Maps a Piper-style model identifier to one of the six `tts-1` voice names. This mirrors the
/// legacy substring rule and keeps unknown/future model ids on the stable `alloy` default.
#[must_use]
pub fn openai_voice_for_model(model: &str) -> String {
    let lower = model.to_ascii_lowercase();
    OPENAI_VOICES
        .iter()
        .find(|voice| lower.contains(**voice))
        .copied()
        .unwrap_or("alloy")
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_and_unknown_voice_names() {
        assert_eq!(openai_voice_for_model("en_US-openai-nova"), "nova");
        assert_eq!(openai_voice_for_model("en_US-amy-medium"), "alloy");
    }

    #[test]
    fn rejects_blank_api_key() {
        assert!(matches!(
            NeuralEngine::new(NeuralOptions::production(" ", "cache")),
            Err(TtsError::NeuralConfiguration)
        ));
    }
}
