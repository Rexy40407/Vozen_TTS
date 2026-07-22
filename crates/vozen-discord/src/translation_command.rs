//! Typed parsing for the private `/translate text` command slice.
//!
//! The root `/translate` also owns persistent preferences and server mapping administration.
//! This parser intentionally returns `None` for every one of those subcommands: a future Rust
//! gateway can promote private text translation without accidentally taking over configuration
//! or automatic message delivery from Node.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslateTextCommand {
    /// Kept only for the interaction lifetime. The translation service minimises and bounds it
    /// again before the provider boundary.
    pub text: String,
    pub target_locale: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranslateTextCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the private translation command is missing its required text option")]
    MissingText,
    #[error("the private translation command has a non-string text option")]
    InvalidText,
    #[error("the private translation command has a non-string locale option")]
    InvalidLocale,
    #[error("the private translation command contains an undeclared option")]
    UnexpectedOption,
}

/// Parses only the contract-valid `/translate text` leaf.
///
/// A different existing `/translate` subcommand returns `None`, while a forged command shape is
/// rejected before any response/defer side effect. This preserves Node ownership of every
/// unpromoted translation feature.
pub fn parse_translate_text_command(
    command: &CommandData,
) -> Result<Option<TranslateTextCommand>, TranslateTextCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::Translation
        || command.name != "translate"
        || path != ["text"]
    {
        return Ok(None);
    }
    let Some(subcommand) = command.options.iter().find(|option| option.name == "text") else {
        return Err(TranslateTextCommandError::MissingText);
    };
    let CommandDataOptionValue::SubCommand(options) = &subcommand.value else {
        return Err(TranslateTextCommandError::InvalidText);
    };
    if options
        .iter()
        .any(|option| option.name != "text" && option.name != "locale")
    {
        return Err(TranslateTextCommandError::UnexpectedOption);
    }
    let text = options
        .iter()
        .find(|option| option.name == "text")
        .map(|option| match &option.value {
            CommandDataOptionValue::String(value) => Ok(value.clone()),
            _ => Err(TranslateTextCommandError::InvalidText),
        })
        .unwrap_or(Err(TranslateTextCommandError::MissingText))?;
    let target_locale = options
        .iter()
        .find(|option| option.name == "locale")
        .map(|option| match &option.value {
            CommandDataOptionValue::String(value) => Ok(value.clone()),
            _ => Err(TranslateTextCommandError::InvalidLocale),
        })
        .transpose()?;
    Ok(Some(TranslateTextCommand {
        text,
        target_locale,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid Discord command payload")
    }

    #[test]
    fn accepts_only_the_private_text_leaf() {
        assert_eq!(
            parse_translate_text_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"text","type":1,"options":[{"name":"text","type":3,"value":"hello"},{"name":"locale","type":3,"value":"pt"}]}]}"#,
            ))
            .expect("translation text"),
            Some(TranslateTextCommand {
                text: "hello".into(),
                target_locale: Some("pt".into()),
            })
        );
        assert_eq!(
            parse_translate_text_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]}"#,
            ))
            .expect("unpromoted setting"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_incomplete_text_payloads_before_an_adapter_can_reply() {
        assert_eq!(
            parse_translate_text_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"text","type":1,"options":[]}]}"#,
            )),
            Err(TranslateTextCommandError::MissingText)
        );
        assert_eq!(
            parse_translate_text_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"text","type":1,"options":[{"name":"text","type":4,"value":1}]}]}"#,
            )),
            Err(TranslateTextCommandError::InvalidText)
        );
        assert_eq!(
            parse_translate_text_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"text","type":1,"options":[{"name":"text","type":3,"value":"hello"},{"name":"other","type":3,"value":"x"}]}]}"#,
            )),
            Err(TranslateTextCommandError::UnexpectedOption)
        );
    }
}
