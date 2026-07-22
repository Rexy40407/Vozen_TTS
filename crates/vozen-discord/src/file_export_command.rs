//! Typed parsing for the private `/tts-file` command.
//!
//! This stays separate from [`crate::CoreVoiceCommand`]: file export is deliberately not speech
//! in a Discord call, works in a user-app/DM context, and must not inherit the same-call gate.
//! The runtime still needs a separately opt-in ephemeral attachment adapter before it can claim
//! this interaction from Node.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TtsFileCommand {
    /// Kept only for the interaction lifetime. The export service cleans and bounds it again.
    pub text: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TtsFileCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the private file command is missing its required text option")]
    MissingText,
    #[error("the private file command has a non-string text option")]
    InvalidText,
    #[error("the private file command contains an undeclared option")]
    UnexpectedOption,
}

/// Parses only `/tts-file` after checking the versioned command contract.
///
/// Commands belonging to another route, including the in-call voice commands, return `None`.
/// This lets a future file adapter coexist with the call adapter without accidentally consuming
/// commands that have not reached parity.
pub fn parse_tts_file_command(
    command: &CommandData,
) -> Result<Option<TtsFileCommand>, TtsFileCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::CoreVoice
        || command.name != "tts-file"
    {
        return Ok(None);
    }
    if command.options.iter().any(|option| option.name != "text") {
        return Err(TtsFileCommandError::UnexpectedOption);
    }
    command
        .options
        .iter()
        .find(|option| option.name == "text")
        .map(|option| match &option.value {
            CommandDataOptionValue::String(text) => Ok(Some(TtsFileCommand { text: text.clone() })),
            _ => Err(TtsFileCommandError::InvalidText),
        })
        .unwrap_or(Err(TtsFileCommandError::MissingText))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid Discord command payload")
    }

    #[test]
    fn accepts_only_the_declared_private_file_command() {
        assert_eq!(
            parse_tts_file_command(&command(
                r#"{"id":"1","name":"tts-file","type":1,"options":[{"name":"text","type":3,"value":"hello"}]}"#,
            ))
            .expect("file command"),
            Some(TtsFileCommand {
                text: "hello".into()
            })
        );
        assert_eq!(
            parse_tts_file_command(&command(
                r#"{"id":"1","name":"tts","type":1,"options":[{"name":"text","type":3,"value":"hello"}]}"#,
            ))
            .expect("different command"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_incomplete_private_file_payloads() {
        assert_eq!(
            parse_tts_file_command(&command(
                r#"{"id":"1","name":"tts-file","type":1,"options":[]}"#
            )),
            Err(TtsFileCommandError::MissingText)
        );
        assert_eq!(
            parse_tts_file_command(&command(
                r#"{"id":"1","name":"tts-file","type":1,"options":[{"name":"text","type":4,"value":42}]}"#,
            )),
            Err(TtsFileCommandError::InvalidText)
        );
        assert_eq!(
            parse_tts_file_command(&command(
                r#"{"id":"1","name":"tts-file","type":1,"options":[{"name":"not-text","type":3,"value":"hello"}]}"#,
            )),
            Err(TtsFileCommandError::UnexpectedOption)
        );
    }
}
