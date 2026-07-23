//! Strict parser for `/config greet-language`.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigGreetLanguageCommand {
    pub locale: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigGreetLanguageCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config greet language command has an invalid option shape")]
    InvalidShape,
    #[error("config greet language command has an invalid locale")]
    InvalidLocale,
}

pub fn parse_config_greet_language_command(
    command: &CommandData,
) -> Result<Option<ConfigGreetLanguageCommand>, ConfigGreetLanguageCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path != ["greet-language"] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigGreetLanguageCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigGreetLanguageCommandError::InvalidShape);
    };
    if command.options[0].name != "greet-language" || options.len() != 1 {
        return Err(ConfigGreetLanguageCommandError::InvalidShape);
    }
    let option = &options[0];
    if option.name != "language" {
        return Err(ConfigGreetLanguageCommandError::InvalidShape);
    }
    let CommandDataOptionValue::String(locale) = &option.value else {
        return Err(ConfigGreetLanguageCommandError::InvalidLocale);
    };
    if locale.trim().is_empty() {
        return Err(ConfigGreetLanguageCommandError::InvalidLocale);
    }
    Ok(Some(ConfigGreetLanguageCommand {
        locale: locale.clone(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_locale_and_leaves_other_config_paths_unclaimed() {
        assert_eq!(
            parse_config_greet_language_command(&command(r#"{"id":"1","name":"config","type":1,"options":[{"name":"greet-language","type":1,"options":[{"name":"language","type":3,"value":"pt"}]}]}"#)).expect("greet"),
            Some(ConfigGreetLanguageCommand { locale: "pt".into() })
        );
        assert_eq!(
            parse_config_greet_language_command(&command(r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}]}"#)).expect("show"),
            None
        );
    }

    #[test]
    fn rejects_wrong_or_blank_locale_values() {
        assert!(matches!(
            parse_config_greet_language_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"greet-language","type":1,"options":[{"name":"language","type":4,"value":1}]}]}"#
            )),
            Err(ConfigGreetLanguageCommandError::InvalidLocale)
        ));
        assert!(matches!(
            parse_config_greet_language_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"greet-language","type":1,"options":[{"name":"language","type":3,"value":" "}]}]}"#
            )),
            Err(ConfigGreetLanguageCommandError::InvalidLocale)
        ));
    }
}
