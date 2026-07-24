//! Google Translate TTS adapter used by the Rust migration.
//!
//! This is intentionally opt-in. The endpoint is unofficial and can rate-limit by IP, so
//! Piper remains the normal local default and the command adapter falls back to it on failure.
//! The implementation keeps the Node contract: chunks are at most 200 characters, transient
//! 429/5xx responses are retried, and the returned MP3 stream is converted to Piper-compatible
//! 22050 Hz mono PCM WAV through the configured ffmpeg executable.

use std::{path::PathBuf, sync::Arc, time::Duration};

use futures::{StreamExt, stream};
use reqwest::Client;
use tokio::{process::Command, sync::Semaphore, time::timeout};
use uuid::Uuid;
use vozen_core::SynthRequest;

use super::{
    DEFAULT_MAX_CACHE_FILES, TtsError, cache_key, concat_wavs, evict_cache_files, non_empty_file,
    prepend_silence_wav, validate_asset_wav,
};

pub const GTTS_MAX_CHARS: usize = 200;
pub const GTTS_TIMEOUT: Duration = Duration::from_secs(15);
pub const GTTS_CONVERSION_TIMEOUT: Duration = Duration::from_secs(15);
pub const GTTS_RETRY_BASE: Duration = Duration::from_millis(300);

#[derive(Clone)]
pub struct GttsOptions {
    pub ffmpeg: PathBuf,
    pub cache_dir: PathBuf,
    pub concurrency: usize,
    pub retries: usize,
    pub request_timeout: Duration,
    pub conversion_timeout: Duration,
}

impl GttsOptions {
    #[must_use]
    pub fn production(ffmpeg: impl Into<PathBuf>, cache_dir: impl Into<PathBuf>) -> Self {
        Self {
            ffmpeg: ffmpeg.into(),
            cache_dir: cache_dir.into(),
            concurrency: 3,
            retries: 2,
            request_timeout: GTTS_TIMEOUT,
            conversion_timeout: GTTS_CONVERSION_TIMEOUT,
        }
    }
}

pub struct GttsEngine {
    client: Client,
    options: GttsOptions,
    permits: Arc<Semaphore>,
}

impl GttsEngine {
    pub fn new(options: GttsOptions) -> Result<Self, TtsError> {
        let client = Client::builder()
            .user_agent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            )
            .build()
            .map_err(|_| TtsError::GttsRequest)?;
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
        let combined = concat_wavs(&wavs, 30).map_err(TtsError::Wav)?;
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
        let chunks = chunk_text(&lower_all_caps_runs(&request.text), GTTS_MAX_CHARS);
        if chunks.is_empty() {
            return Err(TtsError::GttsResponse);
        }
        tokio::fs::create_dir_all(&self.options.cache_dir).await?;
        let destination = self
            .options
            .cache_dir
            .join(format!("{}.wav", cache_key(request)));
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }
        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| TtsError::GttsRequest)?;
        if non_empty_file(&destination).await? {
            return Ok(destination);
        }

        let language = gtts_lang_of_model(&request.model);
        let jobs = chunks.into_iter().enumerate().map(|(index, chunk)| {
            let language = language.clone();
            async move {
                let result = self.fetch_chunk_with_retry(&chunk, &language).await;
                (index, result)
            }
        });
        let mut results = stream::iter(jobs)
            .buffer_unordered(self.options.concurrency.max(1))
            .collect::<Vec<_>>()
            .await;
        results.sort_by_key(|(index, _)| *index);
        let mut mp3 = Vec::new();
        for (_, result) in results {
            mp3.extend(result?);
        }
        let wav = self.convert_mp3(&mp3, request.speed).await?;
        let wav = if lead_silence_ms > 0 {
            prepend_silence_wav(&wav, lead_silence_ms)?
        } else {
            wav
        };
        self.write_cached_wav(destination, wav).await
    }

    async fn fetch_chunk_with_retry(
        &self,
        text: &str,
        language: &str,
    ) -> Result<Vec<u8>, TtsError> {
        let mut last = TtsError::GttsRequest;
        for attempt in 0..=self.options.retries {
            match self.fetch_chunk(text, language).await {
                Ok(bytes) => return Ok(bytes),
                Err(error @ TtsError::GttsTimeout) => return Err(error),
                Err(error @ TtsError::GttsResponse) => return Err(error),
                Err(error) => {
                    last = error;
                    if attempt == self.options.retries {
                        break;
                    }
                    tokio::time::sleep(GTTS_RETRY_BASE * (attempt as u32 + 1)).await;
                }
            }
        }
        Err(last)
    }

    async fn fetch_chunk(&self, text: &str, language: &str) -> Result<Vec<u8>, TtsError> {
        let response = self
            .client
            .get("https://translate.google.com/translate_tts")
            .query(&[
                ("ie", "UTF-8"),
                ("client", "tw-ob"),
                ("tl", language),
                ("q", text),
            ])
            .timeout(self.options.request_timeout)
            .send()
            .await
            .map_err(|error| {
                if error.is_timeout() {
                    TtsError::GttsTimeout
                } else {
                    TtsError::GttsRequest
                }
            })?;
        let status = response.status();
        if !status.is_success() {
            return Err(
                if status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
                    TtsError::GttsRequest
                } else {
                    TtsError::GttsResponse
                },
            );
        }
        let bytes = response.bytes().await.map_err(|_| TtsError::GttsRequest)?;
        if bytes.is_empty() {
            return Err(TtsError::GttsResponse);
        }
        Ok(bytes.to_vec())
    }

    async fn convert_mp3(&self, mp3: &[u8], speed: f64) -> Result<Vec<u8>, TtsError> {
        let work_dir = self
            .options
            .cache_dir
            .join(format!(".gtts-{}", Uuid::new_v4()));
        tokio::fs::create_dir_all(&work_dir).await?;
        let input = work_dir.join("input.mp3");
        let output = work_dir.join("output.wav");
        let result = async {
            tokio::fs::write(&input, mp3).await?;
            let mut command = Command::new(&self.options.ffmpeg);
            command
                .args(["-hide_banner", "-loglevel", "error", "-i"])
                .arg(&input);
            if (speed - 1.0).abs() > f64::EPSILON {
                command.args(["-filter:a", &format!("atempo={}", speed.clamp(0.5, 2.0))]);
            }
            command
                .args(["-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav"])
                .arg(&output)
                .arg("-y")
                .kill_on_drop(true);
            let status = timeout(self.options.conversion_timeout, command.status())
                .await
                .map_err(|_| TtsError::GttsTimeout)?
                .map_err(|_| TtsError::GttsConversion)?;
            if !status.success() {
                return Err(TtsError::GttsConversion);
            }
            let wav = tokio::fs::read(&output).await?;
            if wav.is_empty() {
                return Err(TtsError::GttsResponse);
            }
            Ok(wav)
        }
        .await;
        let _ = tokio::fs::remove_dir_all(&work_dir).await;
        result
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
            .join(format!(".{}.wav", Uuid::new_v4()));
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

pub fn gtts_lang_of_model(model: &str) -> String {
    let Some((prefix, _)) = model.split_once('_') else {
        return "en".to_owned();
    };
    let prefix = prefix.to_ascii_lowercase();
    if prefix.is_empty() {
        "en".to_owned()
    } else if prefix == "zh" {
        "zh-CN".to_owned()
    } else {
        prefix
    }
}

pub fn chunk_text(text: &str, max: usize) -> Vec<String> {
    if max == 0 {
        return Vec::new();
    }
    let mut chunks = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        let length = word.chars().count();
        if length > max {
            if !current.is_empty() {
                chunks.push(std::mem::take(&mut current));
            }
            let chars = word.chars().collect::<Vec<_>>();
            for piece in chars.chunks(max) {
                chunks.push(piece.iter().collect());
            }
        } else if current.is_empty() {
            current.push_str(word);
        } else if current.chars().count() + 1 + length <= max {
            current.push(' ');
            current.push_str(word);
        } else {
            chunks.push(std::mem::take(&mut current));
            current.push_str(word);
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

pub fn lower_all_caps_runs(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut run = String::new();
    let flush = |run: &mut String, output: &mut String| {
        if run.chars().count() >= 2 && run.chars().all(|character| character.is_uppercase()) {
            output.extend(run.chars().flat_map(char::to_lowercase));
        } else {
            output.push_str(run);
        }
        run.clear();
    };
    for character in text.chars() {
        if character.is_alphabetic() {
            run.push(character);
        } else {
            flush(&mut run, &mut output);
            output.push(character);
        }
    }
    flush(&mut run, &mut output);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_model_locales_like_node_gtts() {
        assert_eq!(gtts_lang_of_model("pt_PT-tugao-medium"), "pt");
        assert_eq!(gtts_lang_of_model("zh_CN-huayan-medium"), "zh-CN");
        assert_eq!(gtts_lang_of_model("unknown"), "en");
    }

    #[test]
    fn chunks_on_words_and_never_splits_unicode_scalars() {
        assert_eq!(
            chunk_text("um dois três quatro", 8),
            ["um dois", "três", "quatro"]
        );
        assert_eq!(chunk_text("abcdefghij", 3), ["abc", "def", "ghi", "j"]);
        assert!(
            chunk_text("😀😀😀", 2)
                .iter()
                .all(|chunk| chunk.chars().count() <= 2)
        );
    }

    #[test]
    fn lowercases_only_all_caps_runs() {
        assert_eq!(lower_all_caps_runs("NASA Voltei OK!"), "nasa Voltei ok!");
        assert_eq!(lower_all_caps_runs("ÁRVORE"), "árvore");
        assert_eq!(lower_all_caps_runs("I A"), "I A");
    }
}
