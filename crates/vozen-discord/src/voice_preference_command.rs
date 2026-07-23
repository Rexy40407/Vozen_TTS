//! Strict parser for the textual preference subset of `/voice`.
//!
//! Previews and the interactive configuration panel still require audio/UI adapters, so they
//! deliberately remain with Node. The read-only browser and preference mutations have complete
//! contracts and can be proven independently before ownership is switched.

use serenity::model::application::{CommandData, CommandDataOption, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq)]
pub enum VoicePreferenceCommand {
    List,
    Browse {
        query: Option<String>,
        locale: Option<String>,
        engine: String,
    },
    Set {
        model: String,
        speed: Option<f64>,
        engine: Option<String>,
    },
    Favorite {
        model: String,
    },
    Unfavorite {
        model: String,
    },
    Favorites,
    Recent,
    Reset,
    Detection {
        enabled: bool,
    },
    OptOut,
    OptIn,
    Nickname {
        nickname: Option<String>,
    },
    Effect {
        effect: String,
    },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum VoicePreferenceCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the voice command is missing its subcommand")]
    MissingSubcommand,
    #[error("the voice command contains an undeclared option")]
    UnexpectedOption,
    #[error("the voice command is missing its required option")]
    MissingOption,
    #[error("the voice command option has an invalid type")]
    InvalidOption,
}

/// Parses textual preference commands only.  A valid command that still needs a rich Discord UI returns
/// `None`, which is the staged-migration signal for the Node runtime to retain ownership.
pub fn parse_voice_preference_command(
    command: &CommandData,
) -> Result<Option<VoicePreferenceCommand>, VoicePreferenceCommandError> {
    let path = command_path_from_options(&command.options);
    if route_command(&command.name, command.kind.into(), &path)? != CommandArea::Personal
        || command.name != "voice"
    {
        return Ok(None);
    }
    let (name, options) = subcommand(&command.options)?;
    match name {
        "list" => empty(options).map(|()| Some(VoicePreferenceCommand::List)),
        "browse" => parse_browse(options).map(Some),
        "set" => parse_set(options).map(Some),
        "favorite" => {
            parse_model(options).map(|model| Some(VoicePreferenceCommand::Favorite { model }))
        }
        "unfavorite" => {
            parse_model(options).map(|model| Some(VoicePreferenceCommand::Unfavorite { model }))
        }
        "favorites" => empty(options).map(|()| Some(VoicePreferenceCommand::Favorites)),
        "recent" => empty(options).map(|()| Some(VoicePreferenceCommand::Recent)),
        "reset" => empty(options).map(|()| Some(VoicePreferenceCommand::Reset)),
        "detection" => parse_detection(options).map(Some),
        "opt-out" => empty(options).map(|()| Some(VoicePreferenceCommand::OptOut)),
        "opt-in" => empty(options).map(|()| Some(VoicePreferenceCommand::OptIn)),
        "nickname" => parse_nickname(options).map(Some),
        "effect" => parse_effect(options).map(Some),
        _ => Ok(None),
    }
}

fn parse_model(options: &[CommandDataOption]) -> Result<String, VoicePreferenceCommandError> {
    if options.len() != 1 || options[0].name != "model" {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    required_string(options, "model")
}

fn subcommand(
    options: &[CommandDataOption],
) -> Result<(&str, &[CommandDataOption]), VoicePreferenceCommandError> {
    if options.len() != 1 {
        return Err(VoicePreferenceCommandError::MissingSubcommand);
    }
    match &options[0].value {
        CommandDataOptionValue::SubCommand(nested) => Ok((&options[0].name, nested)),
        _ => Err(VoicePreferenceCommandError::MissingSubcommand),
    }
}

fn empty(options: &[CommandDataOption]) -> Result<(), VoicePreferenceCommandError> {
    options
        .is_empty()
        .then_some(())
        .ok_or(VoicePreferenceCommandError::UnexpectedOption)
}

fn parse_set(
    options: &[CommandDataOption],
) -> Result<VoicePreferenceCommand, VoicePreferenceCommandError> {
    if options.len() > 3
        || options.iter().any(|option| {
            option.name != "model" && option.name != "speed" && option.name != "engine"
        })
    {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    let model = required_string(options, "model")?;
    let speed = optional_number(options, "speed")?;
    let engine = optional_string(options, "engine")?;
    Ok(VoicePreferenceCommand::Set {
        model,
        speed,
        engine,
    })
}

fn parse_browse(
    options: &[CommandDataOption],
) -> Result<VoicePreferenceCommand, VoicePreferenceCommandError> {
    if options.len() > 3
        || options
            .iter()
            .any(|option| !matches!(option.name.as_str(), "query" | "locale" | "engine"))
    {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    Ok(VoicePreferenceCommand::Browse {
        query: optional_string(options, "query")?.map(|value| value.trim().to_owned()),
        locale: optional_string(options, "locale")?.map(|value| value.trim().to_ascii_lowercase()),
        engine: optional_string(options, "engine")?
            .unwrap_or_else(|| "all".to_owned())
            .trim()
            .to_ascii_lowercase(),
    })
}

fn parse_detection(
    options: &[CommandDataOption],
) -> Result<VoicePreferenceCommand, VoicePreferenceCommandError> {
    if options.len() != 1 || options[0].name != "active" {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    let CommandDataOptionValue::Boolean(enabled) = options[0].value else {
        return Err(VoicePreferenceCommandError::InvalidOption);
    };
    Ok(VoicePreferenceCommand::Detection { enabled })
}

fn parse_nickname(
    options: &[CommandDataOption],
) -> Result<VoicePreferenceCommand, VoicePreferenceCommandError> {
    if options.len() > 1 || options.iter().any(|option| option.name != "name") {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    Ok(VoicePreferenceCommand::Nickname {
        nickname: optional_string(options, "name")?.map(|value| value.trim().to_owned()),
    })
}

fn parse_effect(
    options: &[CommandDataOption],
) -> Result<VoicePreferenceCommand, VoicePreferenceCommandError> {
    if options.len() != 1 || options[0].name != "effect" {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    Ok(VoicePreferenceCommand::Effect {
        effect: required_string(options, "effect")?,
    })
}

fn required_string(
    options: &[CommandDataOption],
    name: &str,
) -> Result<String, VoicePreferenceCommandError> {
    optional_string(options, name)?.ok_or(VoicePreferenceCommandError::MissingOption)
}

fn optional_string(
    options: &[CommandDataOption],
    name: &str,
) -> Result<Option<String>, VoicePreferenceCommandError> {
    let values = options
        .iter()
        .filter(|option| option.name == name)
        .collect::<Vec<_>>();
    if values.len() > 1 {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    let Some(option) = values.first() else {
        return Ok(None);
    };
    let CommandDataOptionValue::String(value) = &option.value else {
        return Err(VoicePreferenceCommandError::InvalidOption);
    };
    Ok(Some(value.clone()))
}

fn optional_number(
    options: &[CommandDataOption],
    name: &str,
) -> Result<Option<f64>, VoicePreferenceCommandError> {
    let values = options
        .iter()
        .filter(|option| option.name == name)
        .collect::<Vec<_>>();
    if values.len() > 1 {
        return Err(VoicePreferenceCommandError::UnexpectedOption);
    }
    let Some(option) = values.first() else {
        return Ok(None);
    };
    let CommandDataOptionValue::Number(value) = option.value else {
        return Err(VoicePreferenceCommandError::InvalidOption);
    };
    Ok(Some(value))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_the_mutation_subset_without_claiming_ui_commands() {
        assert_eq!(
            parse_voice_preference_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"set","type":1,"options":[{"name":"model","type":3,"value":"en_US-amy-medium"},{"name":"speed","type":10,"value":1.2},{"name":"engine","type":3,"value":"piper"}]}]}"#)).expect("set"),
            Some(VoicePreferenceCommand::Set { model: "en_US-amy-medium".into(), speed: Some(1.2), engine: Some("piper".into()) })
        );
        assert_eq!(
            parse_voice_preference_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"favorite","type":1,"options":[{"name":"model","type":3,"value":"en_US-amy-medium"}]}]}"#)).expect("favorite"),
            Some(VoicePreferenceCommand::Favorite { model: "en_US-amy-medium".into() })
        );
        assert_eq!(
            parse_voice_preference_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"list","type":1,"options":[]}]}"#)).expect("list"),
            Some(VoicePreferenceCommand::List)
        );
        assert_eq!(
            parse_voice_preference_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"browse","type":1,"options":[{"name":"query","type":3,"value":" Amy "},{"name":"locale","type":3,"value":"EN"},{"name":"engine","type":3,"value":"local"}]}]}"#)).expect("browse"),
            Some(VoicePreferenceCommand::Browse {
                query: Some("Amy".into()),
                locale: Some("en".into()),
                engine: "local".into(),
            })
        );
        assert_eq!(
            parse_voice_preference_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"detection","type":1,"options":[{"name":"active","type":5,"value":true}]}]}"#)).expect("detection"),
            Some(VoicePreferenceCommand::Detection { enabled: true })
        );
        assert_eq!(
            parse_voice_preference_command(&command(r#"{"id":"1","name":"voice","type":1,"options":[{"name":"config","type":1,"options":[]}]}"#)).expect("ui stays Node"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_wrongly_typed_options() {
        assert_eq!(
            parse_voice_preference_command(&command(
                r#"{"id":"1","name":"voice","type":1,"options":[{"name":"set","type":1,"options":[{"name":"model","type":4,"value":1}]}]}"#
            )),
            Err(VoicePreferenceCommandError::InvalidOption)
        );
        assert_eq!(
            parse_voice_preference_command(&command(
                r#"{"id":"1","name":"voice","type":1,"options":[{"name":"opt-out","type":1,"options":[{"name":"x","type":3,"value":"x"}]}]}"#
            )),
            Err(VoicePreferenceCommandError::UnexpectedOption)
        );
    }
}
