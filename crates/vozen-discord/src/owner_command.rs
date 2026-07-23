//! Strict parsers for the two owner-only monetization commands.
//!
//! Registration visibility is not an authorization boundary. The runtime sink performs the
//! owner and control-guild checks; this module only validates the typed Discord payload and keeps
//! unknown or forged options from reaching SQLite.

use serenity::model::application::{CommandData, CommandDataOption, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

const MIN_DAYS: i64 = 1;
const MAX_DAYS: i64 = 3650;
const MIN_SEATS: i64 = 1;
const MAX_SEATS: i64 = 50;
const MIN_AMOUNT: i64 = 1;
const MAX_AMOUNT: i64 = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OwnerPlan {
    Premium,
    Plus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OwnerCommand {
    Grant {
        user_id: u64,
        plan: OwnerPlan,
        days: i64,
        seats: i64,
    },
    GenerateCode {
        plan: OwnerPlan,
        days: i64,
        seats: i64,
        amount: i64,
        expires_days: Option<i64>,
    },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum OwnerCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("owner command has an invalid option shape")]
    InvalidShape,
    #[error("owner command has an invalid option value")]
    InvalidValue,
}

pub fn parse_owner_command(
    command: &CommandData,
) -> Result<Option<OwnerCommand>, OwnerCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    let expected_area = if command.name == "generate-code" {
        CommandArea::Monetization
    } else {
        CommandArea::Owner
    };
    if area != expected_area || !path.is_empty() {
        return Ok(None);
    }
    match command.name.as_str() {
        "vozen-grant" => parse_grant(&command.options).map(Some),
        "generate-code" => parse_generate_code(&command.options).map(Some),
        _ => Ok(None),
    }
}

fn parse_grant(options: &[CommandDataOption]) -> Result<OwnerCommand, OwnerCommandError> {
    ensure_unique_known_options(options, &["user", "plan", "days", "seats"])?;
    let user_id = match required_option(options, "user")?.value {
        CommandDataOptionValue::User(user_id) if user_id.get() != 0 => user_id.get(),
        _ => return Err(OwnerCommandError::InvalidValue),
    };
    let plan = parse_plan(required_string(options, "plan")?)?;
    let days = optional_integer(options, "days")?.unwrap_or(30);
    validate_range(days, MIN_DAYS, MAX_DAYS)?;
    let seats = optional_integer(options, "seats")?.unwrap_or(3);
    validate_range(seats, MIN_SEATS, MAX_SEATS)?;
    Ok(OwnerCommand::Grant {
        user_id,
        plan,
        days,
        seats: if plan == OwnerPlan::Plus { 0 } else { seats },
    })
}

fn parse_generate_code(options: &[CommandDataOption]) -> Result<OwnerCommand, OwnerCommandError> {
    ensure_unique_known_options(
        options,
        &["plan", "days", "seats", "amount", "expires-days"],
    )?;
    let plan = parse_plan(required_string(options, "plan")?)?;
    let days = optional_integer(options, "days")?.unwrap_or(30);
    validate_range(days, MIN_DAYS, MAX_DAYS)?;
    let seats = optional_integer(options, "seats")?.unwrap_or(3);
    validate_range(seats, MIN_SEATS, MAX_SEATS)?;
    let amount = optional_integer(options, "amount")?.unwrap_or(1);
    validate_range(amount, MIN_AMOUNT, MAX_AMOUNT)?;
    let expires_days = optional_integer(options, "expires-days")?;
    if let Some(value) = expires_days {
        validate_range(value, MIN_DAYS, MAX_DAYS)?;
    }
    Ok(OwnerCommand::GenerateCode {
        plan,
        days,
        seats: if plan == OwnerPlan::Plus { 0 } else { seats },
        amount,
        expires_days,
    })
}

fn parse_plan(value: &str) -> Result<OwnerPlan, OwnerCommandError> {
    match value {
        "premium" => Ok(OwnerPlan::Premium),
        "plus" => Ok(OwnerPlan::Plus),
        _ => Err(OwnerCommandError::InvalidValue),
    }
}

fn required_option<'a>(
    options: &'a [CommandDataOption],
    name: &str,
) -> Result<&'a CommandDataOption, OwnerCommandError> {
    options
        .iter()
        .find(|option| option.name == name)
        .ok_or(OwnerCommandError::InvalidShape)
}

fn required_string<'a>(
    options: &'a [CommandDataOption],
    name: &str,
) -> Result<&'a str, OwnerCommandError> {
    match &required_option(options, name)?.value {
        CommandDataOptionValue::String(value) if !value.is_empty() => Ok(value),
        _ => Err(OwnerCommandError::InvalidValue),
    }
}

fn optional_integer(
    options: &[CommandDataOption],
    name: &str,
) -> Result<Option<i64>, OwnerCommandError> {
    let Some(option) = options.iter().find(|option| option.name == name) else {
        return Ok(None);
    };
    match option.value {
        CommandDataOptionValue::Integer(value) => Ok(Some(value)),
        _ => Err(OwnerCommandError::InvalidValue),
    }
}

fn ensure_unique_known_options(
    options: &[CommandDataOption],
    allowed: &[&str],
) -> Result<(), OwnerCommandError> {
    for (index, option) in options.iter().enumerate() {
        if !allowed.contains(&option.name.as_str())
            || options[..index]
                .iter()
                .any(|previous| previous.name == option.name)
        {
            return Err(OwnerCommandError::InvalidShape);
        }
    }
    Ok(())
}

fn validate_range(value: i64, min: i64, max: i64) -> Result<(), OwnerCommandError> {
    (min..=max)
        .contains(&value)
        .then_some(())
        .ok_or(OwnerCommandError::InvalidValue)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_grant_defaults_and_plus_seat_normalisation() {
        assert_eq!(
            parse_owner_command(&command(
                r#"{"id":"1","name":"vozen-grant","type":1,"options":[{"type":6,"name":"user","value":"123456789012345678"},{"type":3,"name":"plan","value":"plus"}]}"#
            ))
            .expect("grant"),
            Some(OwnerCommand::Grant {
                user_id: 123456789012345678,
                plan: OwnerPlan::Plus,
                days: 30,
                seats: 0,
            })
        );
    }

    #[test]
    fn parses_code_defaults_and_expiry() {
        assert_eq!(
            parse_owner_command(&command(
                r#"{"id":"1","name":"generate-code","type":1,"options":[{"type":3,"name":"plan","value":"premium"},{"type":4,"name":"amount","value":2},{"type":4,"name":"expires-days","value":7}]}"#
            ))
            .expect("code"),
            Some(OwnerCommand::GenerateCode {
                plan: OwnerPlan::Premium,
                days: 30,
                seats: 3,
                amount: 2,
                expires_days: Some(7),
            })
        );
    }

    #[test]
    fn rejects_forged_unknown_duplicate_and_out_of_range_options() {
        assert!(matches!(
            parse_owner_command(&command(
                r#"{"id":"1","name":"generate-code","type":1,"options":[{"type":3,"name":"plan","value":"plus"},{"type":3,"name":"plan","value":"premium"}]}"#
            )),
            Err(OwnerCommandError::InvalidShape)
        ));
        assert!(matches!(
            parse_owner_command(&command(
                r#"{"id":"1","name":"generate-code","type":1,"options":[{"type":3,"name":"plan","value":"plus"},{"type":4,"name":"amount","value":21}]}"#
            )),
            Err(OwnerCommandError::InvalidValue)
        ));
        assert_eq!(
            parse_owner_command(&command(
                r#"{"id":"1","name":"redeem","type":1,"options":[]}"#
            ))
            .expect("other command"),
            None
        );
    }
}
