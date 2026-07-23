//! Deterministic, language-aware text used by `/laugh`.
//!
//! This is kept as a pure function so the Rust path cannot silently replace the Node laughter
//! catalogue with an English-only fallback. The keys are the same model locale prefixes used by
//! `localePrefixOf` in the Node command handler.

#[derive(Debug, Clone, Copy)]
struct Laugh {
    unit: &'static str,
    count: usize,
}

fn laugh_for_prefix(prefix: &str) -> Laugh {
    match prefix {
        "en_" => Laugh {
            unit: "ha",
            count: 6,
        },
        "fr_" => Laugh {
            unit: "ha",
            count: 6,
        },
        "de_" => Laugh {
            unit: "ha",
            count: 5,
        },
        "cs_" => Laugh {
            unit: "ha",
            count: 5,
        },
        "nl_" => Laugh {
            unit: "ha",
            count: 9,
        },
        "pl_" => Laugh {
            unit: "ha",
            count: 12,
        },
        "tr_" => Laugh {
            unit: "ha",
            count: 7,
        },
        "sv_" => Laugh {
            unit: "ha",
            count: 10,
        },
        "fi_" => Laugh {
            unit: "ha",
            count: 9,
        },
        "da_" => Laugh {
            unit: "ha",
            count: 6,
        },
        "ro_" => Laugh {
            unit: "ha",
            count: 12,
        },
        "hu_" => Laugh {
            unit: "ha",
            count: 14,
        },
        "cy_" => Laugh {
            unit: "ha",
            count: 9,
        },
        "is_" => Laugh {
            unit: "ha",
            count: 9,
        },
        "lb_" => Laugh {
            unit: "ha",
            count: 13,
        },
        "lv_" => Laugh {
            unit: "ha",
            count: 10,
        },
        "sk_" => Laugh {
            unit: "ha",
            count: 13,
        },
        "sl_" => Laugh {
            unit: "ha",
            count: 7,
        },
        "sw_" => Laugh {
            unit: "ha",
            count: 8,
        },
        "vi_" => Laugh {
            unit: "ha",
            count: 12,
        },
        "pt_" => Laugh {
            unit: "he",
            count: 6,
        },
        "it_" => Laugh {
            unit: "he",
            count: 5,
        },
        "es_" => Laugh {
            unit: "ja",
            count: 9,
        },
        "ca_" => Laugh {
            unit: "ja",
            count: 6,
        },
        "el_" => Laugh {
            unit: "χα",
            count: 7,
        },
        "ru_" => Laugh {
            unit: "ха",
            count: 12,
        },
        "uk_" => Laugh {
            unit: "ха",
            count: 12,
        },
        "sr_" => Laugh {
            unit: "ха",
            count: 12,
        },
        "kk_" => Laugh {
            unit: "ха",
            count: 5,
        },
        "ar_" => Laugh {
            unit: "هه",
            count: 12,
        },
        "fa_" => Laugh {
            unit: "هه",
            count: 12,
        },
        "ka_" => Laugh {
            unit: "ჰა",
            count: 6,
        },
        "ne_" => Laugh {
            unit: "हा",
            count: 6,
        },
        "zh_" => Laugh {
            unit: "哈哈",
            count: 5,
        },
        "ja_" => Laugh {
            unit: "ハ",
            count: 8,
        },
        _ => Laugh {
            unit: "ha",
            count: 6,
        },
    }
}

/// Returns the same spaced, language-prefix-aware laughter as the Node implementation.
#[must_use]
pub fn laughter_for_prefix(prefix: &str) -> String {
    let laugh = laugh_for_prefix(prefix);
    std::iter::repeat_n(laugh.unit, laugh.count)
        .collect::<Vec<_>>()
        .join(" ")
}

/// Returns the same spaced, model-locale-aware laughter as the Node implementation.
#[must_use]
pub fn laughter_for_model(model: &str) -> String {
    let prefix = model
        .split_once('_')
        .map(|(language, _)| format!("{language}_"))
        .unwrap_or_default();
    laughter_for_prefix(&prefix)
}

#[cfg(test)]
mod tests {
    use super::laughter_for_model;

    #[test]
    fn preserves_the_script_and_calibrated_count_for_known_locales() {
        assert_eq!(laughter_for_model("en_US-amy-medium"), "ha ha ha ha ha ha");
        assert_eq!(
            laughter_for_model("pt_PT-tugao-medium"),
            "he he he he he he"
        );
        assert_eq!(
            laughter_for_model("es_ES-davefx-medium"),
            "ja ja ja ja ja ja ja ja ja"
        );
        assert_eq!(
            laughter_for_model("ru_RU-dmitri-medium"),
            "ха ха ха ха ха ха ха ха ха ха ха ха"
        );
        assert_eq!(laughter_for_model("unknown"), "ha ha ha ha ha ha");
    }
}
