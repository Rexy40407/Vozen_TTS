//! Bounded, in-memory anti-spam guards for passive message speech.
//!
//! They intentionally retain only the normalized last message for a short fixed window, never
//! write message content to SQLite, and are reset on process restart just like the Node runtime.

use std::collections::{BTreeMap, HashSet, VecDeque};

pub const REPETITION_MIN_TOKENS: usize = 10;
pub const REPETITION_UNIQUE_RATIO_MAX: f64 = 0.35;
pub const DUPLICATE_MIN_CHARS: usize = 40;
pub const DUPLICATE_WINDOW_MS: i64 = 60_000;
pub const COUNT_COOLDOWN_MS: i64 = 1_000;
pub const COUNT_WINDOW_MS: i64 = 60_000;
pub const COUNT_MAX_PER_MIN: usize = 10;
const MAX_ENTRIES: usize = 10_000;

/// Returns true for a large message whose words have extremely low diversity.
#[must_use]
pub fn is_repetition_spam(text: &str) -> bool {
    let tokens = tokenize(text);
    tokens.len() >= REPETITION_MIN_TOKENS
        && (tokens.iter().collect::<HashSet<_>>().len() as f64 / tokens.len() as f64)
            <= REPETITION_UNIQUE_RATIO_MAX
}

/// Lowercases and collapses whitespace for fixed-window duplicate matching.
#[must_use]
pub fn normalize_for_duplicate(text: &str) -> String {
    text.split_whitespace()
        .map(|part| {
            part.chars()
                .flat_map(char::to_lowercase)
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    for character in text.chars().flat_map(char::to_lowercase) {
        if character.is_alphanumeric() {
            current.push(character);
        } else if !current.is_empty() {
            tokens.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

#[derive(Debug, Clone)]
struct DuplicateEntry {
    text: String,
    timestamp_ms: i64,
}

/// Suppresses the same user's same large message during a fixed one-minute window.
#[derive(Debug, Default)]
pub struct DuplicateTracker {
    last: BTreeMap<(String, String), DuplicateEntry>,
    order: VecDeque<(String, String)>,
}

impl DuplicateTracker {
    /// Returns true only for a repeated large message. A suppressed duplicate does not extend the
    /// window; the first message after the window is recorded again.
    pub fn is_duplicate_spam(
        &mut self,
        guild_id: &str,
        author_id: &str,
        text: &str,
        now_ms: i64,
    ) -> bool {
        let normalized = normalize_for_duplicate(text);
        if normalized.chars().count() < DUPLICATE_MIN_CHARS {
            return false;
        }
        let key = (guild_id.to_owned(), author_id.to_owned());
        if self.last.get(&key).is_some_and(|previous| {
            previous.text == normalized
                && now_ms.saturating_sub(previous.timestamp_ms) < DUPLICATE_WINDOW_MS
        }) {
            return true;
        }
        self.last.remove(&key);
        self.last.insert(
            key.clone(),
            DuplicateEntry {
                text: normalized,
                timestamp_ms: now_ms,
            },
        );
        touch(&mut self.order, &key);
        if self.last.len() > MAX_ENTRIES
            && let Some(oldest) = self.order.pop_front()
        {
            self.last.remove(&oldest);
        }
        false
    }
}

#[derive(Debug, Clone)]
struct CountEntry {
    last_timestamp_ms: i64,
    last_content: String,
    window: Vec<i64>,
}

/// Lets an accepted speech request count toward member statistics at most ten times per minute.
#[derive(Debug, Default)]
pub struct CountGate {
    state: BTreeMap<(String, String), CountEntry>,
    order: VecDeque<(String, String)>,
}

impl CountGate {
    /// Records only successful count decisions. Rejected floods cannot move the cooldown/window.
    pub fn should_count(&mut self, guild_id: &str, user_id: &str, text: &str, now_ms: i64) -> bool {
        let key = (guild_id.to_owned(), user_id.to_owned());
        let normalized = normalize_for_duplicate(text);
        let Some(entry) = self.state.get_mut(&key) else {
            self.state.insert(
                key.clone(),
                CountEntry {
                    last_timestamp_ms: now_ms,
                    last_content: normalized,
                    window: vec![now_ms],
                },
            );
            touch(&mut self.order, &key);
            self.evict_if_needed();
            return true;
        };

        if now_ms.saturating_sub(entry.last_timestamp_ms) < COUNT_COOLDOWN_MS
            || normalized == entry.last_content
        {
            return false;
        }
        let cutoff = now_ms.saturating_sub(COUNT_WINDOW_MS);
        entry.window.retain(|timestamp| *timestamp > cutoff);
        if entry.window.len() >= COUNT_MAX_PER_MIN {
            return false;
        }
        entry.window.push(now_ms);
        entry.last_timestamp_ms = now_ms;
        entry.last_content = normalized;
        let entry = entry.clone();
        self.state.remove(&key);
        self.state.insert(key.clone(), entry);
        touch(&mut self.order, &key);
        true
    }

    fn evict_if_needed(&mut self) {
        if self.state.len() > MAX_ENTRIES
            && let Some(oldest) = self.order.pop_front()
        {
            self.state.remove(&oldest);
        }
    }
}

fn touch(order: &mut VecDeque<(String, String)>, key: &(String, String)) {
    order.retain(|existing| existing != key);
    order.push_back(key.clone());
}

#[cfg(test)]
mod tests {
    use super::*;

    const LONG: &str =
        "this is a deliberately long message used to verify fixed window duplicate handling";

    #[test]
    fn repetition_requires_many_low_diversity_tokens() {
        assert!(!is_repetition_spam("yes yes yes"));
        assert!(is_repetition_spam(
            "poke poke poke poke poke poke poke poke poke poke"
        ));
        assert!(!is_repetition_spam(
            "one two three four five six seven eight nine ten"
        ));
    }

    #[test]
    fn duplicate_window_is_fixed_and_scoped_to_the_author() {
        let mut tracker = DuplicateTracker::default();
        assert!(!tracker.is_duplicate_spam("guild", "user", LONG, 0));
        assert!(tracker.is_duplicate_spam("guild", "user", LONG, 10_000));
        assert!(tracker.is_duplicate_spam("guild", "user", LONG, 59_999));
        assert!(!tracker.is_duplicate_spam("guild", "user", LONG, 60_000));
        assert!(!tracker.is_duplicate_spam("guild", "other", LONG, 60_001));
    }

    #[test]
    fn count_gate_only_mutates_when_a_message_counts() {
        assert_eq!(COUNT_COOLDOWN_MS, 1_000);
        let mut gate = CountGate::default();
        assert!(gate.should_count("guild", "user", "first distinct message", 0));
        assert!(!gate.should_count("guild", "user", "second distinct message", 999));
        assert!(!gate.should_count("guild", "user", "first distinct message", 1_000));
        assert!(gate.should_count("guild", "user", "second distinct message", 1_000));
    }
}
