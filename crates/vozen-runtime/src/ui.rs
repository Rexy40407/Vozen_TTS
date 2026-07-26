//! Shared presentation helpers for Rust responses.

use serenity::builder::CreateEmbed;

pub const BRAND_COLOR: u32 = 0x5865F2;
const SUCCESS_COLOR: u32 = 0x57F287;
const WARNING_COLOR: u32 = 0xFEE75C;
const DANGER_COLOR: u32 = 0xED4245;
const PREMIUM_COLOR: u32 = 0xF1C40F;

/// Builds the shared Vozen card used by command and gateway responses.
pub fn message_embed(content: impl Into<String>) -> CreateEmbed {
    let content = content.into();
    CreateEmbed::new()
        .color(color_for_content(&content))
        .description(content)
}

/// Explicit semantic cards for handlers whose text does not carry a status emoji.
#[allow(dead_code)]
pub fn danger_embed(content: impl Into<String>) -> CreateEmbed {
    CreateEmbed::new().color(DANGER_COLOR).description(content)
}

#[allow(dead_code)]
pub fn success_embed(content: impl Into<String>) -> CreateEmbed {
    CreateEmbed::new().color(SUCCESS_COLOR).description(content)
}

/// Mirrors the TypeScript card tone detection without depending on translated words.
pub fn color_for_content(content: &str) -> u32 {
    let start = content.trim_start();
    if start.starts_with(['✅', '☑', '🎉', '🥳', '🟢', '🟩']) {
        SUCCESS_COLOR
    } else if start.starts_with(['⚠', '⏳', '🟡', '🟨']) {
        WARNING_COLOR
    } else if start.starts_with(['❌', '🚫', '⛔', '🛑', '🔴', '🟥']) {
        DANGER_COLOR
    } else if start.starts_with(['💎', '👑']) {
        PREMIUM_COLOR
    } else {
        BRAND_COLOR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_tone_matches_typescript_semantic_marks() {
        assert_eq!(color_for_content("✅ ready"), SUCCESS_COLOR);
        assert_eq!(color_for_content("⚠ try again"), WARNING_COLOR);
        assert_eq!(color_for_content("❌ failed"), DANGER_COLOR);
        assert_eq!(color_for_content("💎 premium"), PREMIUM_COLOR);
        assert_eq!(color_for_content("📊 stats"), BRAND_COLOR);
    }
}
