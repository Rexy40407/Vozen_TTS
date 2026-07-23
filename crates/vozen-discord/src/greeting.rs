//! Pure join-greeting parity helpers for the Rust gateway.

#[derive(Debug, Clone, PartialEq)]
pub struct Greeting {
    pub text: String,
    pub model: String,
    pub speed: f64,
}

const GREETINGS: &[(&str, &str)] = &[
    ("en", "Hello {name}"),
    ("pt", "Olá {name}"),
    ("es", "Hola {name}"),
    ("fr", "Bonjour {name}"),
    ("de", "Hallo {name}"),
    ("it", "Ciao {name}"),
    ("nl", "Hallo {name}"),
    ("sv", "Hej {name}"),
    ("da", "Hej {name}"),
    ("fi", "Hei {name}"),
    ("pl", "Cześć {name}"),
    ("ru", "Привет {name}"),
    ("uk", "Привіт {name}"),
    ("tr", "Merhaba {name}"),
    ("cs", "Ahoj {name}"),
    ("el", "Γεια σου {name}"),
    ("ro", "Salut {name}"),
    ("ca", "Hola {name}"),
    ("hu", "Szia {name}"),
];

const BIRTHDAY_WISHES: &[(&str, &str)] = &[
    ("en", "Happy birthday {name}"),
    ("pt", "Feliz aniversário {name}"),
    ("es", "Feliz cumpleaños {name}"),
    ("fr", "Joyeux anniversaire {name}"),
    ("de", "Alles Gute zum Geburtstag {name}"),
    ("it", "Buon compleanno {name}"),
    ("nl", "Gefeliciteerd met je verjaardag {name}"),
    ("sv", "Grattis på födelsedagen {name}"),
    ("da", "Tillykke med fødselsdagen {name}"),
    ("fi", "Hyvää syntymäpäivää {name}"),
    ("pl", "Wszystkiego najlepszego {name}"),
    ("ru", "С днём рождения {name}"),
    ("uk", "З днем народження {name}"),
    ("tr", "Doğum günün kutlu olsun {name}"),
    ("cs", "Všechno nejlepší {name}"),
    ("el", "Χρόνια πολλά {name}"),
    ("ro", "La mulți ani {name}"),
    ("ca", "Per molts anys {name}"),
    ("hu", "Boldog születésnapot {name}"),
];

pub fn is_join_into_channel(
    old_channel_id: Option<&str>,
    new_channel_id: Option<&str>,
    bot_channel_id: Option<&str>,
) -> bool {
    bot_channel_id.is_some_and(|bot| new_channel_id == Some(bot) && old_channel_id != Some(bot))
}

fn base_of_model(model: &str) -> &str {
    model
        .split('-')
        .next()
        .unwrap_or(model)
        .split('_')
        .next()
        .unwrap_or(model)
}

fn locale_base(locale: &str) -> String {
    locale
        .split(['-', '_'])
        .next()
        .unwrap_or("en")
        .to_ascii_lowercase()
}

fn lookup<'a>(table: &'a [(&str, &str)], locale: &str) -> (&'a str, &'a str) {
    let requested = locale_base(locale);
    table
        .iter()
        .find(|(base, _)| *base == requested)
        .copied()
        .or_else(|| table.iter().find(|(base, _)| *base == "en").copied())
        .expect("English greeting is part of the static catalogue")
}

/// Builds the same localized greeting and voice precedence as the Node implementation.
pub fn build_greeting(
    locale: &str,
    name: &str,
    available_models: &[String],
    default_voice: &str,
    default_speed: f64,
    birthday: bool,
) -> Greeting {
    let (base, template) = lookup(if birthday { BIRTHDAY_WISHES } else { GREETINGS }, locale);
    let safe_name = name.trim().replace(['\r', '\n'], " ");
    let text = template
        .replace("{name}", &safe_name)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let model = available_models
        .iter()
        .find(|model| base_of_model(model).eq_ignore_ascii_case(base))
        .cloned()
        .unwrap_or_else(|| default_voice.to_owned());
    Greeting {
        text,
        model,
        speed: default_speed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn models() -> Vec<String> {
        vec!["en_US-amy-medium".into(), "pt_PT-tugao-medium".into()]
    }

    #[test]
    fn detects_only_a_real_move_into_the_bot_channel() {
        assert!(is_join_into_channel(
            Some("other"),
            Some("voice"),
            Some("voice")
        ));
        assert!(is_join_into_channel(None, Some("voice"), Some("voice")));
        assert!(!is_join_into_channel(
            Some("voice"),
            Some("voice"),
            Some("voice")
        ));
        assert!(!is_join_into_channel(Some("other"), None, Some("voice")));
        assert!(!is_join_into_channel(Some("other"), Some("voice"), None));
    }

    #[test]
    fn chooses_requested_language_model_and_sanitizes_name() {
        let greeting = build_greeting(
            "pt-PT",
            "  Diogo\n @everyone ",
            &models(),
            "en_US-amy-medium",
            1.1,
            false,
        );
        assert_eq!(greeting.text, "Olá Diogo @everyone");
        assert_eq!(greeting.model, "pt_PT-tugao-medium");
        assert_eq!(greeting.speed, 1.1);
    }

    #[test]
    fn falls_back_to_english_text_and_default_voice() {
        let greeting = build_greeting("ja", "Rexy", &models(), "en_US-amy-medium", 1.0, true);
        assert_eq!(greeting.text, "Happy birthday Rexy");
        assert_eq!(greeting.model, "en_US-amy-medium");
    }
}
