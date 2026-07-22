//! Curated English chat-abbreviation expansion used before TTS.
//!
//! The list intentionally avoids tokens that collide with normal words in supported
//! languages (for example `ty`, `np`, `u`, and `r`).

use crate::speech_safety::replace_whole_word_with;

const DICTIONARY: &[(&str, &str)] = &[
    ("btw", "by the way"),
    ("idk", "I don't know"),
    ("idc", "I don't care"),
    ("imo", "in my opinion"),
    ("imho", "in my humble opinion"),
    ("tbh", "to be honest"),
    ("brb", "be right back"),
    ("omg", "oh my god"),
    ("omw", "on my way"),
    ("rn", "right now"),
    ("fyi", "for your information"),
    ("asap", "as soon as possible"),
    ("aka", "also known as"),
    ("tysm", "thank you so much"),
    ("yw", "you're welcome"),
    ("nvm", "never mind"),
    ("ttyl", "talk to you later"),
    ("gtg", "got to go"),
    ("wyd", "what are you doing"),
    ("ikr", "I know right"),
    ("smh", "shaking my head"),
    ("tldr", "too long didn't read"),
    ("irl", "in real life"),
    ("afaik", "as far as I know"),
    ("lmk", "let me know"),
    ("nbd", "no big deal"),
    ("tba", "to be announced"),
    ("tbd", "to be determined"),
    ("ppl", "people"),
    ("pls", "please"),
    ("plz", "please"),
    ("thx", "thanks"),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlangSegment {
    pub text: String,
    pub is_english: bool,
}

/// Expands known English slang in any language, preserving sentence-initial capitalization.
pub fn expand_abbreviations(text: &str) -> String {
    DICTIONARY
        .iter()
        .fold(text.to_owned(), |current, (token, expansion)| {
            replace_whole_word_with(&current, token, |matched| {
                if matched.chars().next().is_some_and(char::is_uppercase) {
                    capitalize_first(expansion)
                } else {
                    (*expansion).to_owned()
                }
            })
            .0
        })
}

/// Splits text into consecutive slang and non-slang pieces for mixed-voice synthesis.
pub fn split_english_slang(text: &str) -> Vec<SlangSegment> {
    let mut segments: Vec<SlangSegment> = Vec::new();
    for word in text.split_whitespace() {
        let is_english = known_token(&word_core(word));
        match segments.last_mut() {
            Some(last) if last.is_english == is_english => {
                last.text.push(' ');
                last.text.push_str(word);
            }
            _ => segments.push(SlangSegment {
                text: word.to_owned(),
                is_english,
            }),
        }
    }
    segments
}

/// Whether every whitespace-separated token is known English slang.
pub fn is_all_english_abbrev(text: &str) -> bool {
    let tokens: Vec<_> = text.split_whitespace().collect();
    !tokens.is_empty() && tokens.iter().all(|token| known_token(&word_core(token)))
}

fn known_token(token: &str) -> bool {
    DICTIONARY.iter().any(|(key, _)| *key == token)
}

fn word_core(word: &str) -> String {
    word.trim_matches(|character: char| !character.is_alphanumeric())
        .chars()
        .flat_map(char::to_lowercase)
        .collect()
}

fn capitalize_first(text: &str) -> String {
    let Some(first) = text.chars().next() else {
        return String::new();
    };
    format!("{}{}", first.to_uppercase(), &text[first.len_utf8()..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expands_only_whole_curated_tokens_and_preserves_initial_case() {
        assert_eq!(
            expand_abbreviations("Btw, btwx; omg! TY e np"),
            "By the way, btwx; oh my god! TY e np"
        );
    }

    #[test]
    fn separates_only_known_slang_for_mixed_voice_selection() {
        assert_eq!(
            split_english_slang("bom dia btw omg pessoal"),
            vec![
                SlangSegment {
                    text: "bom dia".to_owned(),
                    is_english: false,
                },
                SlangSegment {
                    text: "btw omg".to_owned(),
                    is_english: true,
                },
                SlangSegment {
                    text: "pessoal".to_owned(),
                    is_english: false,
                },
            ]
        );
        assert!(is_all_english_abbrev("BRB, omg!"));
        assert!(!is_all_english_abbrev("brb pessoal"));
        assert!(!is_all_english_abbrev("   "));
    }
}
