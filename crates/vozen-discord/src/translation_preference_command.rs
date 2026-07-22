//! Typed parsing for individual `/translate` preference leaves.
//!
//! These leaves alter only the caller's persisted translation preference. Server mappings,
//! provider enablement and automatic channel delivery are deliberately outside this boundary.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TranslationPreferenceCommand {
    DefaultLocale { locale: String },
    SpeakLocale { locale: String },
    OptOut { active: bool },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranslationPreferenceCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the translation preference command is missing its required option")]
    MissingOption,
    #[error("the translation preference command option has an invalid type")]
    InvalidOption,
    #[error("the translation preference command contains an undeclared option")]
    UnexpectedOption,
}

/// Parses exactly `language`, `speak-language` and `opt-out`. Every other valid translation
/// subcommand returns `None`, allowing the Node handler to retain it during incremental cutover.
pub fn parse_translation_preference_command(
    command: &CommandData,
) -> Result<Option<TranslationPreferenceCommand>, TranslationPreferenceCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::Translation
        || command.name != "translate"
    {
        return Ok(None);
    }
    let Some(subcommand) = path.first().copied() else {
        return Ok(None);
    };
    let expected_option = match subcommand {
        "language" | "speak-language" => "locale",
        "opt-out" => "active",
        _ => return Ok(None),
    };
    let Some(option_group) = command
        .options
        .iter()
        .find(|option| option.name == subcommand)
    else {
        return Err(TranslationPreferenceCommandError::MissingOption);
    };
    let CommandDataOptionValue::SubCommand(options) = &option_group.value else {
        return Err(TranslationPreferenceCommandError::InvalidOption);
    };
    if options.iter().any(|option| option.name != expected_option) {
        return Err(TranslationPreferenceCommandError::UnexpectedOption);
    }
    let value = options
        .iter()
        .find(|option| option.name == expected_option)
        .ok_or(TranslationPreferenceCommandError::MissingOption)?;
    match (subcommand, &value.value) {
        ("language", CommandDataOptionValue::String(locale)) => {
            Ok(Some(TranslationPreferenceCommand::DefaultLocale {
                locale: locale.clone(),
            }))
        }
        ("speak-language", CommandDataOptionValue::String(locale)) => {
            Ok(Some(TranslationPreferenceCommand::SpeakLocale {
                locale: locale.clone(),
            }))
        }
        ("opt-out", CommandDataOptionValue::Boolean(active)) => {
            Ok(Some(TranslationPreferenceCommand::OptOut {
                active: *active,
            }))
        }
        _ => Err(TranslationPreferenceCommandError::InvalidOption),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid Discord command payload")
    }

    #[test]
    fn parses_only_individual_preference_leaves() {
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]}"#,
            ))
            .expect("language"),
            Some(TranslationPreferenceCommand::DefaultLocale {
                locale: "pt".into(),
            })
        );
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"speak-language","type":1,"options":[{"name":"locale","type":3,"value":"off"}]}]}"#,
            ))
            .expect("speak language"),
            Some(TranslationPreferenceCommand::SpeakLocale {
                locale: "off".into(),
            })
        );
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"opt-out","type":1,"options":[{"name":"active","type":5,"value":true}]}]}"#,
            ))
            .expect("opt out"),
            Some(TranslationPreferenceCommand::OptOut { active: true })
        );
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"map-list","type":1,"options":[]}]}"#,
            ))
            .expect("server mapping remains unpromoted"),
            None
        );
    }

    #[test]
    fn rejects_bad_preference_payloads() {
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"language","type":1,"options":[]}]}"#,
            )),
            Err(TranslationPreferenceCommandError::MissingOption)
        );
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"opt-out","type":1,"options":[{"name":"active","type":3,"value":"yes"}]}]}"#,
            )),
            Err(TranslationPreferenceCommandError::InvalidOption)
        );
        assert_eq!(
            parse_translation_preference_command(&command(
                r#"{"id":"1","name":"translate","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"},{"name":"other","type":3,"value":"x"}]}]}"#,
            )),
            Err(TranslationPreferenceCommandError::UnexpectedOption)
        );
    }
}
