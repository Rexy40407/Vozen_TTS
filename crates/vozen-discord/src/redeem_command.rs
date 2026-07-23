//! Parser for the public `/redeem` gift-code command.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedeemCommand {
    pub code: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum RedeemCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("redeem command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_redeem_command(
    command: &CommandData,
) -> Result<Option<RedeemCommand>, RedeemCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "redeem" || area != CommandArea::Monetization || !path.is_empty() {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(RedeemCommandError::InvalidShape);
    }
    let CommandDataOptionValue::String(code) = &command.options[0].value else {
        return Err(RedeemCommandError::InvalidShape);
    };
    if code.trim().is_empty() {
        return Err(RedeemCommandError::InvalidShape);
    }
    Ok(Some(RedeemCommand {
        code: code.trim().to_uppercase(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_and_normalizes_the_code() {
        assert_eq!(
            parse_redeem_command(&command(
                r#"{"id":"1","name":"redeem","type":1,"options":[{"type":3,"name":"code","value":" vozen-abcd-2345 "}]}"#,
            ))
            .expect("redeem"),
            Some(RedeemCommand { code: "VOZEN-ABCD-2345".into() })
        );
    }

    #[test]
    fn rejects_missing_or_wrong_options() {
        assert!(matches!(
            parse_redeem_command(&command(
                r#"{"id":"1","name":"redeem","type":1,"options":[]}"#,
            )),
            Err(RedeemCommandError::InvalidShape)
        ));
    }
}
