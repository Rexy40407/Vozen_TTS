//! Parser for the public `/bot-stats` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BotStatsCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum BotStatsCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("bot-stats command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_bot_stats_command(
    command: &CommandData,
) -> Result<Option<BotStatsCommand>, BotStatsCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "bot-stats" || area != CommandArea::Discovery || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(BotStatsCommandError::InvalidShape);
    }
    Ok(Some(BotStatsCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_the_public_root_command() {
        assert_eq!(
            parse_bot_stats_command(&command(
                r#"{"id":"1","name":"bot-stats","type":1,"options":[]}"#
            ))
            .expect("bot stats"),
            Some(BotStatsCommand)
        );
        assert_eq!(
            parse_bot_stats_command(&command(
                r#"{"id":"1","name":"stats","type":1,"options":[]}"#
            ))
            .expect("stats"),
            None
        );
    }
}
