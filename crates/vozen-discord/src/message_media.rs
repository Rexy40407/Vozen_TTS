//! Discord message media projection for the auto-read parity path.
//!
//! The Node handler announces URLs, protected markdown, attachments and sticker names in this
//! exact order. This adapter never downloads an attachment or stores message content; it only
//! converts the one gateway event into the semantic media announcements consumed by `vozen-core`.

use serenity::model::channel::Message;
use vozen_core::{
    MediaAnnouncement, MediaAnnouncementKind, MediaKind, collect_markdown_media, collect_url_media,
};

const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "rar", "7z", "tar", "gz", "bz2", "xz"];

/// Produces Node-compatible speech announcements in the order URL -> markdown -> attachments ->
/// stickers. An attachment batch is intentionally compacted to one `Multiple` announcement.
#[must_use]
pub fn collect_message_media(message: &Message) -> Vec<MediaAnnouncement> {
    collect_media(
        &message.content,
        message
            .attachments
            .iter()
            .map(|attachment| AttachmentFacts {
                content_type: attachment.content_type.as_deref(),
                filename: Some(&attachment.filename),
            }),
        message.sticker_items.iter().map(|sticker| StickerFacts {
            name: Some(&sticker.name),
        }),
    )
}

#[derive(Clone, Copy)]
struct AttachmentFacts<'a> {
    content_type: Option<&'a str>,
    filename: Option<&'a str>,
}

#[derive(Clone, Copy)]
struct StickerFacts<'a> {
    name: Option<&'a str>,
}

fn collect_media<'a>(
    raw: &str,
    attachments: impl IntoIterator<Item = AttachmentFacts<'a>>,
    stickers: impl IntoIterator<Item = StickerFacts<'a>>,
) -> Vec<MediaAnnouncement> {
    let mut media = collect_url_media(raw)
        .into_iter()
        .chain(collect_markdown_media(raw))
        .map(media_from_text_kind)
        .collect::<Vec<_>>();

    let attachments = attachments.into_iter().collect::<Vec<_>>();
    match attachments.as_slice() {
        [] => {}
        [attachment] => media.push(MediaAnnouncement {
            kind: classify_attachment(*attachment),
            text: None,
        }),
        _ => media.push(MediaAnnouncement {
            kind: MediaAnnouncementKind::Multiple,
            text: None,
        }),
    }

    media.extend(stickers.into_iter().map(|sticker| {
        MediaAnnouncement {
            kind: MediaAnnouncementKind::Sticker,
            text: sticker
                .name
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .map(ToOwned::to_owned),
        }
    }));
    media
}

fn media_from_text_kind(kind: MediaKind) -> MediaAnnouncement {
    let kind = match kind {
        MediaKind::Link => MediaAnnouncementKind::Link,
        MediaKind::Gif => MediaAnnouncementKind::Gif,
        MediaKind::Spoiler => MediaAnnouncementKind::Spoiler,
        MediaKind::Code => MediaAnnouncementKind::Code,
    };
    MediaAnnouncement { kind, text: None }
}

fn classify_attachment(attachment: AttachmentFacts<'_>) -> MediaAnnouncementKind {
    let content_type = attachment
        .content_type
        .unwrap_or_default()
        .to_ascii_lowercase();
    let extension = attachment
        .filename
        .and_then(|filename| filename.rsplit_once('.').map(|(_, extension)| extension))
        .unwrap_or_default()
        .to_ascii_lowercase();

    if content_type == "image/gif" || extension == "gif" {
        MediaAnnouncementKind::Gif
    } else if content_type.starts_with("image/")
        || matches!(
            extension.as_str(),
            "png" | "jpg" | "jpeg" | "webp" | "bmp" | "ico" | "tiff"
        )
    {
        MediaAnnouncementKind::Image
    } else if content_type.starts_with("video/")
        || matches!(
            extension.as_str(),
            "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" | "wmv"
        )
    {
        MediaAnnouncementKind::Video
    } else if content_type.starts_with("audio/")
        || matches!(
            extension.as_str(),
            "mp3" | "ogg" | "wav" | "flac" | "m4a" | "opus"
        )
    {
        MediaAnnouncementKind::Audio
    } else if ARCHIVE_EXTENSIONS.contains(&extension.as_str()) {
        MediaAnnouncementKind::Archive
    } else {
        MediaAnnouncementKind::File
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_the_node_media_order_and_protected_markdown() {
        let media = collect_media(
            "look https://example.com ||hidden|| and `const answer = 42`",
            [AttachmentFacts {
                content_type: Some("image/png"),
                filename: Some("photo.png"),
            }],
            [StickerFacts {
                name: Some("Party blob"),
            }],
        );
        assert_eq!(
            media,
            vec![
                MediaAnnouncement {
                    kind: MediaAnnouncementKind::Link,
                    text: None,
                },
                MediaAnnouncement {
                    kind: MediaAnnouncementKind::Spoiler,
                    text: None,
                },
                MediaAnnouncement {
                    kind: MediaAnnouncementKind::Code,
                    text: None,
                },
                MediaAnnouncement {
                    kind: MediaAnnouncementKind::Image,
                    text: None,
                },
                MediaAnnouncement {
                    kind: MediaAnnouncementKind::Sticker,
                    text: Some("Party blob".into()),
                },
            ]
        );
    }

    #[test]
    fn attachment_batches_are_compact_and_fallback_to_filename_when_needed() {
        let multiple = collect_media(
            "",
            [
                AttachmentFacts {
                    content_type: None,
                    filename: Some("one.zip"),
                },
                AttachmentFacts {
                    content_type: Some("video/webm"),
                    filename: Some("two.webm"),
                },
            ],
            [],
        );
        assert_eq!(multiple[0].kind, MediaAnnouncementKind::Multiple);

        assert_eq!(
            classify_attachment(AttachmentFacts {
                content_type: None,
                filename: Some("archive.tar"),
            }),
            MediaAnnouncementKind::Archive
        );
        assert_eq!(
            classify_attachment(AttachmentFacts {
                content_type: Some("image/gif"),
                filename: Some("still.png"),
            }),
            MediaAnnouncementKind::Gif
        );
    }
}
