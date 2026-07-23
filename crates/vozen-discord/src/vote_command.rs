//! Parser for the public `/vote` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VoteCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum VoteCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("vote command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_vote_command(command: &CommandData) -> Result<Option<VoteCommand>, VoteCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "vote" || area != CommandArea::Discovery || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(VoteCommandError::InvalidShape);
    }
    Ok(Some(VoteCommand))
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
            parse_vote_command(&command(
                r#"{"id":"1","name":"vote","type":1,"options":[]}"#
            ))
            .expect("vote"),
            Some(VoteCommand)
        );
        assert_eq!(
            parse_vote_command(&command(
                r#"{"id":"1","name":"help","type":1,"options":[]}"#
            ))
            .expect("help"),
            None
        );
    }
}
