//! Canonical PCM WAV parsing and concatenation for multi-voice Piper requests.
//!
//! Piper's supported Vozen models emit 22_050 Hz mono 16-bit PCM. Keeping this strict mirrors
//! the Node runtime and prevents a malformed provider response from becoming a corrupted Discord
//! audio stream. Chunks are walked by ID rather than assuming a fixed 44-byte header.

use thiserror::Error;

pub const PIPER_SAMPLE_RATE: u32 = 22_050;
pub const PIPER_CHANNELS: u16 = 1;
pub const PIPER_BITS_PER_SAMPLE: u16 = 16;
pub const DEFAULT_SEGMENT_SILENCE_MS: u32 = 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WavFormat {
    pub audio_format: u16,
    pub channels: u16,
    pub sample_rate: u32,
    pub bits_per_sample: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedWav<'a> {
    pub format: WavFormat,
    pub data: &'a [u8],
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum WavError {
    #[error("WAV is too small")]
    TooSmall,
    #[error("WAV is not RIFF/WAVE")]
    InvalidContainer,
    #[error("WAV chunk exceeds the buffer")]
    TruncatedChunk,
    #[error("WAV is missing its fmt chunk")]
    MissingFormat,
    #[error("WAV is missing its data chunk")]
    MissingData,
    #[error("WAV fmt chunk is too small")]
    ShortFormat,
    #[error("WAV has unsupported PCM format")]
    UnsupportedFormat,
    #[error("combined WAV exceeds RIFF's 4 GiB limit")]
    TooLarge,
}

pub fn parse_wav(wav: &[u8]) -> Result<ParsedWav<'_>, WavError> {
    if wav.len() < 12 {
        return Err(WavError::TooSmall);
    }
    if &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
        return Err(WavError::InvalidContainer);
    }
    let mut format = None;
    let mut data = None;
    let mut offset = 12usize;
    while offset.saturating_add(8) <= wav.len() {
        let chunk_id = &wav[offset..offset + 4];
        let size =
            u32::from_le_bytes(wav[offset + 4..offset + 8].try_into().expect("size")) as usize;
        let body = offset + 8;
        let end = body.checked_add(size).ok_or(WavError::TruncatedChunk)?;
        if end > wav.len() {
            return Err(WavError::TruncatedChunk);
        }
        if chunk_id == b"fmt " {
            if size < 16 {
                return Err(WavError::ShortFormat);
            }
            format = Some(WavFormat {
                audio_format: u16::from_le_bytes(wav[body..body + 2].try_into().expect("format")),
                channels: u16::from_le_bytes(wav[body + 2..body + 4].try_into().expect("channels")),
                sample_rate: u32::from_le_bytes(
                    wav[body + 4..body + 8].try_into().expect("sample rate"),
                ),
                bits_per_sample: u16::from_le_bytes(
                    wav[body + 14..body + 16].try_into().expect("bits"),
                ),
            });
        } else if chunk_id == b"data" {
            data = Some(&wav[body..end]);
        }
        offset = end + (size & 1);
        if offset > wav.len() {
            return Err(WavError::TruncatedChunk);
        }
    }
    Ok(ParsedWav {
        format: format.ok_or(WavError::MissingFormat)?,
        data: data.ok_or(WavError::MissingData)?,
    })
}

pub fn concat_wavs(wavs: &[Vec<u8>], silence_ms: u32) -> Result<Vec<u8>, WavError> {
    if wavs.is_empty() {
        return Err(WavError::MissingData);
    }
    let parsed = wavs
        .iter()
        .map(|wav| parse_wav(wav))
        .collect::<Result<Vec<_>, _>>()?;
    if parsed.iter().any(|wav| !is_piper_format(wav.format)) {
        return Err(WavError::UnsupportedFormat);
    }
    let silence_bytes = (u64::from(silence_ms) * u64::from(PIPER_SAMPLE_RATE) / 1_000)
        .checked_mul(u64::from(block_align()))
        .ok_or(WavError::TooLarge)?;
    let audio_bytes = parsed.iter().try_fold(0u64, |total, wav| {
        total
            .checked_add(wav.data.len() as u64)
            .ok_or(WavError::TooLarge)
    })?;
    let gaps = (parsed.len() - 1) as u64;
    let data_len = audio_bytes
        .checked_add(silence_bytes.checked_mul(gaps).ok_or(WavError::TooLarge)?)
        .ok_or(WavError::TooLarge)?;
    if data_len > u64::from(u32::MAX - 36) {
        return Err(WavError::TooLarge);
    }
    let mut data = Vec::with_capacity(data_len as usize);
    for (index, wav) in parsed.iter().enumerate() {
        if index > 0 {
            data.resize(data.len() + silence_bytes as usize, 0);
        }
        data.extend_from_slice(wav.data);
    }
    Ok(build_wav(&data))
}

pub fn silence_wav(milliseconds: u32) -> Vec<u8> {
    let samples = u64::from(milliseconds) * u64::from(PIPER_SAMPLE_RATE) / 1_000;
    let bytes = samples
        .saturating_mul(u64::from(block_align()))
        .min(u64::from(u32::MAX - 36));
    build_wav(&vec![0; bytes as usize])
}

fn is_piper_format(format: WavFormat) -> bool {
    format.audio_format == 1
        && format.sample_rate == PIPER_SAMPLE_RATE
        && format.channels == PIPER_CHANNELS
        && format.bits_per_sample == PIPER_BITS_PER_SAMPLE
}

fn block_align() -> u16 {
    PIPER_CHANNELS * (PIPER_BITS_PER_SAMPLE / 8)
}

fn build_wav(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(44 + data.len());
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&PIPER_CHANNELS.to_le_bytes());
    out.extend_from_slice(&PIPER_SAMPLE_RATE.to_le_bytes());
    out.extend_from_slice(&(PIPER_SAMPLE_RATE * u32::from(block_align())).to_le_bytes());
    out.extend_from_slice(&block_align().to_le_bytes());
    out.extend_from_slice(&PIPER_BITS_PER_SAMPLE.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concatenates_canonical_wavs_with_the_expected_silence() {
        let first = build_wav(&[1, 2, 3, 4]);
        let second = build_wav(&[5, 6]);
        let combined = concat_wavs(&[first, second], 1).expect("combined");
        let parsed = parse_wav(&combined).expect("parsed");
        assert_eq!(parsed.format.sample_rate, PIPER_SAMPLE_RATE);
        assert_eq!(parsed.data.len(), 4 + 44 + 2);
        assert_eq!(&parsed.data[..4], [1, 2, 3, 4]);
        assert_eq!(&parsed.data[48..], [5, 6]);
    }

    #[test]
    fn walks_extra_chunks_and_rejects_non_piper_audio() {
        let mut wav = build_wav(&[1, 2]);
        wav.splice(36..36, b"LIST\x01\x00\x00\x00x\x00".iter().copied());
        assert_eq!(parse_wav(&wav).expect("extra chunk").data, &[1, 2]);
        let mut stereo = build_wav(&[1, 2]);
        stereo[22..24].copy_from_slice(&2u16.to_le_bytes());
        assert_eq!(concat_wavs(&[stereo], 0), Err(WavError::UnsupportedFormat));
    }
}
