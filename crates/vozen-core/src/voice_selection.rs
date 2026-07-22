//! Deterministic model selection from detected ISO 639-3 languages.

/// Chooses the first available model for a detected language, otherwise `fallback`.
pub fn pick_voice(language: &str, available: &[String], fallback: &str) -> String {
    let Some(prefix) = language_prefix(language) else {
        return fallback.to_owned();
    };
    available
        .iter()
        .find(|model| model.starts_with(prefix))
        .cloned()
        .unwrap_or_else(|| fallback.to_owned())
}

/// As [`pick_voice`], but retains the configured preferred model when it already has the
/// detected language. This prevents a first-in-list model from unexpectedly overriding the
/// voice the user selected.
pub fn pick_voice_for_language(language: &str, available: &[String], preferred: &str) -> String {
    let Some(prefix) = language_prefix(language) else {
        return preferred.to_owned();
    };
    if preferred.starts_with(prefix) {
        return preferred.to_owned();
    }
    available
        .iter()
        .find(|model| model.starts_with(prefix))
        .cloned()
        .unwrap_or_else(|| preferred.to_owned())
}

/// The accent-restoration dictionary associated with a model locale.
pub fn accent_language_of_model(model: &str) -> &'static str {
    match model
        .split_once('_')
        .map(|(prefix, _)| prefix.to_ascii_lowercase())
    {
        Some(prefix) if prefix == "pt" => "por",
        Some(prefix) if prefix == "es" => "spa",
        Some(prefix) if prefix == "fr" => "fra",
        Some(prefix) if prefix == "de" => "deu",
        _ => "",
    }
}

fn language_prefix(language: &str) -> Option<&'static str> {
    Some(match language {
        "por" => "pt_",
        "eng" => "en_",
        "spa" => "es_",
        "fra" => "fr_",
        "deu" => "de_",
        "ita" => "it_",
        "nld" => "nl_",
        "rus" => "ru_",
        "pol" => "pl_",
        "ukr" => "uk_",
        "tur" => "tr_",
        "ces" => "cs_",
        "cat" => "ca_",
        "swe" => "sv_",
        "fin" => "fi_",
        "dan" => "da_",
        "ron" => "ro_",
        "ell" => "el_",
        "hun" => "hu_",
        "ara" | "arb" => "ar_",
        "cym" => "cy_",
        "fas" | "pes" => "fa_",
        "isl" => "is_",
        "kat" => "ka_",
        "kaz" => "kk_",
        "ltz" => "lb_",
        "lav" => "lv_",
        "nep" => "ne_",
        "slk" => "sk_",
        "slv" => "sl_",
        "srp" => "sr_",
        "swh" | "swa" => "sw_",
        "vie" => "vi_",
        "cmn" | "zho" => "zh_",
        "nob" | "nno" | "nor" => "no_",
        "jpn" => "ja_",
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn available() -> Vec<String> {
        vec![
            "en_GB-alan-medium".to_owned(),
            "en_US-amy-medium".to_owned(),
            "pt_PT-tugao-medium".to_owned(),
            "es_ES-davefx-medium".to_owned(),
        ]
    }

    #[test]
    fn maps_the_full_supported_language_contract() {
        assert_eq!(
            pick_voice("por", &available(), "en_US-amy-medium"),
            "pt_PT-tugao-medium"
        );
        assert_eq!(
            pick_voice("eng", &available(), "pt_PT-tugao-medium"),
            "en_GB-alan-medium"
        );
        assert_eq!(
            pick_voice("xyz", &available(), "en_US-amy-medium"),
            "en_US-amy-medium"
        );
        assert_eq!(
            pick_voice(
                "jpn",
                &["ja_JP-google-medium".to_owned()],
                "en_US-amy-medium"
            ),
            "ja_JP-google-medium"
        );
        assert_eq!(
            pick_voice(
                "nor",
                &["no_NO-talesyntese-medium".to_owned()],
                "en_US-amy-medium"
            ),
            "no_NO-talesyntese-medium"
        );
    }

    #[test]
    fn preferred_voice_wins_inside_its_detected_language() {
        assert_eq!(
            pick_voice_for_language("eng", &available(), "en_US-amy-medium"),
            "en_US-amy-medium"
        );
        assert_eq!(
            pick_voice_for_language("spa", &available(), "en_US-amy-medium"),
            "es_ES-davefx-medium"
        );
        assert_eq!(accent_language_of_model("pt_PT-tugao-medium"), "por");
        assert_eq!(accent_language_of_model("en_US-amy-medium"), "");
    }
}
