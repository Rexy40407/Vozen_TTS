//! Curated soundboard catalog for `/sound`.
//!
//! Only these stable keys can become asset paths. No Discord/user-provided string is ever joined
//! to the filesystem path.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SoundClip {
    pub key: &'static str,
    pub name: &'static str,
    pub emoji: &'static str,
}

pub static SOUNDS: &[SoundClip] = &[
    SoundClip {
        key: "airhorn",
        name: "Air horn",
        emoji: "📢",
    },
    SoundClip {
        key: "ding",
        name: "Ding",
        emoji: "🔔",
    },
    SoundClip {
        key: "buzzer",
        name: "Wrong buzzer",
        emoji: "❌",
    },
    SoundClip {
        key: "tada",
        name: "Ta-da!",
        emoji: "🎉",
    },
    SoundClip {
        key: "sad-trombone",
        name: "Sad trombone",
        emoji: "🎺",
    },
    SoundClip {
        key: "beep",
        name: "Beep",
        emoji: "🔊",
    },
    SoundClip {
        key: "coin",
        name: "Coin",
        emoji: "🪙",
    },
    SoundClip {
        key: "pop",
        name: "Pop",
        emoji: "🫧",
    },
    SoundClip {
        key: "laser",
        name: "Laser",
        emoji: "🛸",
    },
    SoundClip {
        key: "success",
        name: "Success",
        emoji: "✅",
    },
    SoundClip {
        key: "error",
        name: "Error",
        emoji: "⛔",
    },
    SoundClip {
        key: "boing",
        name: "Boing",
        emoji: "🪀",
    },
    SoundClip {
        key: "sparkle",
        name: "Sparkle",
        emoji: "✨",
    },
    SoundClip {
        key: "whoosh",
        name: "Whoosh",
        emoji: "💨",
    },
];

pub fn sound_by_key(key: &str) -> Option<SoundClip> {
    SOUNDS.iter().copied().find(|clip| clip.key == key)
}

pub fn sound_list() -> String {
    SOUNDS
        .iter()
        .map(|clip| format!("{} `{}`", clip.emoji, clip.key))
        .collect::<Vec<_>>()
        .join(" · ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_matches_the_curated_asset_library() {
        assert_eq!(SOUNDS.len(), 14);
        assert_eq!(sound_by_key("airhorn").expect("airhorn").name, "Air horn");
        assert!(sound_by_key("../../private").is_none());
        assert!(sound_list().contains("sad-trombone"));
    }
}
