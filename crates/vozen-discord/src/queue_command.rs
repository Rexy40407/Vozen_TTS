//! Strict parsing for the existing privacy-safe `/queue` command.
//!
//! The parser is deliberately independent from Songbird. A gateway adapter can only promote the
//! command after the playback implementation can provide the same opaque snapshot and controls.

use serenity::model::application::{CommandData, CommandDataOption, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QueueCommand {
    Show,
    Remove { id: String },
    Clear,
    Skip,
    Pause,
    Resume,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum QueueCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the queue command is missing its subcommand")]
    MissingSubcommand,
    #[error("the queue command contains an undeclared option")]
    UnexpectedOption,
    #[error("queue remove is missing its opaque item id")]
    MissingId,
    #[error("queue remove has a non-string item id")]
    InvalidId,
}

/// Parses only the public `/queue` root after validating the versioned Discord contract. Any
/// other command remains untouched, so this parser is safe to install beside the Node gateway.
pub fn parse_queue_command(
    command: &CommandData,
) -> Result<Option<QueueCommand>, QueueCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::Queue {
        return Ok(None);
    }
    let (name, options) = subcommand(&command.options)?;
    match name {
        "show" => empty_subcommand(options).map(|()| Some(QueueCommand::Show)),
        "clear" => empty_subcommand(options).map(|()| Some(QueueCommand::Clear)),
        "skip" => empty_subcommand(options).map(|()| Some(QueueCommand::Skip)),
        "pause" => empty_subcommand(options).map(|()| Some(QueueCommand::Pause)),
        "resume" => empty_subcommand(options).map(|()| Some(QueueCommand::Resume)),
        "remove" => {
            if options.is_empty() {
                return Err(QueueCommandError::MissingId);
            }
            if options.len() != 1 || options[0].name != "id" {
                return Err(QueueCommandError::UnexpectedOption);
            }
            match &options[0].value {
                CommandDataOptionValue::String(id) if !id.trim().is_empty() => {
                    Ok(Some(QueueCommand::Remove { id: id.clone() }))
                }
                CommandDataOptionValue::String(_) => Err(QueueCommandError::MissingId),
                _ => Err(QueueCommandError::InvalidId),
            }
        }
        _ => Err(QueueCommandError::UnexpectedOption),
    }
}

fn subcommand(
    options: &[CommandDataOption],
) -> Result<(&str, &[CommandDataOption]), QueueCommandError> {
    if options.len() != 1 {
        return Err(QueueCommandError::MissingSubcommand);
    }
    match &options[0].value {
        CommandDataOptionValue::SubCommand(nested) => Ok((&options[0].name, nested)),
        _ => Err(QueueCommandError::MissingSubcommand),
    }
}

fn empty_subcommand(options: &[CommandDataOption]) -> Result<(), QueueCommandError> {
    options
        .is_empty()
        .then_some(())
        .ok_or(QueueCommandError::UnexpectedOption)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_every_existing_queue_leaf_after_contract_validation() {
        assert_eq!(
            parse_queue_command(&command(r#"{"id":"1","name":"queue","type":1,"options":[{"name":"show","type":1,"options":[]}]}"#))
                .expect("show"),
            Some(QueueCommand::Show)
        );
        assert_eq!(
            parse_queue_command(&command(r#"{"id":"1","name":"queue","type":1,"options":[{"name":"remove","type":1,"options":[{"name":"id","type":3,"value":"opaque-id"}]}]}"#))
                .expect("remove"),
            Some(QueueCommand::Remove {
                id: "opaque-id".into()
            })
        );
        for leaf in ["clear", "skip", "pause", "resume"] {
            let payload = format!(
                r#"{{"id":"1","name":"queue","type":1,"options":[{{"name":"{leaf}","type":1,"options":[]}}]}}"#
            );
            assert!(
                parse_queue_command(&command(&payload))
                    .expect("queue leaf")
                    .is_some()
            );
        }
    }

    #[test]
    fn rejects_forged_or_incomplete_queue_options() {
        assert_eq!(
            parse_queue_command(&command(
                r#"{"id":"1","name":"queue","type":1,"options":[]}"#
            )),
            Err(QueueCommandError::MissingSubcommand)
        );
        assert_eq!(
            parse_queue_command(&command(
                r#"{"id":"1","name":"queue","type":1,"options":[{"name":"remove","type":1,"options":[]}]}"#
            )),
            Err(QueueCommandError::MissingId)
        );
        assert_eq!(
            parse_queue_command(&command(
                r#"{"id":"1","name":"queue","type":1,"options":[{"name":"remove","type":1,"options":[{"name":"id","type":4,"value":1}]}]}"#
            )),
            Err(QueueCommandError::InvalidId)
        );
    }
}
