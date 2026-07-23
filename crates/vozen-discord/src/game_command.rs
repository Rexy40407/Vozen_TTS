//! Strict parsing for the live `/game` leaves that are not promoted yet.
//!
//! Parsing them before the runtime promotion keeps forged nested options from reaching the
//! future Rust game manager and gives the canary a stable boundary for play/stop.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

const MAX_GAME_OPTION_CHARS: usize = 100;

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
    parse_game_subcommand(command, "play")?
        .map(|options| {
            let mut game = None;
            let mut language = None;
            for option in options {
                let target = match option.name.as_str() {
                    "game" => &mut game,
                    "language" => &mut language,
                    _ => return Err(GameCommandError::UnexpectedOption),
                };
                let CommandDataOptionValue::String(value) = &option.value else {
                    return Err(GameCommandError::InvalidType);
                };
                if value.chars().count() > MAX_GAME_OPTION_CHARS {
                    return Err(GameCommandError::OptionTooLong);
                }
                if target.replace(value.trim().to_owned()).is_some() {
                    return Err(GameCommandError::UnexpectedOption);
                }
            }
            Ok(GamePlayCommand { game, language })
        })
        .transpose()
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
    fn parses_play_with_optional_values_and_stop_without_values() {
        assert_eq!(
            parse_game_play_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"play","type":1,"options":[{"name":"game","type":3,"value":"headsOrTails"},{"name":"language","type":3,"value":"pt"}]}]}"#
            ))
            .expect("play"),
            Some(GamePlayCommand {
                game: Some("headsOrTails".into()),
                language: Some("pt".into())
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
            Err(GameCommandError::InvalidType)
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
