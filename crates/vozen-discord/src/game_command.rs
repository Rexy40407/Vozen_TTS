//! Strict parsing for the live `/game` leaves owned by the Rust adapter.
//!
//! Parsing them before the runtime promotion keeps forged nested options from reaching the
//! Rust game manager and gives the canary a stable boundary for play/stop.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GamePlayCommand {
    pub game: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GameStopCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GameCommandError {
    #[error("incoming game command does not match the registered contract: {0}")]
    Contract(#[from] ContractError),
    #[error("game command has an invalid option shape")]
    InvalidShape,
    #[error("game option is too long")]
    OptionTooLong,
    #[error("game option has an invalid type")]
    InvalidType,
    #[error("game command contains an unexpected option")]
    UnexpectedOption,
}

pub fn parse_game_play_command(
    command: &CommandData,
) -> Result<Option<GamePlayCommand>, GameCommandError> {
    let Some(options) = parse_game_subcommand(command, "play")? else {
        return Ok(None);
    };
    if !options.is_empty() {
        return Err(GameCommandError::UnexpectedOption);
    }
    Ok(Some(GamePlayCommand {
        game: None,
        language: None,
    }))
}

pub fn parse_game_stop_command(
    command: &CommandData,
) -> Result<Option<GameStopCommand>, GameCommandError> {
    let Some(options) = parse_game_subcommand(command, "stop")? else {
        return Ok(None);
    };
    if !options.is_empty() {
        return Err(GameCommandError::InvalidShape);
    }
    Ok(Some(GameStopCommand))
}

fn parse_game_subcommand<'a>(
    command: &'a CommandData,
    expected: &str,
) -> Result<Option<&'a [serenity::model::application::CommandDataOption]>, GameCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "game" || area != CommandArea::Games || path.as_slice() != [expected] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(GameCommandError::InvalidShape);
    }
    let option = &command.options[0];
    if option.name != expected {
        return Err(GameCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &option.value else {
        return Err(GameCommandError::InvalidShape);
    };
    Ok(Some(options.as_slice()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_empty_play_and_stop_without_values() {
        assert_eq!(
            parse_game_play_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"play","type":1,"options":[]}]}"#
            ))
            .expect("play"),
            Some(GamePlayCommand {
                game: None,
                language: None
            })
        );
        assert_eq!(
            parse_game_stop_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"stop","type":1,"options":[]}] }"#
            ))
            .expect("stop"),
            Some(GameStopCommand)
        );
    }

    #[test]
    fn rejects_forged_nested_options_and_leaves_other_game_leaves_unclaimed() {
        assert!(matches!(
            parse_game_play_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"play","type":1,"options":[{"name":"game","type":4,"value":1}]}]}"#
            )),
            Err(GameCommandError::UnexpectedOption)
        ));
        assert!(matches!(
            parse_game_stop_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"stop","type":1,"options":[{"name":"game","type":3,"value":"x"}]}]}"#
            )),
            Err(GameCommandError::InvalidShape)
        ));
        assert_eq!(
            parse_game_play_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"list","type":1,"options":[]}] }"#
            ))
            .expect("list"),
            None
        );
    }
}
