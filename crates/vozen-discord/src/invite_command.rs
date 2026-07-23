//! Parser for the public `/invite` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InviteCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum InviteCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("invite command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_invite_command(
    command: &CommandData,
) -> Result<Option<InviteCommand>, InviteCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "invite" || area != CommandArea::Discovery || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(InviteCommandError::InvalidShape);
    }
    Ok(Some(InviteCommand))
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
            parse_invite_command(&command(
                r#"{"id":"1","name":"invite","type":1,"options":[]}"#
            ))
            .expect("invite"),
            Some(InviteCommand)
        );
        assert_eq!(
            parse_invite_command(&command(
                r#"{"id":"1","name":"vote","type":1,"options":[]}"#
            ))
            .expect("vote"),
            None
        );
    }
}
