//! Parser for the read-only `/game list` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GameListCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GameListCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("game list command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_game_list_command(
    command: &CommandData,
) -> Result<Option<GameListCommand>, GameListCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "game" || area != CommandArea::Games || path.as_slice() != ["list"] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(GameListCommandError::InvalidShape);
    }
    Ok(Some(GameListCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_game_list() {
        assert_eq!(
            parse_game_list_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"list","type":1,"options":[]}]}"#,
            ))
            .expect("game list"),
            Some(GameListCommand)
        );
        assert_eq!(
            parse_game_list_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"stop","type":1,"options":[]}]}"#,
            ))
            .expect("game stop"),
            None
        );
    }
}
