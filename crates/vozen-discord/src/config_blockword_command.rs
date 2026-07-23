//! Strict parser for `/config block-word add/remove`.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigBlockwordAction {
    Add,
    Remove,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigBlockwordCommand {
    pub action: ConfigBlockwordAction,
    pub word: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigBlockwordCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config block-word command has an invalid option shape")]
    InvalidShape,
    #[error("config block-word command has an invalid word")]
    InvalidWord,
}

pub fn parse_config_blockword_command(
    command: &CommandData,
) -> Result<Option<ConfigBlockwordCommand>, ConfigBlockwordCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config"
        || area != CommandArea::ServerConfig
        || path.len() != 2
        || path[0] != "block-word"
    {
        return Ok(None);
    }
    let action = match path[1] {
        "add" => ConfigBlockwordAction::Add,
        "remove" => ConfigBlockwordAction::Remove,
        _ => return Ok(None),
    };
    if command.options.len() != 1 {
        return Err(ConfigBlockwordCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommandGroup(group) = &command.options[0].value else {
        return Err(ConfigBlockwordCommandError::InvalidShape);
    };
    if command.options[0].name != "block-word" || group.len() != 1 {
        return Err(ConfigBlockwordCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &group[0].value else {
        return Err(ConfigBlockwordCommandError::InvalidShape);
    };
    if group[0].name != path[1] || options.len() != 1 || options[0].name != "word" {
        return Err(ConfigBlockwordCommandError::InvalidShape);
    }
    let CommandDataOptionValue::String(word) = &options[0].value else {
        return Err(ConfigBlockwordCommandError::InvalidWord);
    };
    let word = word.trim();
    if word.is_empty() || word.chars().count() > 60 {
        return Err(ConfigBlockwordCommandError::InvalidWord);
    }
    Ok(Some(ConfigBlockwordCommand {
        action,
        word: word.to_owned(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }
    #[test]
    fn parses_add_remove_and_trims_the_word() {
        assert_eq!(parse_config_blockword_command(&command(r#"{"id":"1","name":"config","type":1,"options":[{"name":"block-word","type":2,"options":[{"name":"add","type":1,"options":[{"name":"word","type":3,"value":"  spam  "}]}]}]}"#)).expect("add"), Some(ConfigBlockwordCommand { action: ConfigBlockwordAction::Add, word: "spam".into() }));
        assert_eq!(parse_config_blockword_command(&command(r#"{"id":"1","name":"config","type":1,"options":[{"name":"block-word","type":2,"options":[{"name":"remove","type":1,"options":[{"name":"word","type":3,"value":"spam"}]}]}]}"#)).expect("remove"), Some(ConfigBlockwordCommand { action: ConfigBlockwordAction::Remove, word: "spam".into() }));
    }
    #[test]
    fn rejects_empty_long_or_wrongly_typed_words() {
        assert!(matches!(
            parse_config_blockword_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"block-word","type":2,"options":[{"name":"add","type":1,"options":[{"name":"word","type":3,"value":"  "}]}]}]}"#
            )),
            Err(ConfigBlockwordCommandError::InvalidWord)
        ));
        assert!(matches!(
            parse_config_blockword_command(&command(
                r#"{"id":"1","name":"config","type":2,"options":[]}"#
            )),
            Err(ConfigBlockwordCommandError::Contract(_))
        ));
    }
}
