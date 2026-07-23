//! Parser for the public `/help` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{command_path_from_options, command_routing::CommandArea, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HelpCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum HelpCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("help command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_help_command(command: &CommandData) -> Result<Option<HelpCommand>, HelpCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "help" || area != CommandArea::Discovery || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(HelpCommandError::InvalidShape);
    }
    Ok(Some(HelpCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_the_public_root_command() {
        assert_eq!(
            parse_help_command(&command(
                r#"{"id":"1","name":"help","type":1,"options":[]}"#
            ))
            .expect("help"),
            Some(HelpCommand)
        );
        assert_eq!(
            parse_help_command(&command(
                r#"{"id":"1","name":"invite","type":1,"options":[]}"#
            ))
            .expect("invite"),
            None
        );
    }
}
