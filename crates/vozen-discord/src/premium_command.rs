//! Parser for the read-only public `/premium info` command.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PremiumInfoCommand;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PremiumCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("premium info command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_premium_info_command(
    command: &CommandData,
) -> Result<Option<PremiumInfoCommand>, PremiumCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "premium" || area != CommandArea::Monetization || path != ["info"] {
        return Ok(None);
    }
    if command.options.len() != 1
        || !matches!(
            &command.options[0].value,
            CommandDataOptionValue::SubCommand(options) if options.is_empty()
        )
    {
        return Err(PremiumCommandError::InvalidShape);
    }
    Ok(Some(PremiumInfoCommand))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_only_info() {
        assert_eq!(
            parse_premium_info_command(&command(
                r#"{"id":"1","name":"premium","type":1,"options":[{"type":1,"name":"info","options":[]}] }"#,
            ))
            .expect("info"),
            Some(PremiumInfoCommand)
        );
        assert_eq!(
            parse_premium_info_command(&command(
                r#"{"id":"1","name":"premium","type":1,"options":[{"type":1,"name":"activate","options":[]}] }"#,
            ))
            .expect("activate"),
            None
        );
    }
}
