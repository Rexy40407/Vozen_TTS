//! Parser for the public `/top-speakers` command.

use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TopSpeakersCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TopSpeakersCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("top-speakers command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_top_speakers_command(
    command: &CommandData,
) -> Result<Option<TopSpeakersCommand>, TopSpeakersCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "top-speakers" || area != CommandArea::ServerConfig || !path.is_empty() {
        return Ok(None);
    }
    if !command.options.is_empty() {
        return Err(TopSpeakersCommandError::InvalidShape);
    }
    Ok(Some(TopSpeakersCommand))
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
            parse_top_speakers_command(&command(
                r#"{"id":"1","name":"top-speakers","type":1,"options":[]}"#,
            ))
            .expect("top-speakers"),
            Some(TopSpeakersCommand)
        );
        assert_eq!(
            parse_top_speakers_command(&command(
                r#"{"id":"1","name":"server-stats","type":1,"options":[]}"#,
            ))
            .expect("server-stats"),
            None
        );
    }
}
