//! Explicit Node-to-Rust cutover contract.
//!
//! The migration is deliberately allowed to run in shadow/hybrid mode while individual
//! canaries are verified. `full` is different: it is a release gate, not a shortcut for turning
//! on whichever flags happen to be implemented. Every surface that can make the Node gateway
//! answer an interaction must be explicitly promoted before the legacy process is allowed to
//! stand down.

use std::env;

use thiserror::Error;

/// Rust canaries that must be on before the Node gateway can be stopped.
///
/// `RUST_GAME_PLAY_ENABLED` is included because full mode must not leave the live game
/// surface behind. The adapter is implemented, but the operator still has to enable the flag
/// explicitly.
pub const FULL_RUNTIME_FLAGS: &[&str] = &[
    "RUST_RUNTIME_READY",
    "RUST_REGISTER_COMMANDS_ENABLED",
    "RUST_CORE_VOICE_ENABLED",
    "RUST_QUEUE_ENABLED",
    "RUST_PRONUNCIATION_ENABLED",
    "RUST_CONFIG_LANGUAGE_ENABLED",
    "RUST_CONFIG_TOGGLES_ENABLED",
    "RUST_CONFIG_NUMERIC_ENABLED",
    "RUST_CONFIG_ROLE_ENABLED",
    "RUST_CONFIG_DEFAULT_VOICE_ENABLED",
    "RUST_CONFIG_CHANNEL_ENABLED",
    "RUST_CONFIG_QUEUE_ROLES_ENABLED",
    "RUST_CONFIG_GREET_LANGUAGE_ENABLED",
    "RUST_CONFIG_BLOCKWORD_ENABLED",
    "RUST_CONFIG_SHOW_ENABLED",
    "RUST_CONFIG_RESET_ENABLED",
    "RUST_UPTIME_ENABLED",
    "RUST_INVITE_ENABLED",
    "RUST_HELP_ENABLED",
    "RUST_VOTE_ENABLED",
    "RUST_TOP_SPEAKERS_ENABLED",
    "RUST_BIRTHDAY_ENABLED",
    "RUST_BOT_STATS_ENABLED",
    "RUST_SERVER_STATS_ENABLED",
    "RUST_STATS_ENABLED",
    "RUST_PREMIUM_ENABLED",
    "RUST_REDEEM_ENABLED",
    "RUST_PRIVACY_ENABLED",
    "RUST_GAME_LIST_ENABLED",
    "RUST_GAME_SCORES_ENABLED",
    "RUST_GAME_PLAY_ENABLED",
    "RUST_PUBLIC_COMMANDS_ENABLED",
    "RUST_TTS_FILE_ENABLED",
    "RUST_TRANSCRIBE_MESSAGE_ENABLED",
    "RUST_TRANSCRIBE_LIVE_ENABLED",
    "RUST_TRANSCRIBE_CONTROL_ENABLED",
    "RUST_SPEAK_CONTEXT_ENABLED",
    "RUST_VOICE_PREFERENCES_ENABLED",
    "RUST_TRANSLATE_TEXT_ENABLED",
    "RUST_TRANSLATE_CONTEXT_ENABLED",
    "RUST_TRANSLATION_ADMIN_ENABLED",
    "RUST_TRANSLATION_PREFERENCES_ENABLED",
    "RUST_AUTOMATIC_TRANSLATION_ENABLED",
    "RUST_WELCOME_ENABLED",
    "RUST_MESSAGE_AUTOREAD_ENABLED",
    "RUST_RANDOMIZER_ENABLED",
    "RUST_CAST_ENABLED",
    "RUST_SETUP_ENABLED",
    "RUST_OWNER_COMMANDS_ENABLED",
    "RUST_BROWSER_API_ENABLED",
    "RUST_DASHBOARD_ENABLED",
    "RUST_ADMIN_API_ENABLED",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode {
    Shadow,
    Full,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum RuntimeModeError {
    #[error("RUST_RUNTIME_MODE must be `shadow` or `full`")]
    InvalidValue,
    #[error("RUST_RUNTIME_MODE=full requires every Rust canary to be true; missing: {0}")]
    MissingFlags(String),
}

impl RuntimeMode {
    pub fn from_environment() -> Result<Self, RuntimeModeError> {
        Self::parse(env::var("RUST_RUNTIME_MODE").ok().as_deref())
    }

    pub fn parse(raw: Option<&str>) -> Result<Self, RuntimeModeError> {
        match raw.map(str::trim).filter(|value| !value.is_empty()) {
            None => Ok(Self::Shadow),
            Some(value) if value.eq_ignore_ascii_case("shadow") => Ok(Self::Shadow),
            Some(value) if value.eq_ignore_ascii_case("full") => Ok(Self::Full),
            Some(_) => Err(RuntimeModeError::InvalidValue),
        }
    }

    #[must_use]
    pub fn is_full(self) -> bool {
        matches!(self, Self::Full)
    }

    /// Fails before SQLite/gateway side effects if a full cutover is incomplete.
    pub fn validate_environment(self) -> Result<(), RuntimeModeError> {
        if !self.is_full() {
            return Ok(());
        }
        let missing = FULL_RUNTIME_FLAGS
            .iter()
            .copied()
            .filter(|name| !literal_true(env::var(name).ok().as_deref()))
            .collect::<Vec<_>>();
        if missing.is_empty() {
            // Every canary is part of the contract, so a future implementation cannot be omitted
            // accidentally once the operator deliberately requests full mode.
            Ok(())
        } else {
            Err(RuntimeModeError::MissingFlags(missing.join(", ")))
        }
    }
}

fn literal_true(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_shadow_and_rejects_typos() {
        assert_eq!(RuntimeMode::parse(None), Ok(RuntimeMode::Shadow));
        assert_eq!(
            RuntimeMode::parse(Some(" shadow ")),
            Ok(RuntimeMode::Shadow)
        );
        assert_eq!(RuntimeMode::parse(Some("FULL")), Ok(RuntimeMode::Full));
        assert_eq!(
            RuntimeMode::parse(Some("yes")),
            Err(RuntimeModeError::InvalidValue)
        );
    }

    #[test]
    fn full_contract_includes_live_game_and_transcription_surfaces() {
        assert!(FULL_RUNTIME_FLAGS.contains(&"RUST_GAME_PLAY_ENABLED"));
        assert!(FULL_RUNTIME_FLAGS.contains(&"RUST_TRANSCRIBE_LIVE_ENABLED"));
        assert!(FULL_RUNTIME_FLAGS.contains(&"RUST_WELCOME_ENABLED"));
        assert!(FULL_RUNTIME_FLAGS.contains(&"RUST_BROWSER_API_ENABLED"));
    }
}
