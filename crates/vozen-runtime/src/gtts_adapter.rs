//! Discord-facing adapter for the opt-in Rust gTTS engine.

use std::{path::PathBuf, sync::Arc, time::Instant};

use async_trait::async_trait;
use vozen_core::{RuntimeMetrics, SynthRequest, SynthesisEngine};
use vozen_discord::{CommandSpeechSynthesizer, CommandSynthesisError};
use vozen_tts::{GttsEngine, GttsOptions};

#[derive(Clone)]
pub struct GttsCommandSynthesizer {
    engine: Arc<GttsEngine>,
    metrics: Arc<RuntimeMetrics>,
}

pub struct GttsWithPiperFallback {
    primary: Arc<dyn CommandSpeechSynthesizer>,
    fallback: Arc<dyn CommandSpeechSynthesizer>,
}

impl GttsWithPiperFallback {
    #[must_use]
    pub fn new(
        primary: Arc<dyn CommandSpeechSynthesizer>,
        fallback: Arc<dyn CommandSpeechSynthesizer>,
    ) -> Self {
        Self { primary, fallback }
    }
}

impl GttsCommandSynthesizer {
    pub fn production(
        ffmpeg: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        metrics: Arc<RuntimeMetrics>,
    ) -> Result<Self, CommandSynthesisError> {
        let engine = GttsEngine::new(GttsOptions::production(ffmpeg, cache_dir))
            .map_err(|_| CommandSynthesisError)?;
        Ok(Self {
            engine: Arc::new(engine),
            metrics,
        })
    }
}

#[async_trait]
impl CommandSpeechSynthesizer for GttsCommandSynthesizer {
    async fn synthesize(&self, request: &SynthRequest) -> Result<PathBuf, CommandSynthesisError> {
        if !matches!(request.engine, SynthesisEngine::Default) {
            return Err(CommandSynthesisError);
        }
        let started = Instant::now();
        let result = self.engine.synth(request).await;
        self.metrics
            .record_synth_latency_ms(started.elapsed().as_millis().min(u64::MAX as u128) as u64);
        if result.is_err() {
            self.metrics.record_synth_error();
        }
        result.map_err(|_| CommandSynthesisError)
    }
}

#[async_trait]
impl CommandSpeechSynthesizer for GttsWithPiperFallback {
    async fn synthesize(&self, request: &SynthRequest) -> Result<PathBuf, CommandSynthesisError> {
        match self.primary.synthesize(request).await {
            Ok(path) => Ok(path),
            Err(_) => {
                let mut fallback_request = request.clone();
                fallback_request.engine = SynthesisEngine::Piper;
                self.fallback.synthesize(&fallback_request).await
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(engine: SynthesisEngine) -> SynthRequest {
        SynthRequest {
            text: "hello".into(),
            model: "en_US-amy-medium".into(),
            asset_path: None,
            speed: 1.0,
            engine,
            gcloud_budget: None,
            segments: None,
            single_voice: None,
            emphasis_source: None,
            lead_silence_ms: 0,
        }
    }

    #[test]
    fn provider_adapter_is_only_the_default_route() {
        assert!(matches!(
            request(SynthesisEngine::Default).engine,
            SynthesisEngine::Default
        ));
        assert!(matches!(
            request(SynthesisEngine::Piper).engine,
            SynthesisEngine::Piper
        ));
    }

    #[tokio::test]
    async fn failed_default_provider_uses_piper_fallback() {
        struct Failing;
        #[async_trait]
        impl CommandSpeechSynthesizer for Failing {
            async fn synthesize(
                &self,
                _request: &SynthRequest,
            ) -> Result<PathBuf, CommandSynthesisError> {
                Err(CommandSynthesisError)
            }
        }

        struct Successful;
        #[async_trait]
        impl CommandSpeechSynthesizer for Successful {
            async fn synthesize(
                &self,
                request: &SynthRequest,
            ) -> Result<PathBuf, CommandSynthesisError> {
                assert_eq!(request.engine, SynthesisEngine::Piper);
                Ok("piper.wav".into())
            }
        }

        let fallback = GttsWithPiperFallback::new(Arc::new(Failing), Arc::new(Successful));
        let output = fallback
            .synthesize(&request(SynthesisEngine::Default))
            .await
            .expect("fallback synthesis");
        assert_eq!(output, PathBuf::from("piper.wav"));
    }
}
