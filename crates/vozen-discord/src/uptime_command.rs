//! Parser for the public `/uptime` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UptimeCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UptimeCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("uptime command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_uptime_command(
    command: &CommandData,
) -> Result<Option<UptimeCommand>, UptimeCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "uptime" || area != CommandArea::Discovery || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(UptimeCommandError::InvalidShape);
    }
    Ok(Some(UptimeCommand))
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
            parse_uptime_command(&command(
                r#"{"id":"1","name":"uptime","type":1,"options":[]}"#
            ))
            .expect("uptime"),
            Some(UptimeCommand)
        );
        assert_eq!(
            parse_uptime_command(&command(
                r#"{"id":"1","name":"help","type":1,"options":[]}"#
            ))
            .expect("help"),
            None
        );
    }
}
