//! Strict parsing for the personal and server pronunciation commands.
//!
//! The Discord contract deliberately permits `add` without its two strings: Node opens a modal
//! in that case. Rust preserves that decision as [`PronunciationCommand::OpenAddForm`] instead
//! of treating a beginner-friendly interaction as malformed input.

use serenity::model::application::{CommandData, CommandDataOption, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PronunciationScope {
    Personal,
    Server,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PronunciationCommand {
    List {
        scope: PronunciationScope,
    },
    OpenAddForm {
        scope: PronunciationScope,
    },
    Add {
        scope: PronunciationScope,
        term: String,
        replacement: String,
    },
    Remove {
        scope: PronunciationScope,
        term: String,
    },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PronunciationCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the pronunciation command is missing its subcommand")]
    MissingSubcommand,
    #[error("the pronunciation command contains an undeclared option")]
    UnexpectedOption,
    #[error("the pronunciation command is missing its required option")]
    MissingOption,
    #[error("the pronunciation command option has an invalid type")]
    InvalidOption,
}

/// Parses only the two pronunciation roots. Other command areas remain with their current
/// adapters during the staged migration.
pub fn parse_pronunciation_command(
    command: &CommandData,
) -> Result<Option<PronunciationCommand>, PronunciationCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    let scope = match (&command.name[..], area) {
        ("pronunciation", CommandArea::Personal) => PronunciationScope::Personal,
        ("server-pronunciation", CommandArea::ServerConfig) => PronunciationScope::Server,
        _ => return Ok(None),
    };
    let (name, options) = subcommand(&command.options)?;
    match name {
        "list" => empty(options).map(|()| Some(PronunciationCommand::List { scope })),
        "add" => parse_add(scope, options).map(Some),
        "remove" => parse_remove(scope, options).map(Some),
        _ => Err(PronunciationCommandError::UnexpectedOption),
    }
}

fn subcommand(
    options: &[CommandDataOption],
) -> Result<(&str, &[CommandDataOption]), PronunciationCommandError> {
    if options.len() != 1 {
        return Err(PronunciationCommandError::MissingSubcommand);
    }
    match &options[0].value {
        CommandDataOptionValue::SubCommand(nested) => Ok((&options[0].name, nested)),
        _ => Err(PronunciationCommandError::MissingSubcommand),
    }
}

fn empty(options: &[CommandDataOption]) -> Result<(), PronunciationCommandError> {
    options
        .is_empty()
        .then_some(())
        .ok_or(PronunciationCommandError::UnexpectedOption)
}

fn parse_add(
    scope: PronunciationScope,
    options: &[CommandDataOption],
) -> Result<PronunciationCommand, PronunciationCommandError> {
    if options.len() > 2
        || options
            .iter()
            .any(|option| option.name != "term" && option.name != "say")
    {
        return Err(PronunciationCommandError::UnexpectedOption);
    }
    let term = string_option(options, "term")?;
    let replacement = string_option(options, "say")?;
    match (term, replacement) {
        (Some(term), Some(replacement)) => Ok(PronunciationCommand::Add {
            scope,
            term,
            replacement,
        }),
        // This matches Node's existing form fallback even when Discord sends just one optional
        // value. The untrusted partial value is intentionally not carried into a future modal.
        _ => Ok(PronunciationCommand::OpenAddForm { scope }),
    }
}

fn parse_remove(
    scope: PronunciationScope,
    options: &[CommandDataOption],
) -> Result<PronunciationCommand, PronunciationCommandError> {
    if options.len() != 1 || options[0].name != "term" {
        return Err(PronunciationCommandError::UnexpectedOption);
    }
    let CommandDataOptionValue::String(term) = &options[0].value else {
        return Err(PronunciationCommandError::InvalidOption);
    };
    Ok(PronunciationCommand::Remove {
        scope,
        term: term.trim().to_owned(),
    })
}

fn string_option(
    options: &[CommandDataOption],
    name: &str,
) -> Result<Option<String>, PronunciationCommandError> {
    let values = options
        .iter()
        .filter(|option| option.name == name)
        .collect::<Vec<_>>();
    if values.len() > 1 {
        return Err(PronunciationCommandError::UnexpectedOption);
    }
    let Some(option) = values.first() else {
        return Ok(None);
    };
    let CommandDataOptionValue::String(value) = &option.value else {
        return Err(PronunciationCommandError::InvalidOption);
    };
    Ok(Some(value.trim().to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_personal_and_server_leaves_without_taking_other_commands() {
        assert_eq!(
            parse_pronunciation_command(&command(r#"{"id":"1","name":"pronunciation","type":1,"options":[{"name":"add","type":1,"options":[{"name":"term","type":3,"value":"gg"},{"name":"say","type":3,"value":"good game"}]}]}"#))
                .expect("personal add"),
            Some(PronunciationCommand::Add {
                scope: PronunciationScope::Personal,
                term: "gg".into(),
                replacement: "good game".into(),
            })
        );
        assert_eq!(
            parse_pronunciation_command(&command(r#"{"id":"1","name":"server-pronunciation","type":1,"options":[{"name":"remove","type":1,"options":[{"name":"term","type":3,"value":"Vozen"}]}]}"#))
                .expect("server remove"),
            Some(PronunciationCommand::Remove {
                scope: PronunciationScope::Server,
                term: "Vozen".into(),
            })
        );
        assert_eq!(
            parse_pronunciation_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"list","type":1,"options":[]}]}"#))
                .expect("other command"),
            None
        );
    }

    #[test]
    fn add_without_both_strings_preserves_the_existing_modal_fallback() {
        for options in ["[]", r#"[{"name":"term","type":3,"value":"gg"}]"#] {
            let payload = format!(
                r#"{{"id":"1","name":"pronunciation","type":1,"options":[{{"name":"add","type":1,"options":{options}}}]}}"#
            );
            assert_eq!(
                parse_pronunciation_command(&command(&payload)).expect("add form"),
                Some(PronunciationCommand::OpenAddForm {
                    scope: PronunciationScope::Personal,
                })
            );
        }
    }

    #[test]
    fn rejects_forged_options_and_wrong_value_types() {
        assert_eq!(
            parse_pronunciation_command(&command(
                r#"{"id":"1","name":"pronunciation","type":1,"options":[{"name":"remove","type":1,"options":[]}]}"#
            )),
            Err(PronunciationCommandError::UnexpectedOption)
        );
        assert_eq!(
            parse_pronunciation_command(&command(
                r#"{"id":"1","name":"pronunciation","type":1,"options":[{"name":"add","type":1,"options":[{"name":"term","type":4,"value":1}]}]}"#
            )),
            Err(PronunciationCommandError::InvalidOption)
        );
    }
}
