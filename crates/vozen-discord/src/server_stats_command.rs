//! Parser for the public `/server-stats` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ServerStatsCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ServerStatsCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("server-stats command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_server_stats_command(
    command: &CommandData,
) -> Result<Option<ServerStatsCommand>, ServerStatsCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "server-stats" || area != CommandArea::ServerConfig || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(ServerStatsCommandError::InvalidShape);
    }
    Ok(Some(ServerStatsCommand))
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
            parse_server_stats_command(&command(
                r#"{"id":"1","name":"server-stats","type":1,"options":[]}"#,
            ))
            .expect("server-stats"),
            Some(ServerStatsCommand)
        );
        assert_eq!(
            parse_server_stats_command(&command(
                r#"{"id":"1","name":"stats","type":1,"options":[]}"#,
            ))
            .expect("stats"),
            None
        );
    }
}
