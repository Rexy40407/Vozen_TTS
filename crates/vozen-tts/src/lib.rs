#![forbid(unsafe_code)]

//! Local Piper synthesis boundary for the Rust runtime.
//!
//! It performs no network I/O. Cache misses are bounded by a shared semaphore and Piper is
//! spawned with argument vectors, never a shell, so a Discord-provided model cannot alter a
//! command line or escape the configured model directory.

use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use async_trait::async_trait;
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::{io::AsyncWriteExt, process::Command, sync::Semaphore, time::timeout};
use uuid::Uuid;
use vozen_core::SynthRequest;

pub const PIPER_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Error)]
pub enum TtsError {
    #[error("invalid Piper model name")]
    InvalidModel,
    #[error("Piper model was not found")]
    ModelMissing,
    #[error("Piper synthesis timed out")]
    Timeout,
    #[error("Piper process failed")]
    ProcessFailed,
    #[error("Piper did not produce a non-empty WAV")]
    EmptyOutput,
    #[error("segmented speech requires the queued WAV compositor")]
    SegmentedRequestUnsupported,
    #[error("TTS I/O failed: {0}")]
    Io(#[from] std::io::Error),
}

/// Returns false for every path-like or empty identifier before a filesystem path is built.
pub fn is_safe_model_name(model: &str) -> bool {
    !model.is_empty()
        && model != "."
        && model != ".."
        && !model.contains('/')
        && !model.contains('\\')
        && !model.contains('\0')
}

#[async_trait]
pub trait PiperRunner: Send + Sync {
    async fn run(
        &self,
        model: &Path,
        output: &Path,
        text: &str,
        speed: f64,
    ) -> Result<(), TtsError>;
}

/// Production runner. `Command` passes arguments directly to Piper; no user text becomes an arg.
pub struct CommandPiperRunner {
    executable: PathBuf,
    timeout: Duration,
}

impl CommandPiperRunner {
    pub fn new(executable: impl Into<PathBuf>) -> Self {
        Self {
            executable: executable.into(),
            timeout: PIPER_TIMEOUT,
        }
    }

    pub fn with_timeout(executable: impl Into<PathBuf>, timeout: Duration) -> Self {
        Self {
            executable: executable.into(),
            timeout,
        }
    }
}

#[async_trait]
impl PiperRunner for CommandPiperRunner {
    async fn run(
        &self,
        model: &Path,
        output: &Path,
        text: &str,
        speed: f64,
    ) -> Result<(), TtsError> {
        let mut child = Command::new(&self.executable)
            .arg("--model")
            .arg(model)
            .arg("--output_file")
            .arg(output)
            .arg("--length_scale")
            .arg(speed_to_length_scale(speed).to_string())
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(TtsError::Io)?;
        let Some(mut stdin) = child.stdin.take() else {
            return Err(TtsError::ProcessFailed);
        };
        stdin.write_all(text.as_bytes()).await?;
        stdin.write_all(b"\n").await?;
        drop(stdin);
        match timeout(self.timeout, child.wait()).await {
            Ok(Ok(status)) if status.success() => Ok(()),
            Ok(Ok(_)) | Ok(Err(_)) => Err(TtsError::ProcessFailed),
            Err(_) => {
                let _ = child.kill().await;
                Err(TtsError::Timeout)
            }
        }
    }
}

/// A local WAV cache backed by immutable SHA-256 file names.
pub struct PiperEngine<R = CommandPiperRunner> {
    runner: Arc<R>,
    models_dir: PathBuf,
    cache_dir: PathBuf,
    permits: Arc<Semaphore>,
}

impl PiperEngine<CommandPiperRunner> {
    pub fn production(
        executable: impl Into<PathBuf>,
        models_dir: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        concurrency: usize,
    ) -> Self {
        Self::new(
            Arc::new(CommandPiperRunner::new(executable)),
            models_dir,
            cache_dir,
            concurrency,
        )
    }
}

impl<R: PiperRunner> PiperEngine<R> {
    pub fn new(
        runner: Arc<R>,
        models_dir: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        concurrency: usize,
    ) -> Self {
        Self {
            runner,
            models_dir: models_dir.into(),
            cache_dir: cache_dir.into(),
            permits: Arc::new(Semaphore::new(concurrency.max(1))),
        }
    }

    /// Returns the cached immutable WAV path, synthesising at most `concurrency` misses.
    pub async fn synth(&self, request: &SynthRequest) -> Result<PathBuf, TtsError> {
        // `segments` represent deliberately different voice/language selections. Treating the
        // outer `text` as a single Piper utterance would silently discard that routing decision
        // and speak part of the message with the wrong voice. The future queue compositor will
        // synthesise each segment then concatenate compatible WAV frames; until then fail closed.
        if request.segments.is_some() {
            return Err(TtsError::SegmentedRequestUnsupported);
        }
        if !is_safe_model_name(&request.model) {
            return Err(TtsError::InvalidModel);
        }
        let model = self.models_dir.join(format!("{}.onnx", request.model));
        if !model.is_file() {
            return Err(TtsError::ModelMissing);
        }
        tokio::fs::create_dir_all(&self.cache_dir).await?;
        let destination = self.cache_dir.join(format!("{}.wav", cache_key(request)));
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }

        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| TtsError::ProcessFailed)?;
        // Check again after waiting: another request may have completed this exact cache key.
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }
        let temporary = self.cache_dir.join(format!(".{}.wav", Uuid::new_v4()));
        let result = self
            .runner
            .run(&model, &temporary, &request.text, request.speed)
            .await;
        if result.is_ok() && !non_empty_file(&temporary).await? {
            let _ = tokio::fs::remove_file(&temporary).await;
            return Err(TtsError::EmptyOutput);
        }
        result?;
        // A simultaneous matching request can win the race. Its immutable cache result is valid.
        match tokio::fs::rename(&temporary, &destination).await {
            Ok(()) => Ok(destination),
            Err(_error) if non_empty_file(&destination).await.unwrap_or(false) => {
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

async fn non_empty_file(path: &Path) -> Result<bool, std::io::Error> {
    match tokio::fs::metadata(path).await {
        Ok(metadata) => Ok(metadata.is_file() && metadata.len() > 0),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

fn cache_key(request: &SynthRequest) -> String {
    let mut digest = Sha256::new();
    for value in [
        &request.text,
        &request.model,
        &request.speed.to_bits().to_string(),
    ] {
        digest.update((value.len() as u64).to_be_bytes());
        digest.update(value.as_bytes());
    }
    format!("{:x}", digest.finalize())
}

/// Piper's `length_scale` runs inversely to the user-facing speed. Clamp avoids a malformed
/// profile making an unusably slow or fast process while the dashboard itself enforces 0.5..=2.
fn speed_to_length_scale(speed: f64) -> f64 {
    1.0 / speed.clamp(0.5, 2.0)
}

#[cfg(test)]
mod tests {
    use std::{
        sync::atomic::{AtomicUsize, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;

    struct FakeRunner {
        calls: AtomicUsize,
        bytes: Vec<u8>,
    }

    #[async_trait]
    impl PiperRunner for FakeRunner {
        async fn run(
            &self,
            _model: &Path,
            output: &Path,
            _text: &str,
            _speed: f64,
        ) -> Result<(), TtsError> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            tokio::fs::write(output, &self.bytes).await?;
            Ok(())
        }
    }

    fn temp_dir(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "vozen-rust-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ))
    }

    fn request() -> SynthRequest {
        SynthRequest {
            text: "hello".into(),
            model: "en_US-amy-medium".into(),
            speed: 1.0,
            segments: None,
            single_voice: None,
            emphasis_source: None,
        }
    }

    #[tokio::test]
    async fn rejects_path_like_model_before_touching_the_runner() {
        let root = temp_dir("unsafe");
        let runner = Arc::new(FakeRunner {
            calls: AtomicUsize::new(0),
            bytes: b"wav".to_vec(),
        });
        let engine = PiperEngine::new(runner.clone(), root.join("models"), root.join("cache"), 1);
        let mut bad = request();
        bad.model = "../outside".into();
        assert!(matches!(
            engine.synth(&bad).await,
            Err(TtsError::InvalidModel)
        ));
        assert_eq!(runner.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn refuses_multi_voice_requests_until_the_wav_compositor_exists() {
        let root = temp_dir("segments");
        let runner = Arc::new(FakeRunner {
            calls: AtomicUsize::new(0),
            bytes: b"wav".to_vec(),
        });
        let engine = PiperEngine::new(runner.clone(), root.join("models"), root.join("cache"), 1);
        let mut segmented = request();
        segmented.segments = Some(vec![vozen_core::SpeechSegment {
            text: "hello".into(),
            model: "en_US-amy-medium".into(),
        }]);
        assert!(matches!(
            engine.synth(&segmented).await,
            Err(TtsError::SegmentedRequestUnsupported)
        ));
        assert_eq!(runner.calls.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn caches_non_empty_wavs_and_rejects_empty_outputs() {
        let root = temp_dir("cache");
        let models = root.join("models");
        tokio::fs::create_dir_all(&models).await.expect("models");
        tokio::fs::write(models.join("en_US-amy-medium.onnx"), b"model")
            .await
            .expect("model");
        let runner = Arc::new(FakeRunner {
            calls: AtomicUsize::new(0),
            bytes: b"wav".to_vec(),
        });
        let engine = PiperEngine::new(runner.clone(), &models, root.join("cache"), 1);
        let first = engine.synth(&request()).await.expect("first");
        let second = engine.synth(&request()).await.expect("cached");
        assert_eq!(first, second);
        assert_eq!(runner.calls.load(Ordering::Relaxed), 1);

        let empty = PiperEngine::new(
            Arc::new(FakeRunner {
                calls: AtomicUsize::new(0),
                bytes: Vec::new(),
            }),
            &models,
            root.join("empty"),
            1,
        );
        assert!(matches!(
            empty.synth(&request()).await,
            Err(TtsError::EmptyOutput)
        ));
        let _ = tokio::fs::remove_dir_all(root).await;
    }

    #[test]
    fn safe_names_and_speed_mapping_are_bounded() {
        assert!(is_safe_model_name("pt_PT-google-medium"));
        assert!(!is_safe_model_name(""));
        assert!(!is_safe_model_name("..\\voice"));
        assert_eq!(speed_to_length_scale(1.0), 1.0);
        assert_eq!(speed_to_length_scale(4.0), 0.5);
    }
}
