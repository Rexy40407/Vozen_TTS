//! Bounded Discord attachment -> ffmpeg -> Whisper adapter for the Rust migration.
//!
//! The adapter is inert until `RUST_TRANSCRIBE_MESSAGE_ENABLED=true`. It keeps the sidecar behind
//! a single mutex, applies timeouts to every external boundary, and removes its temporary files
//! on success and failure.

use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use serde::Deserialize;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::{Mutex, Semaphore},
    time::timeout,
};
use uuid::Uuid;
use vozen_discord::{
    AttachmentAdmission, AttachmentTranscriptionLimits, DiscordAudioAttachment,
    admit_discord_audio_attachment, bound_transcript_text, within_attachment_duration,
};

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(15);
const FFMPEG_TIMEOUT: Duration = Duration::from_secs(20);
const WHISPER_TIMEOUT: Duration = Duration::from_secs(30);
const WHISPER_READY_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_TRANSCRIPT_UTF16: usize = 1_800;

#[derive(Debug, Clone)]
pub struct TranscriptionRuntimeOptions {
    pub python: PathBuf,
    pub script: PathBuf,
    pub model: Option<String>,
    pub ffmpeg: PathBuf,
    pub max_concurrency: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentTranscript {
    pub text: String,
    pub language: String,
    pub duration_ms: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum TranscriptionError {
    #[error("attachment rejected: {0}")]
    Rejected(String),
    #[error("transcription is busy")]
    Busy,
    #[error("attachment processing failed")]
    Processing,
    #[error("whisper sidecar unavailable")]
    Unavailable,
}

struct SidecarState {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

/// A persistent line-oriented Whisper sidecar matching `tools/whisper_sidecar.py`.
pub struct WhisperSidecar {
    options: TranscriptionRuntimeOptions,
    state: Mutex<Option<SidecarState>>,
}

impl WhisperSidecar {
    pub fn new(options: TranscriptionRuntimeOptions) -> Self {
        Self {
            options,
            state: Mutex::new(None),
        }
    }

    async fn spawn_locked(&self) -> Result<SidecarState, TranscriptionError> {
        let mut command = Command::new(&self.options.python);
        command.arg(&self.options.script);
        if let Some(model) = &self.options.model {
            command.env("WHISPER_MODEL", model);
        }
        let mut child = command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|_| TranscriptionError::Unavailable)?;
        let stdin = child.stdin.take().ok_or(TranscriptionError::Unavailable)?;
        let stdout = child.stdout.take().ok_or(TranscriptionError::Unavailable)?;
        let mut state = SidecarState {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        };
        let ready = timeout(
            WHISPER_READY_TIMEOUT,
            state.stdout.read_line(&mut String::new()),
        )
        .await
        .map_err(|_| TranscriptionError::Unavailable)?
        .map_err(|_| TranscriptionError::Unavailable)?;
        if ready == 0 {
            return Err(TranscriptionError::Unavailable);
        }
        Ok(state)
    }

    pub async fn transcribe(
        &self,
        wav_path: &Path,
    ) -> Result<AttachmentTranscript, TranscriptionError> {
        let mut guard = self.state.lock().await;
        if guard.is_none() {
            *guard = Some(self.spawn_locked().await?);
        }
        let state = guard.as_mut().ok_or(TranscriptionError::Unavailable)?;
        let request = format!("{}\n", wav_path.display());
        if state.stdin.write_all(request.as_bytes()).await.is_err() {
            *guard = None;
            return Err(TranscriptionError::Unavailable);
        }
        if state.stdin.flush().await.is_err() {
            *guard = None;
            return Err(TranscriptionError::Unavailable);
        }
        let mut line = String::new();
        let read = timeout(WHISPER_TIMEOUT, state.stdout.read_line(&mut line)).await;
        let count = match read {
            Ok(Ok(count)) if count > 0 => count,
            _ => {
                if let Some(mut stale) = guard.take() {
                    let _ = stale.child.kill().await;
                }
                return Err(TranscriptionError::Unavailable);
            }
        };
        let _ = count;
        let response: SidecarResponse =
            serde_json::from_str(line.trim()).map_err(|_| TranscriptionError::Processing)?;
        if let Some(error) = response.error {
            let _ = error;
            return Err(TranscriptionError::Processing);
        }
        Ok(AttachmentTranscript {
            text: bound_transcript_text(
                response.text.as_deref().unwrap_or_default(),
                MAX_TRANSCRIPT_UTF16,
            ),
            language: response.lang.unwrap_or_default(),
            duration_ms: 0,
        })
    }
}

#[derive(Debug, Deserialize)]
struct SidecarResponse {
    text: Option<String>,
    lang: Option<String>,
    error: Option<String>,
}

pub struct AttachmentTranscriber {
    client: reqwest::Client,
    ffmpeg: PathBuf,
    sidecar: Arc<WhisperSidecar>,
    semaphore: Arc<Semaphore>,
}

impl AttachmentTranscriber {
    pub fn new(options: TranscriptionRuntimeOptions) -> Result<Self, TranscriptionError> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(DOWNLOAD_TIMEOUT)
            .build()
            .map_err(|_| TranscriptionError::Unavailable)?;
        Ok(Self {
            client,
            ffmpeg: options.ffmpeg.clone(),
            sidecar: Arc::new(WhisperSidecar::new(options.clone())),
            semaphore: Arc::new(Semaphore::new(options.max_concurrency.max(1))),
        })
    }

    pub async fn transcribe(
        &self,
        attachment: DiscordAudioAttachment<'_>,
        limits: AttachmentTranscriptionLimits,
    ) -> Result<AttachmentTranscript, TranscriptionError> {
        let admission = admit_discord_audio_attachment(attachment, limits.max_bytes);
        let url = match admission {
            AttachmentAdmission::Accepted(url) => url,
            AttachmentAdmission::Rejected(reason) => {
                return Err(TranscriptionError::Rejected(reason.to_string()));
            }
        };
        let permit = self
            .semaphore
            .clone()
            .try_acquire_owned()
            .map_err(|_| TranscriptionError::Busy)?;
        let workspace = std::env::temp_dir().join(format!("vozen-stt-{}", Uuid::new_v4()));
        tokio::fs::create_dir(&workspace)
            .await
            .map_err(|_| TranscriptionError::Processing)?;
        let input = workspace.join("input.audio");
        let wav = workspace.join("output.wav");
        let result = self.run_pipeline(&url, &input, &wav, limits).await;
        let _ = tokio::fs::remove_dir_all(&workspace).await;
        drop(permit);
        result
    }

    async fn run_pipeline(
        &self,
        url: &reqwest::Url,
        input: &Path,
        wav: &Path,
        limits: AttachmentTranscriptionLimits,
    ) -> Result<AttachmentTranscript, TranscriptionError> {
        let response = self
            .client
            .get(url.clone())
            .send()
            .await
            .map_err(|_| TranscriptionError::Processing)?;
        if !response.status().is_success() {
            return Err(TranscriptionError::Processing);
        }
        if response
            .content_length()
            .is_some_and(|size| size > limits.max_bytes)
        {
            return Err(TranscriptionError::Rejected("size".into()));
        }
        let mut file = tokio::fs::File::create(input)
            .await
            .map_err(|_| TranscriptionError::Processing)?;
        let mut received = 0u64;
        let mut response = response;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| TranscriptionError::Processing)?
        {
            received = received.saturating_add(chunk.len() as u64);
            if received > limits.max_bytes {
                return Err(TranscriptionError::Rejected("size".into()));
            }
            file.write_all(&chunk)
                .await
                .map_err(|_| TranscriptionError::Processing)?;
        }
        if received == 0 {
            return Err(TranscriptionError::Rejected("size".into()));
        }
        file.flush()
            .await
            .map_err(|_| TranscriptionError::Processing)?;
        let status = timeout(
            FFMPEG_TIMEOUT,
            Command::new(&self.ffmpeg)
                .args(["-hide_banner", "-loglevel", "error", "-i"])
                .arg(input)
                .args([
                    "-t",
                    &(limits.max_seconds + 1).to_string(),
                    "-ar",
                    "24000",
                    "-ac",
                    "1",
                    "-c:a",
                    "pcm_s16le",
                    "-f",
                    "wav",
                ])
                .arg(wav)
                .arg("-y")
                .output(),
        )
        .await
        .map_err(|_| TranscriptionError::Processing)?
        .map_err(|_| TranscriptionError::Processing)?;
        if !status.status.success() {
            return Err(TranscriptionError::Processing);
        }
        let size = tokio::fs::metadata(wav)
            .await
            .map_err(|_| TranscriptionError::Processing)?
            .len();
        let duration = size.saturating_sub(44) as f64 / 48_000.0;
        if !within_attachment_duration(duration, limits.max_seconds) {
            return Err(TranscriptionError::Rejected("duration".into()));
        }
        let mut transcript = self.sidecar.transcribe(wav).await?;
        transcript.duration_ms = (duration * 1_000.0).round() as u64;
        Ok(transcript)
    }
}
