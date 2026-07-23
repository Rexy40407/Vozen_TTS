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
}
