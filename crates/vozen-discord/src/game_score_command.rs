//! Parser for the read-only `/game leaderboard` and `/game stats` leaves.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GameScoreCommand {
    Leaderboard,
    Stats,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GameScoreCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("game score command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_game_score_command(
    command: &CommandData,
) -> Result<Option<GameScoreCommand>, GameScoreCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "game" || area != CommandArea::Games {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(GameScoreCommandError::InvalidShape);
    }
    let result = match path.as_slice() {
        ["leaderboard"] => GameScoreCommand::Leaderboard,
        ["stats"] => GameScoreCommand::Stats,
        _ => return Ok(None),
    };
    Ok(Some(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_read_only_score_leaves() {
        let leaderboard = parse_game_score_command(&command(
            r#"{"id":"1","name":"game","type":1,"options":[{"name":"leaderboard","type":1,"options":[]}] }"#,
        ))
        .expect("leaderboard");
        assert_eq!(leaderboard, Some(GameScoreCommand::Leaderboard));
        let stats = parse_game_score_command(&command(
            r#"{"id":"1","name":"game","type":1,"options":[{"name":"stats","type":1,"options":[]}] }"#,
        ))
        .expect("stats");
        assert_eq!(stats, Some(GameScoreCommand::Stats));
        assert_eq!(
            parse_game_score_command(&command(
                r#"{"id":"1","name":"game","type":1,"options":[{"name":"play","type":1,"options":[]}] }"#,
            ))
            .expect("play"),
            None
        );
    }
}
