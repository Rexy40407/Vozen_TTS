//! Strict parser for the mutating `/config reset` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigResetCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigResetCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config reset command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_config_reset_command(
    command: &CommandData,
) -> Result<Option<ConfigResetCommand>, ConfigResetCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path.as_slice() != ["reset"]
    {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigResetCommandError::InvalidShape);
    }
    let serenity::model::application::CommandDataOptionValue::SubCommand(options) =
        &command.options[0].value
    else {
        return Err(ConfigResetCommandError::InvalidShape);
    };
    if !options.is_empty() {
        return Err(ConfigResetCommandError::InvalidShape);
    }
    Ok(Some(ConfigResetCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_reset_and_leaves_show_unclaimed() {
        assert_eq!(
            parse_config_reset_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"reset","type":1,"options":[]}]}"#
            ))
            .expect("reset"),
            Some(ConfigResetCommand)
        );
        assert_eq!(
            parse_config_reset_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}]}"#
            ))
            .expect("show"),
            None
        );
    }

    #[test]
    fn rejects_extra_reset_options() {
        assert!(matches!(
            parse_config_reset_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"reset","type":1,"options":[{"name":"unexpected","type":3,"value":"x"}]}]}"#
            )),
            Err(ConfigResetCommandError::InvalidShape)
        ));
    }
}
