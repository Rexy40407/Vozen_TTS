//! Strict parser for the promoted `/config language` leaf.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigLanguageCommand {
    pub locale: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigLanguageCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config language command has an invalid option shape")]
    InvalidShape,
    #[error("config language command has an invalid locale type")]
    InvalidLocale,
}

pub fn parse_config_language_command(
    command: &CommandData,
) -> Result<Option<ConfigLanguageCommand>, ConfigLanguageCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path != ["language"] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigLanguageCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigLanguageCommandError::InvalidShape);
    };
    if command.options[0].name != "language" || options.len() != 1 {
        return Err(ConfigLanguageCommandError::InvalidShape);
    }
    let option = &options[0];
    if option.name != "locale" {
        return Err(ConfigLanguageCommandError::InvalidShape);
    }
    let CommandDataOptionValue::String(locale) = &option.value else {
        return Err(ConfigLanguageCommandError::InvalidLocale);
    };
    Ok(Some(ConfigLanguageCommand {
        locale: locale.trim().to_owned(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_the_language_leaf_and_keeps_other_config_commands_node_owned() {
        assert_eq!(
            parse_config_language_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]}"#
            )).expect("language"),
            Some(ConfigLanguageCommand { locale: "pt".into() })
        );
        assert_eq!(
            parse_config_language_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}]}"#
            )).expect("show"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_wrongly_typed_locale_options() {
        assert!(matches!(
            parse_config_language_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[]}] }"#
            )),
            Err(ConfigLanguageCommandError::InvalidShape)
        ));
        assert!(matches!(
            parse_config_language_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":4,"value":1}]}]}"#
            )),
            Err(ConfigLanguageCommandError::InvalidLocale)
        ));
    }
}
