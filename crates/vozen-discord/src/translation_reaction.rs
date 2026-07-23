//! Locale selection for the flag-reaction translation path.

#[must_use]
pub fn reaction_target_locale(emoji: &str) -> Option<&'static str> {
    match emoji {
        "🇬🇧" | "🇺🇸" => Some("en"),
        "🇵🇹" | "🇧🇷" => Some("pt"),
        "🇪🇸" => Some("es"),
        "🇫🇷" => Some("fr"),
        "🇩🇪" => Some("de"),
        "🇮🇹" => Some("it"),
        "🇳🇱" => Some("nl"),
        "🇵🇱" => Some("pl"),
        "🇹🇷" => Some("tr"),
        "🇯🇵" => Some("ja"),
        "🇰🇷" => Some("ko"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::reaction_target_locale;

    #[test]
    fn maps_every_supported_flag_and_rejects_other_emojis() {
        let cases = [
            ("🇬🇧", "en"),
            ("🇺🇸", "en"),
            ("🇵🇹", "pt"),
            ("🇧🇷", "pt"),
            ("🇪🇸", "es"),
            ("🇫🇷", "fr"),
            ("🇩🇪", "de"),
            ("🇮🇹", "it"),
            ("🇳🇱", "nl"),
            ("🇵🇱", "pl"),
            ("🇹🇷", "tr"),
            ("🇯🇵", "ja"),
            ("🇰🇷", "ko"),
        ];
        for (emoji, expected) in cases {
            assert_eq!(reaction_target_locale(emoji), Some(expected));
        }
        assert_eq!(reaction_target_locale("👍"), None);
        assert_eq!(reaction_target_locale(""), None);
    }
}
