//! Bounded, network-free admission policy for Discord attachment transcription.
//!
//! The eventual runtime adapter must call this gate before downloading anything. Keeping the
//! policy in the Discord crate gives Node and Rust one auditable contract and makes forged URLs,
//! non-audio uploads, and oversized objects impossible to reach ffmpeg/Whisper.

use std::fmt;

use reqwest::Url;

const DISCORD_CDN_HOSTS: [&str; 2] = ["cdn.discordapp.com", "media.discordapp.net"];
const AUDIO_TYPES: [&str; 6] = [
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/webm",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachmentRejectReason {
    Host,
    Type,
    Size,
    Url,
}

impl fmt::Display for AttachmentRejectReason {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Host => "host",
            Self::Type => "type",
            Self::Size => "size",
            Self::Url => "url",
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttachmentAdmission {
    Accepted(Url),
    Rejected(AttachmentRejectReason),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiscordAudioAttachment<'a> {
    pub url: &'a str,
    pub content_type: Option<&'a str>,
    pub size: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AttachmentTranscriptionLimits {
    pub max_bytes: u64,
    pub max_seconds: u64,
}

/// Pure admission gate. It performs no DNS, HTTP, redirect, or filesystem operation.
pub fn admit_discord_audio_attachment(
    attachment: DiscordAudioAttachment<'_>,
    max_bytes: u64,
) -> AttachmentAdmission {
    let Ok(url) = Url::parse(attachment.url) else {
        return AttachmentAdmission::Rejected(AttachmentRejectReason::Url);
    };
    if url.scheme() != "https"
        || !url.host_str().is_some_and(|host| {
            DISCORD_CDN_HOSTS
                .iter()
                .any(|allowed| host.eq_ignore_ascii_case(allowed))
        })
    {
        return AttachmentAdmission::Rejected(AttachmentRejectReason::Host);
    }
    let content_type = attachment
        .content_type
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        .map(str::to_ascii_lowercase);
    if !content_type
        .as_deref()
        .is_some_and(|value| AUDIO_TYPES.contains(&value))
    {
        return AttachmentAdmission::Rejected(AttachmentRejectReason::Type);
    }
    if attachment.size == 0 || attachment.size > max_bytes {
        return AttachmentAdmission::Rejected(AttachmentRejectReason::Size);
    }
    AttachmentAdmission::Accepted(url)
}

/// Duration is checked after fixed-format ffmpeg conversion; Discord metadata is not trusted.
pub fn within_attachment_duration(duration_seconds: f64, max_seconds: u64) -> bool {
    duration_seconds.is_finite() && duration_seconds > 0.0 && duration_seconds <= max_seconds as f64
}

/// Bounds transcript text like the Node handler before putting it into a Discord response.
pub fn bound_transcript_text(text: &str, max_utf16_units: usize) -> String {
    let normalised = text.trim().replace("```", "'''");
    let mut output = String::new();
    let mut units = 0usize;
    for character in normalised.chars() {
        let character_units = character.len_utf16();
        if units + character_units > max_utf16_units {
            break;
        }
        output.push(character);
        units += character_units;
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "https://cdn.discordapp.com/attachments/1/2/audio.ogg";

    #[test]
    fn admits_only_https_discord_audio_within_the_declared_cap() {
        assert!(matches!(
            admit_discord_audio_attachment(
                DiscordAudioAttachment {
                    url: URL,
                    content_type: Some("audio/ogg; codecs=opus"),
                    size: 128,
                },
                512,
            ),
            AttachmentAdmission::Accepted(_)
        ));
        assert_eq!(
            admit_discord_audio_attachment(
                DiscordAudioAttachment {
                    url: "https://example.com/audio.ogg",
                    content_type: Some("audio/ogg"),
                    size: 128,
                },
                512,
            ),
            AttachmentAdmission::Rejected(AttachmentRejectReason::Host)
        );
        assert_eq!(
            admit_discord_audio_attachment(
                DiscordAudioAttachment {
                    url: URL,
                    content_type: Some("text/plain"),
                    size: 128,
                },
                512,
            ),
            AttachmentAdmission::Rejected(AttachmentRejectReason::Type)
        );
        assert_eq!(
            admit_discord_audio_attachment(
                DiscordAudioAttachment {
                    url: URL,
                    content_type: Some("audio/ogg"),
                    size: 513,
                },
                512,
            ),
            AttachmentAdmission::Rejected(AttachmentRejectReason::Size)
        );
    }

    #[test]
    fn duration_requires_a_finite_positive_value_within_the_limit() {
        assert!(within_attachment_duration(60.0, 60));
        assert!(!within_attachment_duration(0.0, 60));
        assert!(!within_attachment_duration(f64::NAN, 60));
        assert!(!within_attachment_duration(60.1, 60));
    }

    #[test]
    fn transcript_bounds_discord_formatting_and_utf16_length() {
        assert_eq!(
            bound_transcript_text("  hello ``` world  ", 20),
            "hello ''' world"
        );
        assert_eq!(bound_transcript_text("😀😀😀", 4), "😀😀");
    }
}
