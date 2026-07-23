//! Strict parser for the beginner-friendly `/setup` onboarding command.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SetupCommand {
    pub channel_id: Option<u64>,
    pub test_voice: bool,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SetupCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("setup command has an invalid option shape")]
    InvalidShape,
    #[error("setup command has an invalid channel option")]
    InvalidChannel,
    #[error("setup command has an invalid test-voice option")]
    InvalidTestVoice,
}

pub fn parse_setup_command(
    command: &CommandData,
) -> Result<Option<SetupCommand>, SetupCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "setup" || area != CommandArea::ServerConfig || !path.is_empty() {
        return Ok(None);
    }
    let mut channel_id = None;
    let mut test_voice = false;
    let mut test_voice_seen = false;
    for option in &command.options {
        match (option.name.as_str(), &option.value) {
            ("channel", CommandDataOptionValue::Channel(id)) if channel_id.is_none() => {
                let id = id.get();
                if id == 0 {
                    return Err(SetupCommandError::InvalidChannel);
                }
                channel_id = Some(id);
            }
            ("test-voice", CommandDataOptionValue::Boolean(value)) if !test_voice_seen => {
                test_voice = *value;
                test_voice_seen = true;
            }
            ("channel", _) => return Err(SetupCommandError::InvalidChannel),
            ("test-voice", _) => return Err(SetupCommandError::InvalidTestVoice),
            _ => return Err(SetupCommandError::InvalidShape),
        }
    }
    Ok(Some(SetupCommand {
        channel_id,
        test_voice,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_optional_channel_and_voice_check() {
        assert_eq!(
            parse_setup_command(&command(
                r#"{"id":"1","name":"setup","type":1,"options":[{"name":"channel","type":7,"value":"123"},{"name":"test-voice","type":5,"value":true}]}"#,
            ))
            .expect("setup"),
            Some(SetupCommand {
                channel_id: Some(123),
                test_voice: true,
            })
        );
        assert_eq!(
            parse_setup_command(&command(
                r#"{"id":"1","name":"setup","type":1,"options":[]}"#,
            ))
            .expect("setup defaults"),
            Some(SetupCommand {
                channel_id: None,
                test_voice: false,
            })
        );
    }

    #[test]
    fn rejects_forged_options_and_wrong_types() {
        assert!(matches!(
            parse_setup_command(&command(
                r#"{"id":"1","name":"setup","type":1,"options":[{"name":"unknown","type":3,"value":"x"}]}"#,
            )),
            Err(SetupCommandError::InvalidShape)
        ));
        assert!(matches!(
            parse_setup_command(&command(
                r#"{"id":"1","name":"setup","type":1,"options":[{"name":"channel","type":3,"value":"123"}]}"#,
            )),
            Err(SetupCommandError::InvalidChannel)
        ));
        assert!(matches!(
            parse_setup_command(&command(
                r#"{"id":"1","name":"setup","type":1,"options":[{"name":"test-voice","type":3,"value":"true"}]}"#,
            )),
            Err(SetupCommandError::InvalidTestVoice)
        ));
    }
}
