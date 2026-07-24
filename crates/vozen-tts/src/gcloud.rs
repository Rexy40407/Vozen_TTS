//! Official Google Cloud Text-to-Speech adapter.
//!
//! The provider is deliberately fail-safe: when cost limits are configured, a request without
//! a server-resolved [`GcloudBudget`] or without a persistent usage ledger is rejected before
//! any network I/O. Successful responses are strict 22.05 kHz mono LINEAR16 WAV files, matching
//! Piper and gTTS so the existing playback path can be reused.

use std::{
    path::PathBuf,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::Client;
use serde_json::json;
use thiserror::Error;
use tokio::sync::Semaphore;
use vozen_core::{GcloudBudget, GcloudBudgetScope, SynthRequest};

use super::{
    DEFAULT_MAX_CACHE_FILES, TtsError, cache_key, concat_wavs, evict_cache_files, non_empty_file,
    parse_wav, prepend_silence_wav, validate_asset_wav,
};

pub const GCLOUD_SAMPLE_RATE: u32 = 22_050;

#[derive(Debug, Clone, Copy)]
pub struct GcloudLimits {
    pub max_chars: usize,
    pub plus_monthly: i64,
    pub pass3_monthly: i64,
    pub pass8_monthly: i64,
    pub daily_budget: i64,
}

#[derive(Debug, Error, Clone, Copy)]
#[error("Google Cloud usage ledger unavailable")]
pub struct GcloudLedgerError;

pub trait GcloudUsageLedger: Send + Sync {
    fn reserve(
        &self,
        budget: &GcloudBudget,
        now_ms: i64,
        limits: GcloudLimits,
        chars: i64,
    ) -> Result<bool, GcloudLedgerError>;

    fn refund(
        &self,
        budget: &GcloudBudget,
        now_ms: i64,
        limits: GcloudLimits,
        chars: i64,
    ) -> Result<(), GcloudLedgerError>;
}

#[derive(Clone)]
pub struct GcloudOptions {
    pub api_key: String,
    pub cache_dir: PathBuf,
    pub concurrency: usize,
    pub request_timeout: Duration,
    pub limits: Option<GcloudLimits>,
    pub ledger: Option<Arc<dyn GcloudUsageLedger>>,
}

pub struct GcloudEngine {
    client: Client,
    options: GcloudOptions,
    permits: Arc<Semaphore>,
}

impl GcloudEngine {
    pub fn new(options: GcloudOptions) -> Result<Self, TtsError> {
        if options.api_key.trim().is_empty() {
            return Err(TtsError::GcloudConfiguration);
        }
        let client = Client::builder()
            .user_agent("Vozen-Rust-TTS/1")
            .build()
            .map_err(|_| TtsError::GcloudRequest)?;
        Ok(Self {
            permits: Arc::new(Semaphore::new(options.concurrency.max(1))),
            client,
            options,
        })
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
            return Err(TtsError::GcloudResponse);
        }
        let destination = self
            .options
            .cache_dir
            .join(format!("{}.wav", cache_key(request)));
        tokio::fs::create_dir_all(&self.options.cache_dir).await?;
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }

        let chars = request.text.chars().count();
        let (budget, limits, now_ms) = self.authorize(request, chars)?;
        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| TtsError::GcloudRequest)?;
        if non_empty_file(&destination).await? {
            if let (Some(ledger), Some(budget), Some(limits)) =
                (self.options.ledger.as_ref(), budget.as_ref(), limits)
            {
                let _ = ledger.refund(budget, now_ms, limits, chars as i64);
            }
            return Ok(destination);
        }
        let result = self.fetch_wav(request).await;
        if result.is_err()
            && let (Some(ledger), Some(budget), Some(limits)) =
                (self.options.ledger.as_ref(), budget.as_ref(), limits)
        {
            let _ = ledger.refund(budget, now_ms, limits, chars as i64);
        }
        let mut wav = result?;
        if lead_silence_ms > 0 {
            wav = prepend_silence_wav(&wav, lead_silence_ms)?;
        }
        self.write_cached_wav(destination, wav).await
    }

    fn authorize(
        &self,
        request: &SynthRequest,
        chars: usize,
    ) -> Result<(Option<GcloudBudget>, Option<GcloudLimits>, i64), TtsError> {
        let Some(limits) = self.options.limits else {
            return Ok((None, None, now_ms()));
        };
        if chars > limits.max_chars {
            return Err(TtsError::GcloudBudgetDenied);
        }
        let Some(budget) = request.gcloud_budget.clone() else {
            return Err(TtsError::GcloudBudgetMissing);
        };
        let Some(ledger) = self.options.ledger.as_ref() else {
            return Err(TtsError::GcloudBudgetDenied);
        };
        let now = now_ms();
        let allowed = ledger
            .reserve(&budget, now, limits, chars as i64)
            .map_err(|_| TtsError::GcloudBudgetDenied)?;
        if !allowed {
            return Err(TtsError::GcloudBudgetDenied);
        }
        Ok((Some(budget), Some(limits), now))
    }

    async fn fetch_wav(&self, request: &SynthRequest) -> Result<Vec<u8>, TtsError> {
        let mut audio_config = json!({
            "audioEncoding": "LINEAR16",
            "sampleRateHertz": GCLOUD_SAMPLE_RATE,
        });
        if request.speed.is_finite() && (request.speed - 1.0).abs() > f64::EPSILON {
            audio_config["speakingRate"] = json!(request.speed.clamp(0.25, 4.0));
        }
        let response = self
            .client
            .post("https://texttospeech.googleapis.com/v1/text:synthesize")
            .header("X-Goog-Api-Key", &self.options.api_key)
            .json(&json!({
                "input": { "text": super::lower_all_caps_runs(&request.text) },
                "voice": { "languageCode": bcp47_of_model(&request.model) },
                "audioConfig": audio_config,
            }))
            .timeout(self.options.request_timeout)
            .send()
            .await
            .map_err(|error| {
                if error.is_timeout() {
                    TtsError::GcloudTimeout
                } else {
                    TtsError::GcloudRequest
                }
            })?;
        if !response.status().is_success() {
            return Err(TtsError::GcloudResponse);
        }
        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|_| TtsError::GcloudResponse)?;
        let encoded = body
            .get("audioContent")
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or(TtsError::GcloudResponse)?;
        let wav = STANDARD
            .decode(encoded)
            .map_err(|_| TtsError::GcloudResponse)?;
        parse_wav(&wav).map_err(|_| TtsError::GcloudResponse)?;
        Ok(wav)
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
            .join(format!(".gcloud-{}.wav", uuid::Uuid::new_v4()));
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

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

pub fn bcp47_of_model(model: &str) -> String {
    let locale = model.split('-').next().unwrap_or_default();
    let Some((language, region)) = locale.split_once('_') else {
        return "en-US".to_owned();
    };
    if language.len() < 2 || region.len() < 2 {
        return "en-US".to_owned();
    }
    format!(
        "{}-{}",
        language.to_ascii_lowercase(),
        region.to_ascii_uppercase()
    )
}

#[must_use]
pub fn monthly_limit_for(budget: &GcloudBudget, limits: GcloudLimits) -> i64 {
    match budget.scope {
        GcloudBudgetScope::User => limits.plus_monthly,
        GcloudBudgetScope::Pass if budget.seats.unwrap_or(8) <= 3 => limits.pass3_monthly,
        GcloudBudgetScope::Pass => limits.pass8_monthly,
        GcloudBudgetScope::Guild => limits.pass3_monthly,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> SynthRequest {
        SynthRequest {
            text: "hello".into(),
            model: "en_US-amy-medium".into(),
            asset_path: None,
            speed: 1.0,
            engine: vozen_core::SynthesisEngine::Gcloud,
            gcloud_budget: None,
            segments: None,
            single_voice: None,
            emphasis_source: None,
            lead_silence_ms: 0,
        }
    }

    #[test]
    fn maps_piper_locales_to_google_bcp47() {
        assert_eq!(bcp47_of_model("pt_PT-tuga-medium"), "pt-PT");
        assert_eq!(bcp47_of_model("en_US-amy-medium"), "en-US");
        assert_eq!(bcp47_of_model("unknown"), "en-US");
    }

    #[test]
    fn chooses_pass_allowance_by_seats() {
        let limits = GcloudLimits {
            max_chars: 500,
            plus_monthly: 10,
            pass3_monthly: 20,
            pass8_monthly: 30,
            daily_budget: 40,
        };
        let three = GcloudBudget {
            scope: GcloudBudgetScope::Pass,
            key: "owner".into(),
            seats: Some(3),
        };
        let eight = GcloudBudget {
            scope: GcloudBudgetScope::Pass,
            key: "owner".into(),
            seats: Some(8),
        };
        assert_eq!(monthly_limit_for(&three, limits), 20);
        assert_eq!(monthly_limit_for(&eight, limits), 30);
    }

    #[tokio::test]
    async fn missing_budget_is_rejected_before_network_io() {
        let cache_dir =
            std::env::temp_dir().join(format!("vozen-gcloud-test-{}", uuid::Uuid::new_v4()));
        let engine = GcloudEngine::new(GcloudOptions {
            api_key: "test-key".into(),
            cache_dir: cache_dir.clone(),
            concurrency: 1,
            request_timeout: Duration::from_millis(10),
            limits: Some(GcloudLimits {
                max_chars: 500,
                plus_monthly: 10,
                pass3_monthly: 20,
                pass8_monthly: 30,
                daily_budget: 40,
            }),
            ledger: None,
        })
        .expect("configured engine");
        assert!(matches!(
            engine.synth(&request()).await,
            Err(TtsError::GcloudBudgetMissing)
        ));
        let _ = tokio::fs::remove_dir_all(cache_dir).await;
    }
}
