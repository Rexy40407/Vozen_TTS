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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslatePreviewCommand {
    pub text: String,
    pub target_locale: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TranslationAdminCommand {
    Status,
    Enable,
    Disable,
    Clear,
    MapAdd {
        source_channel_id: u64,
        destination_channel_id: u64,
        target_locale: String,
    },
    MapRemove {
        source_channel_id: u64,
    },
    MapList,
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

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranslatePreviewCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the preview command is missing its required option")]
    MissingOption,
    #[error("the preview command has an invalid option type")]
    InvalidOption,
    #[error("the preview command contains an undeclared option")]
    UnexpectedOption,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranslationAdminCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the translation admin command has an invalid option shape")]
    InvalidShape,
    #[error("the translation admin command has an invalid channel option")]
    InvalidChannel,
    #[error("the translation admin command has an invalid string option")]
    InvalidString,
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

/// Parses exactly the Manage Server `/translate preview` leaf.
pub fn parse_translate_preview_command(
    command: &CommandData,
) -> Result<Option<TranslatePreviewCommand>, TranslatePreviewCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::Translation
        || command.name != "translate"
        || path != ["preview"]
    {
        return Ok(None);
    }
    let Some(group) = command.options.first() else {
        return Err(TranslatePreviewCommandError::MissingOption);
    };
    let CommandDataOptionValue::SubCommand(options) = &group.value else {
        return Err(TranslatePreviewCommandError::InvalidOption);
    };
    if options
        .iter()
        .any(|option| option.name != "text" && option.name != "locale")
    {
        return Err(TranslatePreviewCommandError::UnexpectedOption);
    }
    if options.len() != 2 {
        return Err(TranslatePreviewCommandError::MissingOption);
    }
    let text = options
        .iter()
        .find(|option| option.name == "text")
        .ok_or(TranslatePreviewCommandError::MissingOption)
        .and_then(|option| match &option.value {
            CommandDataOptionValue::String(value) => Ok(value.clone()),
            _ => Err(TranslatePreviewCommandError::InvalidOption),
        })?;
    let target_locale = options
        .iter()
        .find(|option| option.name == "locale")
        .ok_or(TranslatePreviewCommandError::MissingOption)
        .and_then(|option| match &option.value {
            CommandDataOptionValue::String(value) => Ok(value.clone()),
            _ => Err(TranslatePreviewCommandError::InvalidOption),
        })?;
    Ok(Some(TranslatePreviewCommand {
        text,
        target_locale,
    }))
}

/// Parses server-level translation administration. Manage Server authorization and live channel
/// permissions are deliberately checked by the Discord sink after this structural boundary.
pub fn parse_translation_admin_command(
    command: &CommandData,
) -> Result<Option<TranslationAdminCommand>, TranslationAdminCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::Translation
        || command.name != "translate"
    {
        return Ok(None);
    }
    let Some(subcommand) = path.first().copied() else {
        return Ok(None);
    };
    let Some(group) = command.options.first() else {
        return Err(TranslationAdminCommandError::InvalidShape);
    };
    let CommandDataOptionValue::SubCommand(options) = &group.value else {
        return Err(TranslationAdminCommandError::InvalidShape);
    };
    let no_options = || {
        if options.is_empty() {
            Ok(())
        } else {
            Err(TranslationAdminCommandError::InvalidShape)
        }
    };
    match subcommand {
        "status" => {
            no_options()?;
            Ok(Some(TranslationAdminCommand::Status))
        }
        "enable" => {
            no_options()?;
            Ok(Some(TranslationAdminCommand::Enable))
        }
        "disable" => {
            no_options()?;
            Ok(Some(TranslationAdminCommand::Disable))
        }
        "clear" => {
            no_options()?;
            Ok(Some(TranslationAdminCommand::Clear))
        }
        "map-list" => {
            no_options()?;
            Ok(Some(TranslationAdminCommand::MapList))
        }
        "map-remove" => {
            if options.len() != 1 || options[0].name != "source" {
                return Err(TranslationAdminCommandError::InvalidShape);
            }
            let CommandDataOptionValue::Channel(channel_id) = &options[0].value else {
                return Err(TranslationAdminCommandError::InvalidChannel);
            };
            let source_channel_id = channel_id.get();
            (source_channel_id != 0)
                .then_some(Some(TranslationAdminCommand::MapRemove {
                    source_channel_id,
                }))
                .ok_or(TranslationAdminCommandError::InvalidChannel)
        }
        "map-add" => {
            if options.len() != 3
                || !["source", "destination", "locale"]
                    .iter()
                    .all(|name| options.iter().filter(|option| option.name == *name).count() == 1)
            {
                return Err(TranslationAdminCommandError::InvalidShape);
            }
            let channel = |name: &str| {
                let option = options
                    .iter()
                    .find(|option| option.name == name)
                    .ok_or(TranslationAdminCommandError::InvalidShape)?;
                let CommandDataOptionValue::Channel(channel_id) = &option.value else {
                    return Err(TranslationAdminCommandError::InvalidChannel);
                };
                let id = channel_id.get();
                (id != 0)
                    .then_some(id)
                    .ok_or(TranslationAdminCommandError::InvalidChannel)
            };
            let locale = options
                .iter()
                .find(|option| option.name == "locale")
                .and_then(|option| match &option.value {
                    CommandDataOptionValue::String(value) => Some(value.clone()),
                    _ => None,
                })
                .ok_or(TranslationAdminCommandError::InvalidString)?;
            Ok(Some(TranslationAdminCommand::MapAdd {
                source_channel_id: channel("source")?,
                destination_channel_id: channel("destination")?,
                target_locale: locale,
            }))
        }
        _ => Ok(None),
    }
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

    #[test]
    fn parses_translation_admin_leaves_and_rejects_forged_shapes() {
        let command = |subcommand: &str, options: &str| {
            command(&format!(
                r#"{{"id":"1","name":"translate","type":1,"options":[{{"name":"{subcommand}","type":1,"options":[{options}]}}]}}"#
            ))
        };
        assert_eq!(
            parse_translation_admin_command(&command("status", "")),
            Ok(Some(TranslationAdminCommand::Status))
        );
        assert_eq!(
            parse_translation_admin_command(&command("enable", "")),
            Ok(Some(TranslationAdminCommand::Enable))
        );
        assert_eq!(
            parse_translation_admin_command(&command("disable", "")),
            Ok(Some(TranslationAdminCommand::Disable))
        );
        assert_eq!(
            parse_translation_admin_command(&command("clear", "")),
            Ok(Some(TranslationAdminCommand::Clear))
        );
        assert_eq!(
            parse_translation_admin_command(&command("map-list", "")),
            Ok(Some(TranslationAdminCommand::MapList))
        );
        assert_eq!(
            parse_translation_admin_command(&command(
                "map-remove",
                r#"{"name":"source","type":7,"value":"123"}"#
            )),
            Ok(Some(TranslationAdminCommand::MapRemove {
                source_channel_id: 123
            }))
        );
        assert_eq!(
            parse_translation_admin_command(&command(
                "map-add",
                r#"{"name":"source","type":7,"value":"123"},{"name":"destination","type":7,"value":"456"},{"name":"locale","type":3,"value":"pt"}"#
            )),
            Ok(Some(TranslationAdminCommand::MapAdd {
                source_channel_id: 123,
                destination_channel_id: 456,
                target_locale: "pt".into()
            }))
        );
        assert_eq!(
            parse_translation_admin_command(&command(
                "status",
                r#"{"name":"extra","type":3,"value":"forged"}"#
            )),
            Err(TranslationAdminCommandError::InvalidShape)
        );
        assert_eq!(
            parse_translation_admin_command(&command(
                "map-add",
                r#"{"name":"source","type":7,"value":"123"},{"name":"destination","type":7,"value":"123"},{"name":"locale","type":3,"value":"pt"}"#
            )),
            Ok(Some(TranslationAdminCommand::MapAdd {
                source_channel_id: 123,
                destination_channel_id: 123,
                target_locale: "pt".into()
            }))
        );
    }

    #[test]
    fn parses_only_preview_with_both_required_strings() {
        assert_eq!(
            parse_translate_preview_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"preview","type":1,"options":[{"name":"text","type":3,"value":"hello"},{"name":"locale","type":3,"value":"pt"}]}]}"#,
            ))
            .expect("preview"),
            Some(TranslatePreviewCommand {
                text: "hello".into(),
                target_locale: "pt".into(),
            })
        );
        assert_eq!(
            parse_translate_preview_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"text","type":1,"options":[]}] }"#,
            ))
            .expect("other leaf"),
            None
        );
    }

    #[test]
    fn rejects_preview_without_locale_or_with_forged_options() {
        assert!(matches!(
            parse_translate_preview_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"preview","type":1,"options":[{"name":"text","type":3,"value":"hello"}]}]}"#,
            )),
            Err(TranslatePreviewCommandError::MissingOption)
        ));
        assert!(matches!(
            parse_translate_preview_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"preview","type":1,"options":[{"name":"text","type":3,"value":"hello"},{"name":"locale","type":3,"value":"pt"},{"name":"other","type":3,"value":"x"}]}]}"#,
            )),
            Err(TranslatePreviewCommandError::UnexpectedOption)
        ));
    }
}
