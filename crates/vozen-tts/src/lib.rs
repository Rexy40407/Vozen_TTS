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
use vozen_core::{RuntimeMetrics, SynthRequest};

mod wav_concat;

pub use wav_concat::{WavError, WavFormat, concat_wavs, parse_wav, silence_wav};

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
    #[error("Piper WAV composition failed: {0}")]
    Wav(#[from] WavError),
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
    metrics: Arc<RuntimeMetrics>,
}

impl PiperEngine<CommandPiperRunner> {
    pub fn production(
        executable: impl Into<PathBuf>,
        models_dir: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        concurrency: usize,
    ) -> Self {
        Self::new_with_metrics(
            Arc::new(CommandPiperRunner::new(executable)),
            models_dir,
            cache_dir,
            concurrency,
            Arc::new(RuntimeMetrics::default()),
        )
    }

    pub fn production_with_metrics(
        executable: impl Into<PathBuf>,
        models_dir: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        concurrency: usize,
        metrics: Arc<RuntimeMetrics>,
    ) -> Self {
        Self::new_with_metrics(
            Arc::new(CommandPiperRunner::new(executable)),
            models_dir,
            cache_dir,
            concurrency,
            metrics,
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
        Self::new_with_metrics(
            runner,
            models_dir,
            cache_dir,
            concurrency,
            Arc::new(RuntimeMetrics::default()),
        )
    }

    pub fn new_with_metrics(
        runner: Arc<R>,
        models_dir: impl Into<PathBuf>,
        cache_dir: impl Into<PathBuf>,
        concurrency: usize,
        metrics: Arc<RuntimeMetrics>,
    ) -> Self {
        Self {
            runner,
            models_dir: models_dir.into(),
            cache_dir: cache_dir.into(),
            permits: Arc::new(Semaphore::new(concurrency.max(1))),
            metrics,
        }
    }

    /// Returns the cached immutable WAV path, synthesising at most `concurrency` misses.
    pub async fn synth(&self, request: &SynthRequest) -> Result<PathBuf, TtsError> {
        let Some(segments) = request
            .segments
            .as_deref()
            .filter(|segments| !segments.is_empty())
        else {
            return self.synth_single(request).await;
        };
        if segments.len() == 1 {
            return self
                .synth_single(&single_segment_request(request, &segments[0]))
                .await;
        }

        // Explicit segments arrive from the policy layer with their own voice selections. Each
        // part is independently cached, then the canonical PCM WAVs are composed with a small
        // anti-click gap. A bad/missing segment falls back to the request's resolved base voice,
        // matching the legacy MultiSegmentEngine's never-drop-content rule.
        match self.synth_segments(request, segments).await {
            Ok(path) => Ok(path),
            Err(_) => self.synth_single(request).await,
        }
    }

    async fn synth_segments(
        &self,
        request: &SynthRequest,
        segments: &[vozen_core::SpeechSegment],
    ) -> Result<PathBuf, TtsError> {
        let destination = self.cache_dir.join(format!("{}.wav", cache_key(request)));
        if non_empty_file(&destination).await? {
            self.metrics.record_cache_hit();
            return Ok(destination);
        }
        let mut wavs = Vec::with_capacity(segments.len());
        for segment in segments {
            let path = self
                .synth_single(&single_segment_request(request, segment))
                .await?;
            wavs.push(tokio::fs::read(path).await?);
        }
        let combined =
            concat_wavs(&wavs, wav_concat::DEFAULT_SEGMENT_SILENCE_MS).map_err(TtsError::Wav)?;
        self.write_cached_wav(destination, combined).await
    }

    async fn synth_single(&self, request: &SynthRequest) -> Result<PathBuf, TtsError> {
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
            self.metrics.record_cache_hit();
            return Ok(destination);
        }

        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| TtsError::ProcessFailed)?;
        // Check again after waiting: another request may have completed this exact cache key.
        if non_empty_file(&destination).await? {
            self.metrics.record_cache_hit();
            return Ok(destination);
        }
        self.metrics.record_cache_miss();
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

    async fn write_cached_wav(
        &self,
        destination: PathBuf,
        wav: Vec<u8>,
    ) -> Result<PathBuf, TtsError> {
        tokio::fs::create_dir_all(&self.cache_dir).await?;
        if non_empty_file(&destination).await? {
            self.metrics.record_cache_hit();
            return Ok(destination);
        }
        let temporary = self.cache_dir.join(format!(".{}.wav", Uuid::new_v4()));
        tokio::fs::write(&temporary, wav).await?;
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

fn single_segment_request(
    request: &SynthRequest,
    segment: &vozen_core::SpeechSegment,
) -> SynthRequest {
    SynthRequest {
        text: segment.text.clone(),
        model: segment.model.clone(),
        speed: request.speed,
        engine: request.engine,
        segments: None,
        single_voice: Some(true),
        emphasis_source: None,
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
    let speed = request.speed.to_bits().to_string();
    for value in [&request.text, &request.model, &speed] {
        digest.update((value.len() as u64).to_be_bytes());
        digest.update(value.as_bytes());
    }
    match &request.segments {
        Some(segments) => {
            digest.update([1]);
            digest.update((segments.len() as u64).to_be_bytes());
            for segment in segments {
                for value in [&segment.text, &segment.model] {
                    digest.update((value.len() as u64).to_be_bytes());
                    digest.update(value.as_bytes());
                }
            }
        }
        None => digest.update([0]),
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
            engine: vozen_core::SynthesisEngine::Default,
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
    async fn composes_each_explicit_voice_segment_and_caches_the_result() {
        let root = temp_dir("segments");
        let models = root.join("models");
        tokio::fs::create_dir_all(&models).await.expect("models");
        for model in ["en_US-amy-medium", "pt_PT-tugao-medium"] {
            tokio::fs::write(models.join(format!("{model}.onnx")), b"model")
                .await
                .expect("model");
        }
        let runner = Arc::new(FakeRunner {
            calls: AtomicUsize::new(0),
            bytes: wav_concat::silence_wav(1),
        });
        let engine = PiperEngine::new(runner.clone(), models, root.join("cache"), 1);
        let mut segmented = request();
        segmented.segments = Some(vec![
            vozen_core::SpeechSegment {
                text: "hello".into(),
                model: "en_US-amy-medium".into(),
            },
            vozen_core::SpeechSegment {
                text: "olá".into(),
                model: "pt_PT-tugao-medium".into(),
            },
        ]);
        let first = engine.synth(&segmented).await.expect("combined WAV");
        let second = engine.synth(&segmented).await.expect("cached WAV");
        assert_eq!(first, second);
        assert_eq!(runner.calls.load(Ordering::Relaxed), 2);
        let wav = tokio::fs::read(first).await.expect("WAV");
        assert!(parse_wav(&wav).is_ok());
    }

    #[tokio::test]
    async fn failed_segment_falls_back_to_the_resolved_base_voice_without_dropping_text() {
        let root = temp_dir("segment-fallback");
        let models = root.join("models");
        tokio::fs::create_dir_all(&models).await.expect("models");
        tokio::fs::write(models.join("en_US-amy-medium.onnx"), b"model")
            .await
            .expect("base model");
        let runner = Arc::new(FakeRunner {
            calls: AtomicUsize::new(0),
            bytes: wav_concat::silence_wav(1),
        });
        let engine = PiperEngine::new(runner.clone(), models, root.join("cache"), 1);
        let mut segmented = request();
        segmented.text = "full original message".into();
        segmented.segments = Some(vec![
            vozen_core::SpeechSegment {
                text: "missing".into(),
                model: "pt_PT-missing-medium".into(),
            },
            vozen_core::SpeechSegment {
                text: "part".into(),
                model: "en_US-amy-medium".into(),
            },
        ]);
        let fallback = engine.synth(&segmented).await.expect("base fallback");
        assert!(parse_wav(&tokio::fs::read(fallback).await.expect("WAV")).is_ok());
        assert_eq!(runner.calls.load(Ordering::Relaxed), 1);
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
