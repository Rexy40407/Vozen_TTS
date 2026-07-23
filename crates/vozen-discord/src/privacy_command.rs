//! Parser for the destructive `/privacy erase` command.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrivacyEraseCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PrivacyCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("privacy erase command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_privacy_erase_command(
    command: &CommandData,
) -> Result<Option<PrivacyEraseCommand>, PrivacyCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "privacy" || area != CommandArea::Privacy || path != ["erase"] {
        return Ok(None);
    }
    if command.options.len() != 1
        || !matches!(
            &command.options[0].value,
            CommandDataOptionValue::SubCommand(options) if options.is_empty()
        )
    {
        return Err(PrivacyCommandError::InvalidShape);
    }
    Ok(Some(PrivacyEraseCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_the_erase_subcommand() {
        assert_eq!(
            parse_privacy_erase_command(&command(
                r#"{"id":"1","name":"privacy","type":1,"options":[{"type":1,"name":"erase","options":[]}]}"#,
            ))
            .expect("privacy"),
            Some(PrivacyEraseCommand)
        );
        assert_eq!(
            parse_privacy_erase_command(&command(
                r#"{"id":"1","name":"privacy","type":1,"options":[]}"#,
            ))
            .expect("privacy"),
            None
        );
    }
}
