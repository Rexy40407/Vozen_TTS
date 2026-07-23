//! Strict parser for the promoted `/config tts-channel` leaf.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigChannelCommand {
    pub channel_id: u64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigChannelCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config channel command has an invalid option shape")]
    InvalidShape,
    #[error("config channel command has an invalid channel type")]
    InvalidChannel,
}

pub fn parse_config_channel_command(
    command: &CommandData,
) -> Result<Option<ConfigChannelCommand>, ConfigChannelCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path != ["tts-channel"] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigChannelCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigChannelCommandError::InvalidShape);
    };
    if command.options[0].name != "tts-channel" || options.len() != 1 {
        return Err(ConfigChannelCommandError::InvalidShape);
    }
    let option = &options[0];
    if option.name != "channel" {
        return Err(ConfigChannelCommandError::InvalidShape);
    }
    let CommandDataOptionValue::Channel(channel_id) = &option.value else {
        return Err(ConfigChannelCommandError::InvalidChannel);
    };
    let channel_id = channel_id.get();
    if channel_id == 0 {
        return Err(ConfigChannelCommandError::InvalidChannel);
    }
    Ok(Some(ConfigChannelCommand { channel_id }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_channel_and_leaves_other_config_paths_unclaimed() {
        assert_eq!(
            parse_config_channel_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"tts-channel","type":1,"options":[{"name":"channel","type":7,"value":"123"}]}]}"#
            )).expect("channel"),
            Some(ConfigChannelCommand { channel_id: 123 })
        );
        assert_eq!(
            parse_config_channel_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}] }"#
            )).expect("show"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_wrongly_typed_channels() {
        assert!(matches!(
            parse_config_channel_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"tts-channel","type":1,"options":[{"name":"channel","type":3,"value":"123"}]}]}"#
            )),
            Err(ConfigChannelCommandError::InvalidChannel)
        ));
        assert!(matches!(
            parse_config_channel_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"tts-channel","type":1,"options":[]}] }"#
            )),
            Err(ConfigChannelCommandError::InvalidShape)
        ));
    }
}
