//! Parser for the personal `/birthday` command.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BirthdayCommand {
    Set { day: i64, month: i64 },
    Clear,
    Show,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum BirthdayCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("birthday command has an invalid option shape")]
    InvalidShape,
}

pub fn parse_birthday_command(
    command: &CommandData,
) -> Result<Option<BirthdayCommand>, BirthdayCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "birthday" || area != CommandArea::Personal {
        return Ok(None);
    }
    let Some(subcommand) = command.options.first() else {
        return Err(BirthdayCommandError::InvalidShape);
    };
    let CommandDataOptionValue::SubCommand(options) = &subcommand.value else {
        return Err(BirthdayCommandError::InvalidShape);
    };
    match subcommand.name.as_str() {
        "set" => {
            if options.len() != 2 {
                return Err(BirthdayCommandError::InvalidShape);
            }
            let mut day = None;
            let mut month = None;
            for option in options {
                match (option.name.as_str(), &option.value) {
                    ("day", CommandDataOptionValue::Integer(value)) => day = Some(*value),
                    ("month", CommandDataOptionValue::Integer(value)) => month = Some(*value),
                    _ => return Err(BirthdayCommandError::InvalidShape),
                }
            }
            Ok(Some(BirthdayCommand::Set {
                day: day.ok_or(BirthdayCommandError::InvalidShape)?,
                month: month.ok_or(BirthdayCommandError::InvalidShape)?,
            }))
        }
        "clear" if options.is_empty() => Ok(Some(BirthdayCommand::Clear)),
        "show" if options.is_empty() => Ok(Some(BirthdayCommand::Show)),
        _ => Err(BirthdayCommandError::InvalidShape),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_all_birthday_leaves() {
        assert_eq!(
            parse_birthday_command(&command(
                r#"{"id":"1","name":"birthday","type":1,"options":[{"type":1,"name":"set","options":[{"type":4,"name":"day","value":29},{"type":4,"name":"month","value":2}]}]}"#,
            ))
            .expect("set"),
            Some(BirthdayCommand::Set { day: 29, month: 2 })
        );
        assert_eq!(
            parse_birthday_command(&command(
                r#"{"id":"1","name":"birthday","type":1,"options":[{"type":1,"name":"clear","options":[]}]}"#,
            ))
            .expect("clear"),
            Some(BirthdayCommand::Clear)
        );
        assert_eq!(
            parse_birthday_command(&command(
                r#"{"id":"1","name":"birthday","type":1,"options":[{"type":1,"name":"show","options":[]}]}"#,
            ))
            .expect("show"),
            Some(BirthdayCommand::Show)
        );
    }

    #[test]
    fn rejects_wrong_shapes_and_other_roots() {
        assert!(matches!(
            parse_birthday_command(&command(
                r#"{"id":"1","name":"birthday","type":1,"options":[{"type":1,"name":"set","options":[{"type":4,"name":"day","value":1}]}]}"#,
            )),
            Err(BirthdayCommandError::InvalidShape)
        ));
        assert_eq!(
            parse_birthday_command(&command(
                r#"{"id":"1","name":"joke","type":1,"options":[]}"#,
            ))
            .expect("joke"),
            None
        );
    }
}
