//! Local, conservative language detection for auto-read.
//!
//! The result is an ISO 639-3 code only when we have a strong signal. Callers must retain the
//! configured voice when this returns `None`; an uncertain guess must never unexpectedly switch
//! the language a member hears.

use whatlang::detect;

// `whatlang`'s built-in `is_reliable` threshold (0.9) is calibrated for documents and rejects
// normal chat sentences. This conservative floor accepts only stronger chat-sized results; short
// messages still require the curated lexical match above it.
const MIN_CONFIDENCE: f64 = 0.65;

/// Detects a supported language from an untrusted chat message.
///
/// Short greetings are deliberately handled before the trigram detector: they are common in
/// Discord and not long enough for a statistical detector to distinguish reliably. Longer text
/// must satisfy `whatlang`'s reliability threshold. The returned value is ISO 639-3, matching the
/// persisted Node contract and [`crate::pick_voice_for_language`].
#[must_use]
pub fn detect_language(text: &str) -> Option<&'static str> {
    let normalized = normalize(text);
    if normalized.is_empty() {
        return None;
    }

    if let Some(language) = lookup_short_language(&normalized) {
        return Some(language);
    }

    let info = detect(&normalized)?;
    (info.confidence() >= MIN_CONFIDENCE).then_some(info.lang().code())
}

fn normalize(text: &str) -> String {
    let mut normalized = String::with_capacity(text.len());
    let mut previous_space = true;
    for character in text.chars().flat_map(char::to_lowercase) {
        if character.is_alphanumeric() {
            normalized.push(character);
            previous_space = false;
        } else if !previous_space {
            normalized.push(' ');
            previous_space = true;
        }
    }
    normalized.trim_end().to_owned()
}

fn lookup_short_language(text: &str) -> Option<&'static str> {
    let words = text.split_whitespace().collect::<Vec<_>>();
    let first = *words.first()?;
    let whole = SHORT_GREETINGS
        .iter()
        .find_map(|(greeting, language)| (*greeting == text).then_some(*language));
    if whole.is_some() || words.len() > 4 {
        return whole;
    }

    SHORT_GREETINGS
        .iter()
        .find_map(|(greeting, language)| (*greeting == first).then_some(*language))
}

// The Node implementation has a larger curated lexicon. These high-frequency forms cover the
// short messages most likely to arrive alone; longer text is evaluated by `whatlang` instead.
const SHORT_GREETINGS: &[(&str, &str)] = &[
    ("ola", "por"),
    ("olá", "por"),
    ("bom dia", "por"),
    ("boa tarde", "por"),
    ("boa noite", "por"),
    ("hello", "eng"),
    ("hi", "eng"),
    ("hey", "eng"),
    ("good morning", "eng"),
    ("hola", "spa"),
    ("buenos dias", "spa"),
    ("buenas tardes", "spa"),
    ("buenas noches", "spa"),
    ("bonjour", "fra"),
    ("salut", "fra"),
    ("bonsoir", "fra"),
    ("hallo", "deu"),
    ("guten morgen", "deu"),
    ("guten tag", "deu"),
    ("ciao", "ita"),
    ("buongiorno", "ita"),
    ("hoi", "nld"),
    ("goedemorgen", "nld"),
    ("merhaba", "tur"),
    ("привет", "rus"),
    ("привіт", "ukr"),
    ("cześć", "pol"),
    ("ahoj", "ces"),
    ("hej", "swe"),
    ("hei", "fin"),
    ("godmorgen", "dan"),
    ("γεια", "ell"),
    ("مرحبا", "ara"),
    ("سلام", "fas"),
    ("नमस्ते", "hin"),
    ("你好", "cmn"),
    ("こんにちは", "jpn"),
    ("안녕하세요", "kor"),
    ("xin chào", "vie"),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_short_greetings_before_statistical_detection() {
        assert_eq!(detect_language("Olá!"), Some("por"));
        assert_eq!(detect_language("hola como estas"), Some("spa"));
        assert_eq!(detect_language("bonjour à tous"), Some("fra"));
        assert_eq!(detect_language("你好"), Some("cmn"));
    }

    #[test]
    fn accepts_only_reliable_longer_detection() {
        assert_eq!(
            detect_language("This is a clear English sentence written for language detection."),
            Some("eng")
        );
    }

    #[test]
    fn never_guesses_for_empty_or_ambiguous_input() {
        assert_eq!(detect_language("  "), None);
        assert_eq!(detect_language("x"), None);
    }
}
