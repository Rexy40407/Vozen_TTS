//! Strict parser for numeric `/config` limits.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigNumericSetting {
    MaxChars,
    RateLimit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigNumericCommand {
    pub setting: ConfigNumericSetting,
    pub value: i64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigNumericCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config numeric command has an invalid option shape")]
    InvalidShape,
    #[error("config numeric command has an invalid integer type")]
    InvalidInteger,
}

pub fn parse_config_numeric_command(
    command: &CommandData,
) -> Result<Option<ConfigNumericCommand>, ConfigNumericCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path.len() != 1 {
        return Ok(None);
    }
    let setting = match path[0] {
        "max-chars" => ConfigNumericSetting::MaxChars,
        "rate-limit" => ConfigNumericSetting::RateLimit,
        _ => return Ok(None),
    };
    if command.options.len() != 1 {
        return Err(ConfigNumericCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigNumericCommandError::InvalidShape);
    };
    if options.len() != 1 || options[0].name != "value" {
        return Err(ConfigNumericCommandError::InvalidShape);
    }
    let CommandDataOptionValue::Integer(value) = options[0].value else {
        return Err(ConfigNumericCommandError::InvalidInteger);
    };
    Ok(Some(ConfigNumericCommand { setting, value }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_limits_and_leaves_other_config_commands_unclaimed() {
        assert_eq!(
            parse_config_numeric_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"max-chars","type":1,"options":[{"name":"value","type":4,"value":500}]}]}"#
            )).expect("max chars"),
            Some(ConfigNumericCommand { setting: ConfigNumericSetting::MaxChars, value: 500 })
        );
        assert_eq!(
            parse_config_numeric_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]}"#
            )).expect("language"),
            None
        );
    }

    #[test]
    fn rejects_wrong_option_types() {
        assert!(matches!(
            parse_config_numeric_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"rate-limit","type":1,"options":[{"name":"value","type":3,"value":"8"}]}]}"#
            )),
            Err(ConfigNumericCommandError::InvalidInteger)
        ));
    }
}
