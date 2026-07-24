//! Per-user provider routing for the Rust TTS migration.
//!
//! The legacy `google` value is a configured default route. Provider-specific selections use
//! their provider when installed and fall back to that default on absence or failure, matching
//! Node's no-silence policy. This module deliberately does not invent provider implementations:
//! Kokoro and Google HD become real routes only when their adapters are installed.

use std::sync::Arc;

use async_trait::async_trait;
use vozen_core::{SynthRequest, SynthesisEngine};
use vozen_discord::{CommandSpeechSynthesizer, CommandSynthesisError};

use crate::piper_adapter::PiperCommandSynthesizer;

#[derive(Clone)]
pub struct PerUserCommandSynthesizer {
    default: Arc<dyn CommandSpeechSynthesizer>,
    piper: Arc<dyn CommandSpeechSynthesizer>,
    kokoro: Option<Arc<dyn CommandSpeechSynthesizer>>,
    gcloud: Option<Arc<dyn CommandSpeechSynthesizer>>,
}

impl PerUserCommandSynthesizer {
    #[must_use]
    pub fn piper_only(piper: PiperCommandSynthesizer) -> Self {
        let piper: Arc<dyn CommandSpeechSynthesizer> = Arc::new(piper);
        Self::new(piper.clone(), piper, None, None)
    }

    #[must_use]
    pub fn new(
        default: Arc<dyn CommandSpeechSynthesizer>,
        piper: Arc<dyn CommandSpeechSynthesizer>,
        kokoro: Option<Arc<dyn CommandSpeechSynthesizer>>,
        gcloud: Option<Arc<dyn CommandSpeechSynthesizer>>,
    ) -> Self {
        Self {
            default,
            piper,
            kokoro,
            gcloud,
        }
    }

    async fn default_synthesis(
        &self,
        request: &SynthRequest,
    ) -> Result<std::path::PathBuf, CommandSynthesisError> {
        self.default
            .synthesize(&with_engine(request, SynthesisEngine::Default))
            .await
    }

    async fn preferred_or_default(
        &self,
        provider: Option<&Arc<dyn CommandSpeechSynthesizer>>,
        request: &SynthRequest,
        engine: SynthesisEngine,
    ) -> Result<std::path::PathBuf, CommandSynthesisError> {
        let Some(provider) = provider else {
            return self.default_synthesis(request).await;
        };
        match provider.synthesize(&with_engine(request, engine)).await {
            Ok(path) => Ok(path),
            Err(_) => self.default_synthesis(request).await,
        }
    }
}

#[async_trait]
impl CommandSpeechSynthesizer for PerUserCommandSynthesizer {
    async fn synthesize(
        &self,
        request: &SynthRequest,
    ) -> Result<std::path::PathBuf, CommandSynthesisError> {
        match request.engine {
            SynthesisEngine::Default => self.default_synthesis(request).await,
            SynthesisEngine::Piper if Arc::ptr_eq(&self.default, &self.piper) => {
                self.piper
                    .synthesize(&with_engine(request, SynthesisEngine::Piper))
                    .await
            }
            SynthesisEngine::Piper => {
                self.preferred_or_default(Some(&self.piper), request, SynthesisEngine::Piper)
                    .await
            }
            SynthesisEngine::Kokoro => {
                self.preferred_or_default(self.kokoro.as_ref(), request, SynthesisEngine::Kokoro)
                    .await
            }
            SynthesisEngine::Gcloud => {
                self.preferred_or_default(self.gcloud.as_ref(), request, SynthesisEngine::Gcloud)
                    .await
            }
        }
    }
}

fn with_engine(request: &SynthRequest, engine: SynthesisEngine) -> SynthRequest {
    let mut routed = request.clone();
    routed.engine = engine;
    routed
}

#[cfg(test)]
mod tests {
    use std::sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    };

    use super::*;

    #[derive(Default)]
    struct FakeSynthesizer {
        received: Mutex<Vec<SynthesisEngine>>,
        fails: AtomicBool,
    }

    #[async_trait]
    impl CommandSpeechSynthesizer for FakeSynthesizer {
        async fn synthesize(
            &self,
            request: &SynthRequest,
        ) -> Result<std::path::PathBuf, CommandSynthesisError> {
            self.received.lock().expect("received").push(request.engine);
            if self.fails.load(Ordering::Relaxed) {
                Err(CommandSynthesisError)
            } else {
                Ok("audio.wav".into())
            }
        }
    }

    fn request(engine: SynthesisEngine) -> SynthRequest {
        SynthRequest {
            text: "private text".into(),
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

    #[tokio::test]
    async fn unavailable_paid_engine_uses_the_configured_default() {
        let default = Arc::new(FakeSynthesizer::default());
        let router = PerUserCommandSynthesizer::new(
            default.clone(),
            Arc::new(FakeSynthesizer::default()),
            None,
            None,
        );

        router
            .synthesize(&request(SynthesisEngine::Kokoro))
            .await
            .expect("fallback");
        assert_eq!(
            *default.received.lock().expect("received"),
            [SynthesisEngine::Default]
        );
    }

    #[tokio::test]
    async fn failed_provider_falls_back_without_relabeling_the_provider_request() {
        let default = Arc::new(FakeSynthesizer::default());
        let kokoro = Arc::new(FakeSynthesizer::default());
        kokoro.fails.store(true, Ordering::Relaxed);
        let router = PerUserCommandSynthesizer::new(
            default.clone(),
            Arc::new(FakeSynthesizer::default()),
            Some(kokoro.clone()),
            None,
        );

        router
            .synthesize(&request(SynthesisEngine::Kokoro))
            .await
            .expect("fallback");
        assert_eq!(
            *kokoro.received.lock().expect("received"),
            [SynthesisEngine::Kokoro]
        );
        assert_eq!(
            *default.received.lock().expect("received"),
            [SynthesisEngine::Default]
        );
    }
}
