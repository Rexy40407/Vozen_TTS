//! Strict parser for the read-only `/config show` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigShowCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigShowCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config show command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_config_show_command(
    command: &CommandData,
) -> Result<Option<ConfigShowCommand>, ConfigShowCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path.as_slice() != ["show"]
    {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigShowCommandError::InvalidShape);
    }
    let serenity::model::application::CommandDataOptionValue::SubCommand(options) =
        &command.options[0].value
    else {
        return Err(ConfigShowCommandError::InvalidShape);
    };
    if !options.is_empty() {
        return Err(ConfigShowCommandError::InvalidShape);
    }
    Ok(Some(ConfigShowCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_show_and_leaves_other_config_commands_unclaimed() {
        assert_eq!(
            parse_config_show_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}]}"#
            ))
            .expect("show"),
            Some(ConfigShowCommand)
        );
        assert_eq!(
            parse_config_show_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]}"#
            ))
            .expect("language"),
            None
        );
    }

    #[test]
    fn rejects_extra_show_options() {
        assert!(matches!(
            parse_config_show_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[{"name":"unexpected","type":3,"value":"x"}]}]}"#
            )),
            Err(ConfigShowCommandError::InvalidShape)
        ));
    }
}
