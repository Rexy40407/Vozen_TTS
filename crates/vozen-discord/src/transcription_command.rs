//! Contract-backed parser for the consent-only `/transcribe revoke` leaf.
//!
//! Live session start/stop stays in the Node runtime until Rust has an equivalent receiver
//! implementation. Revoke is independent: it only removes the invoking user's consent row.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TranscriptionControlCommand;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TranscriptionSessionCommand {
    Start { language: Option<String> },
    Stop,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranscriptionControlCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("transcription control command has an invalid option shape")]
    InvalidShape,
}

/// Accept only the no-option `/transcribe revoke` leaf. Unknown paths are rejected by the
/// generated contract before this parser can claim the interaction.
pub fn parse_transcription_control_command(
    command: &CommandData,
) -> Result<Option<TranscriptionControlCommand>, TranscriptionControlCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "transcribe" || area != CommandArea::Transcription {
        return Ok(None);
    }
    let Some(subcommand) = command.options.first() else {
        return Err(TranscriptionControlCommandError::InvalidShape);
    };
    if subcommand.name != "revoke" {
        return Ok(None);
    }
    if !matches!(&subcommand.value, CommandDataOptionValue::SubCommand(options) if options.is_empty())
    {
        return Err(TranscriptionControlCommandError::InvalidShape);
    }
    Ok(Some(TranscriptionControlCommand))
}

/// Parses the live-session leaves without claiming ownership of the consent-only `revoke` leaf.
/// The generated command contract is checked first and the option shape is then validated
/// strictly, so an interaction cannot smuggle an arbitrary value into the Rust session.
pub fn parse_transcription_session_command(
    command: &CommandData,
) -> Result<Option<TranscriptionSessionCommand>, TranscriptionControlCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "transcribe" || area != CommandArea::Transcription {
        return Ok(None);
    }
    let Some(subcommand) = command.options.first() else {
        return Err(TranscriptionControlCommandError::InvalidShape);
    };
    let CommandDataOptionValue::SubCommand(options) = &subcommand.value else {
        return Err(TranscriptionControlCommandError::InvalidShape);
    };
    match subcommand.name.as_str() {
        "stop" => {
            if options.is_empty() {
                Ok(Some(TranscriptionSessionCommand::Stop))
            } else {
                Err(TranscriptionControlCommandError::InvalidShape)
            }
        }
        "start" => {
            if options.is_empty() {
                return Ok(Some(TranscriptionSessionCommand::Start { language: None }));
            }
            if options.len() != 1 || options[0].name != "language" {
                return Err(TranscriptionControlCommandError::InvalidShape);
            }
            let CommandDataOptionValue::String(language) = &options[0].value else {
                return Err(TranscriptionControlCommandError::InvalidShape);
            };
            Ok(Some(TranscriptionSessionCommand::Start {
                language: Some(language.clone()),
            }))
        }
        "revoke" => Ok(None),
        _ => Err(TranscriptionControlCommandError::InvalidShape),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_revoke() {
        assert_eq!(
            parse_transcription_control_command(&command(
                r#"{"id":"1","name":"transcribe","type":1,"options":[{"type":1,"name":"revoke","options":[]}]}"#,
            ))
            .expect("revoke"),
            Some(TranscriptionControlCommand)
        );
    }

    #[test]
    fn leaves_start_and_stop_to_the_live_session_adapter() {
        for subcommand in ["start", "stop"] {
            let payload = format!(
                r#"{{"id":"1","name":"transcribe","type":1,"options":[{{"type":1,"name":"{subcommand}","options":[]}}]}}"#
            );
            assert_eq!(
                parse_transcription_control_command(&command(&payload)).expect("known path"),
                None,
                "{subcommand} must remain Node-owned"
            );
        }
    }

    #[test]
    fn rejects_forged_options() {
        assert!(matches!(
            parse_transcription_control_command(&command(
                r#"{"id":"1","name":"transcribe","type":1,"options":[{"type":1,"name":"revoke","options":[{"type":3,"name":"unexpected","value":"x"}]}]}"#,
            )),
            Err(TranscriptionControlCommandError::InvalidShape)
        ));
    }

    #[test]
    fn parses_start_language_and_stop_without_claiming_revoke() {
        let start = command(
            r#"{"id":"1","name":"transcribe","type":1,"options":[{"type":1,"name":"start","options":[{"type":3,"name":"language","value":"pt"}]}]}"#,
        );
        assert_eq!(
            parse_transcription_session_command(&start).expect("start"),
            Some(TranscriptionSessionCommand::Start {
                language: Some("pt".into())
            })
        );
        let stop = command(
            r#"{"id":"1","name":"transcribe","type":1,"options":[{"type":1,"name":"stop","options":[]}]}"#,
        );
        assert_eq!(
            parse_transcription_session_command(&stop).expect("stop"),
            Some(TranscriptionSessionCommand::Stop)
        );
        let revoke = command(
            r#"{"id":"1","name":"transcribe","type":1,"options":[{"type":1,"name":"revoke","options":[]}]}"#,
        );
        assert_eq!(
            parse_transcription_session_command(&revoke).expect("revoke"),
            None
        );
    }

    #[test]
    fn rejects_unknown_start_arguments() {
        let forged = command(
            r#"{"id":"1","name":"transcribe","type":1,"options":[{"type":1,"name":"start","options":[{"type":3,"name":"language","value":"pt"},{"type":3,"name":"unexpected","value":"x"}]}]}"#,
        );
        assert!(matches!(
            parse_transcription_session_command(&forged),
            Err(TranscriptionControlCommandError::InvalidShape)
        ));
    }
}
