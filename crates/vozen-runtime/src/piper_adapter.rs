//! Runtime composition of the local Piper engine and the Discord command service.
//!
//! `vozen-tts` deliberately knows nothing about Discord. This one-way adapter maps only a
//! synthesis failure into the command service's content-free error, so neither a filesystem path
//! nor a Piper process diagnostic can reach Discord or the process log through a user request.

use std::{path::PathBuf, sync::Arc};

use async_trait::async_trait;
use vozen_core::SynthRequest;
use vozen_discord::{CommandSpeechSynthesizer, CommandSynthesisError};
use vozen_tts::{CommandPiperRunner, PiperEngine, PiperRunner};

pub struct PiperCommandSynthesizer<R = CommandPiperRunner> {
    engine: Arc<PiperEngine<R>>,
}

impl<R> PiperCommandSynthesizer<R> {
    #[must_use]
    pub fn new(engine: Arc<PiperEngine<R>>) -> Self {
        Self { engine }
    }
}

impl PiperCommandSynthesizer<CommandPiperRunner> {
    #[must_use]
    pub fn production(
        executable: impl Into<PathBuf>,
        models_dir: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        concurrency: usize,
    ) -> Self {
        Self::new(Arc::new(PiperEngine::production(
            executable,
            models_dir,
            cache_dir,
            concurrency,
        )))
    }
}

#[async_trait]
impl<R> CommandSpeechSynthesizer for PiperCommandSynthesizer<R>
where
    R: PiperRunner + 'static,
{
    async fn synthesize(&self, request: &SynthRequest) -> Result<PathBuf, CommandSynthesisError> {
        self.engine
            .synth(request)
            .await
            .map_err(|_| CommandSynthesisError)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        path::Path,
        sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        },
        time::{SystemTime, UNIX_EPOCH},
    };

    use async_trait::async_trait;
    use vozen_tts::TtsError;

    use super::*;

    #[derive(Default)]
    struct FailingRunner {
        calls: AtomicUsize,
    }

    #[async_trait]
    impl PiperRunner for FailingRunner {
        async fn run(
            &self,
            _model: &Path,
            _output: &Path,
            _text: &str,
            _speed: f64,
        ) -> Result<(), TtsError> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            Err(TtsError::ProcessFailed)
        }
    }

    fn request() -> SynthRequest {
        SynthRequest {
            text: "private text".into(),
            model: "en_US-amy-medium".into(),
            speed: 1.0,
            segments: None,
            single_voice: None,
            emphasis_source: None,
        }
    }

    #[tokio::test]
    async fn piper_failures_are_mapped_to_a_content_free_command_error() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "vozen-piper-adapter-{}-{nonce}",
            std::process::id()
        ));
        let models = root.join("models");
        std::fs::create_dir_all(&models).expect("models directory");
        std::fs::write(models.join("en_US-amy-medium.onnx"), b"placeholder")
            .expect("model placeholder");
        let runner = Arc::new(FailingRunner::default());
        let adapter = PiperCommandSynthesizer::new(Arc::new(PiperEngine::new(
            runner.clone(),
            &models,
            root.join("cache"),
            1,
        )));

        assert!(adapter.synthesize(&request()).await.is_err());
        assert_eq!(runner.calls.load(Ordering::Relaxed), 1);
        let _ = std::fs::remove_dir_all(root);
    }
}
