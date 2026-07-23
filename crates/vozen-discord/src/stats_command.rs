//! Parser for the Manage Guild-only `/stats` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{command_path_from_options, command_routing::CommandArea, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatsCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum StatsCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("stats command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_stats_command(
    command: &CommandData,
) -> Result<Option<StatsCommand>, StatsCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "stats" || area != CommandArea::ServerConfig || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(StatsCommandError::InvalidShape);
    }
    Ok(Some(StatsCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_the_root_stats_command() {
        assert_eq!(
            parse_stats_command(&command(
                r#"{"id":"1","name":"stats","type":1,"options":[]}"#
            ))
            .expect("stats"),
            Some(StatsCommand)
        );
        assert_eq!(
            parse_stats_command(&command(
                r#"{"id":"1","name":"server-stats","type":1,"options":[]}"#
            ))
            .expect("server stats"),
            None
        );
    }

    #[test]
    fn rejects_forged_options() {
        assert!(matches!(
            parse_stats_command(&command(
                r#"{"id":"1","name":"stats","type":1,"options":[{"name":"x","type":3,"value":"y"}]}"#
            )),
            Err(StatsCommandError::InvalidShape)
        ));
    }
}
