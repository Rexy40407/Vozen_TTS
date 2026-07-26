//! Strict parser for the boolean `/config` leaves promoted independently from the full panel.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigToggle {
    AutoRead,
    Enabled,
    Xsaid,
    AutoJoin,
    ReadBots,
    TextInVoice,
    AntiSpam,
    Streaks,
    Soundboard,
    VoteReminders,
    Greet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigToggleCommand {
    pub toggle: ConfigToggle,
    pub enabled: bool,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigToggleCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config toggle command has an invalid option shape")]
    InvalidShape,
    #[error("config toggle command has an invalid boolean type")]
    InvalidBoolean,
}

pub fn parse_config_toggle_command(
    command: &CommandData,
) -> Result<Option<ConfigToggleCommand>, ConfigToggleCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path.len() != 1 {
        return Ok(None);
    }
    let toggle = match path[0] {
        "auto-read" => ConfigToggle::AutoRead,
        "enabled" => ConfigToggle::Enabled,
        "x-said" => ConfigToggle::Xsaid,
        "auto-join" => ConfigToggle::AutoJoin,
        "read-bots" => ConfigToggle::ReadBots,
        "text-in-voice" => ConfigToggle::TextInVoice,
        "anti-spam" => ConfigToggle::AntiSpam,
        "streaks" => ConfigToggle::Streaks,
        "soundboard" => ConfigToggle::Soundboard,
        "vote-reminders" => ConfigToggle::VoteReminders,
        "greet" => ConfigToggle::Greet,
        _ => return Ok(None),
    };
    if command.options.len() != 1 {
        return Err(ConfigToggleCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigToggleCommandError::InvalidShape);
    };
    if options.len() != 1 || options[0].name != "active" {
        return Err(ConfigToggleCommandError::InvalidShape);
    }
    let CommandDataOptionValue::Boolean(enabled) = options[0].value else {
        return Err(ConfigToggleCommandError::InvalidBoolean);
    };
    Ok(Some(ConfigToggleCommand { toggle, enabled }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_each_promoted_toggle_and_leaves_other_config_paths_unclaimed() {
        let parsed = parse_config_toggle_command(&command(
            r#"{"id":"1","name":"config","type":1,"options":[{"name":"auto-read","type":1,"options":[{"name":"active","type":5,"value":true}]}]}"#
        )).expect("toggle");
        assert_eq!(
            parsed,
            Some(ConfigToggleCommand {
                toggle: ConfigToggle::AutoRead,
                enabled: true
            })
        );
        assert_eq!(
            parse_config_toggle_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"max-chars","type":1,"options":[{"name":"value","type":4,"value":300}]}]}"#
            )).expect("max chars"),
            None
        );
    }

    #[test]
    fn rejects_forged_boolean_payloads() {
        assert!(matches!(
            parse_config_toggle_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"enabled","type":1,"options":[{"name":"active","type":3,"value":"true"}]}]}"#
            )),
            Err(ConfigToggleCommandError::InvalidBoolean)
        ));
    }
}
