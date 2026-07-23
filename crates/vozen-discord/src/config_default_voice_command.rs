//! Strict parser for the promoted `/config default-voice` leaf.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigDefaultVoiceCommand {
    pub model: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigDefaultVoiceCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config default voice command has an invalid option shape")]
    InvalidShape,
    #[error("config default voice command has an invalid model type")]
    InvalidModel,
}

pub fn parse_config_default_voice_command(
    command: &CommandData,
) -> Result<Option<ConfigDefaultVoiceCommand>, ConfigDefaultVoiceCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path != ["default-voice"] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigDefaultVoiceCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigDefaultVoiceCommandError::InvalidShape);
    };
    if command.options[0].name != "default-voice" || options.len() != 1 {
        return Err(ConfigDefaultVoiceCommandError::InvalidShape);
    }
    let option = &options[0];
    if option.name != "model" {
        return Err(ConfigDefaultVoiceCommandError::InvalidShape);
    }
    let CommandDataOptionValue::String(model) = &option.value else {
        return Err(ConfigDefaultVoiceCommandError::InvalidModel);
    };
    if model.trim().is_empty() {
        return Err(ConfigDefaultVoiceCommandError::InvalidModel);
    }
    Ok(Some(ConfigDefaultVoiceCommand {
        model: model.clone(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_model_and_leaves_other_config_paths_unclaimed() {
        assert_eq!(
            parse_config_default_voice_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"default-voice","type":1,"options":[{"name":"model","type":3,"value":"en_US-amy-medium"}]}]}"#
            )).expect("default voice"),
            Some(ConfigDefaultVoiceCommand { model: "en_US-amy-medium".into() })
        );
        assert_eq!(
            parse_config_default_voice_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}] }"#
            )).expect("voice"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_wrongly_typed_models() {
        assert!(matches!(
            parse_config_default_voice_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"default-voice","type":1,"options":[{"name":"model","type":4,"value":1}]}]}"#
            )),
            Err(ConfigDefaultVoiceCommandError::InvalidModel)
        ));
        assert!(matches!(
            parse_config_default_voice_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"default-voice","type":1,"options":[{"name":"model","type":3,"value":"   "}]}]}"#
            )),
            Err(ConfigDefaultVoiceCommandError::InvalidModel)
        ));
    }
}
