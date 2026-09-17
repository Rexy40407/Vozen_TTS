//! Contract-backed parsing and bounded option handling for `/randomizer`.
//!
//! Discord UI state is handled by the runtime gateway sink; this module keeps the security and
//! data-shape rules independent of Serenity response tokens so they can be tested without a live
//! gateway. The limits mirror the Node command definition and its modal builder.

use serenity::model::application::{CommandData, CommandDataOptionValue, ModalInteraction};
use thiserror::Error;
use uuid::Uuid;

use crate::{CommandArea, command_path_from_options, route_command};

pub const MIN_OPTIONS: usize = 2;
pub const MAX_MODAL_OPTIONS: usize = 5;
pub const MAX_OPTIONS: usize = 50;
pub const MAX_OPTION_CHARS: usize = 120;
pub const MAX_DIRECT_INPUT_CHARS: usize = 1000;
pub const SESSION_TTL_MS: i64 = 10 * 60 * 1000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RandomizerCommand {
    ChooseAmount {
        language: String,
        engine: String,
    },
    Modal {
        amount: usize,
        language: String,
        engine: String,
    },
    Direct {
        options: Vec<String>,
        language: String,
        engine: String,
    },
}

impl RandomizerCommand {
    pub fn voice(&self) -> (&str, &str) {
        match self {
            Self::ChooseAmount { language, engine }
            | Self::Modal {
                language, engine, ..
            }
            | Self::Direct {
                language, engine, ..
            } => (language, engine),
        }
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum RandomizerCommandError {
    #[error("incoming randomizer command does not match the registered contract: {0}")]
    Contract(#[from] vozen_contracts::ContractError),
    #[error("randomizer contains an undeclared option")]
    UnexpectedOption,
    #[error("choose a supported language and voice engine")]
    InvalidVoice,
    #[error("randomizer amount must be an integer between 2 and 5")]
    InvalidAmount,
    #[error("randomizer options must contain at least two comma-separated values")]
    NeedTwoOptions,
    #[error("randomizer option is too long")]
    OptionTooLong,
}

#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum RandomizerInteractionError {
    #[error("invalid randomizer component id")]
    InvalidComponentId,
    #[error("randomizer interaction belongs to a different user")]
    WrongUser,
    #[error("randomizer interaction belongs to a different guild")]
    WrongGuild,
    #[error("randomizer interaction expired or is unknown")]
    Expired,
    #[error("randomizer selection is invalid")]
    InvalidSelection,
    #[error("randomizer modal is missing an option")]
    MissingOption,
    #[error("randomizer option is too long")]
    OptionTooLong,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RandomizerSession {
    pub user_id: String,
    pub guild_id: String,
    pub amount: Option<usize>,
    pub locale: String,
    pub language: String,
    pub engine: String,
    pub issued_at_ms: i64,
}

impl RandomizerSession {
    #[must_use]
    pub fn valid_at(&self, now_ms: i64) -> bool {
        now_ms >= self.issued_at_ms && now_ms.saturating_sub(self.issued_at_ms) <= SESSION_TTL_MS
    }
}

/// Parses the generated Discord command payload before a response is consumed.
pub fn parse_randomizer_command(
    command: &CommandData,
) -> Result<Option<RandomizerCommand>, RandomizerCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "randomizer" || area != CommandArea::Games {
        return Ok(None);
    }

    let mut amount = None;
    let mut options = None;
    let mut language = None;
    let mut engine = None;
    for option in &command.options {
        match (option.name.as_str(), &option.value) {
            ("language", CommandDataOptionValue::String(value)) => {
                if language.replace(value.clone()).is_some() {
                    return Err(RandomizerCommandError::UnexpectedOption);
                }
            }
            ("engine", CommandDataOptionValue::String(value)) => {
                if engine.replace(value.clone()).is_some() {
                    return Err(RandomizerCommandError::UnexpectedOption);
                }
            }
            ("amount", CommandDataOptionValue::Integer(value)) => {
                if amount.replace(*value).is_some() {
                    return Err(RandomizerCommandError::UnexpectedOption);
                }
            }
            ("options", CommandDataOptionValue::String(value)) => {
                if options.replace(value.clone()).is_some() {
                    return Err(RandomizerCommandError::UnexpectedOption);
                }
            }
            ("amount" | "options", _) => return Err(RandomizerCommandError::InvalidAmount),
            _ => return Err(RandomizerCommandError::UnexpectedOption),
        }
    }

    let language = language
        .filter(|value| crate::joke_lang_by_key(value).is_some())
        .ok_or(RandomizerCommandError::InvalidVoice)?;
    let engine = engine
        .filter(|value| matches!(value.as_str(), "google" | "piper" | "kokoro"))
        .ok_or(RandomizerCommandError::InvalidVoice)?;

    // Node intentionally gives the CSV path precedence when both optional arguments exist.
    if let Some(raw) = options {
        return parse_direct_options(&raw)
            .map(|options| RandomizerCommand::Direct {
                options,
                language,
                engine,
            })
            .map(Some);
    }
    match amount {
        None => Ok(Some(RandomizerCommand::ChooseAmount { language, engine })),
        Some(value) => {
            let amount = usize::try_from(value)
                .ok()
                .filter(|value| (MIN_OPTIONS..=MAX_MODAL_OPTIONS).contains(value))
                .ok_or(RandomizerCommandError::InvalidAmount)?;
            Ok(Some(RandomizerCommand::Modal {
                amount,
                language,
                engine,
            }))
        }
    }
}

pub fn parse_direct_options(raw: &str) -> Result<Vec<String>, RandomizerCommandError> {
    if raw.chars().count() > MAX_DIRECT_INPUT_CHARS {
        return Err(RandomizerCommandError::OptionTooLong);
    }
    let options = raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if options.len() < MIN_OPTIONS {
        return Err(RandomizerCommandError::NeedTwoOptions);
    }
    // Node accepts the whole bounded Discord string and announces only its first 50 entries.
    Ok(options.into_iter().take(MAX_OPTIONS).collect())
}

/// Keep the selected language even when the user's saved voice belongs to another language.
/// Synthetic Google models are not installed Piper voices.
pub fn randomizer_model<'a>(
    available: &'a [String],
    preferred: Option<&str>,
    language: &str,
    engine: &str,
) -> Option<&'a str> {
    let prefix = crate::joke_lang_by_key(language)?.prefix;
    let compatible = |model: &&String| {
        model.starts_with(prefix) && (engine != "piper" || !model.ends_with("-google-medium"))
    };
    available
        .iter()
        .filter(compatible)
        .find(|model| Some(model.as_str()) == preferred)
        .or_else(|| available.iter().find(compatible))
        .map(String::as_str)
}

pub fn parse_modal_options(
    modal: &ModalInteraction,
    amount: usize,
) -> Result<Vec<String>, RandomizerInteractionError> {
    if !(MIN_OPTIONS..=MAX_MODAL_OPTIONS).contains(&amount) {
        return Err(RandomizerInteractionError::InvalidSelection);
    }
    let mut options = Vec::with_capacity(amount);
    for index in 1..=amount {
        let custom_id = format!("opt{index}");
        let value = modal
            .data
            .components
            .iter()
            .flat_map(|row| row.components.iter())
            .find_map(|component| match component {
                serenity::model::application::ActionRowComponent::InputText(input)
                    if input.custom_id == custom_id =>
                {
                    input.value.clone()
                }
                _ => None,
            })
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
            .ok_or(RandomizerInteractionError::MissingOption)?;
        if value.chars().count() > MAX_OPTION_CHARS {
            return Err(RandomizerInteractionError::OptionTooLong);
        }
        options.push(value);
    }
    validate_options(&options, MAX_MODAL_OPTIONS).map_err(|error| match error {
        RandomizerCommandError::NeedTwoOptions => RandomizerInteractionError::MissingOption,
        RandomizerCommandError::OptionTooLong => RandomizerInteractionError::OptionTooLong,
        _ => RandomizerInteractionError::InvalidSelection,
    })?;
    Ok(options)
}

fn validate_options(options: &[String], max: usize) -> Result<(), RandomizerCommandError> {
    if options.len() < MIN_OPTIONS {
        return Err(RandomizerCommandError::NeedTwoOptions);
    }
    if options.len() > max {
        return Err(RandomizerCommandError::InvalidAmount);
    }
    if options
        .iter()
        .any(|option| option.chars().count() > MAX_OPTION_CHARS)
    {
        return Err(RandomizerCommandError::OptionTooLong);
    }
    Ok(())
}

pub fn parse_amount_component_id(custom_id: &str) -> Option<String> {
    custom_id
        .strip_prefix("randAmount:")
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
}

pub fn parse_fill_component_id(custom_id: &str) -> Option<String> {
    custom_id
        .strip_prefix("randFill:")
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
}

#[must_use]
pub fn pick_option(options: &[String]) -> Option<&str> {
    if options.is_empty() {
        return None;
    }
    let index = (Uuid::new_v4().as_u128() % options.len() as u128) as usize;
    options.get(index).map(String::as_str)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn empty_command() -> CommandData {
        serde_json::from_value(serde_json::json!({
            "id": "1", "name": "randomizer", "type": 1, "options": [
                {"name":"language", "type":3, "value":"pt"},
                {"name":"engine", "type":3, "value":"piper"}
            ]
        }))
        .expect("command")
    }

    #[test]
    fn csv_path_is_bounded_and_trimmed() {
        assert_eq!(
            parse_direct_options(" pizza, , sushi ").expect("options"),
            vec!["pizza", "sushi"]
        );
        assert!(matches!(
            parse_direct_options("pizza"),
            Err(RandomizerCommandError::NeedTwoOptions)
        ));
    }

    #[test]
    fn selected_language_does_not_fall_back_to_english() {
        let models = vec![
            "en_US-amy-medium".into(),
            "pt_PT-google-medium".into(),
            "pt_BR-faber-medium".into(),
        ];
        assert_eq!(
            randomizer_model(&models, Some("en_US-amy-medium"), "pt", "google"),
            Some("pt_PT-google-medium")
        );
        assert_eq!(
            randomizer_model(&models, Some("pt_PT-google-medium"), "pt", "piper"),
            Some("pt_BR-faber-medium")
        );
        assert_eq!(randomizer_model(&models, None, "fr", "piper"), None);
    }

    #[test]
    fn voice_selection_is_required_and_validated() {
        let mut command = empty_command();
        command.options.clear();
        assert_eq!(
            parse_randomizer_command(&command),
            Err(RandomizerCommandError::InvalidVoice)
        );
        let mut command = empty_command();
        command.options[1].value = CommandDataOptionValue::String("unknown".into());
        assert_eq!(
            parse_randomizer_command(&command),
            Err(RandomizerCommandError::InvalidVoice)
        );
    }

    #[test]
    fn command_paths_match_node_precedence() {
        let command = serde_json::from_value(serde_json::json!({
            "id": "1", "name": "randomizer", "type": 1,
            "options": [
                {"name":"language", "type":3, "value":"pt"},
                {"name":"engine", "type":3, "value":"piper"},
                {"name": "amount", "type": 4, "value": 3},
                {"name": "options", "type": 3, "value": "a,b"}
            ]
        }))
        .expect("command");
        assert_eq!(
            parse_randomizer_command(&command).expect("parse"),
            Some(RandomizerCommand::Direct {
                options: vec!["a".into(), "b".into()],
                language: "pt".into(),
                engine: "piper".into()
            })
        );
    }

    #[test]
    fn amount_and_component_ids_are_strict() {
        assert_eq!(
            parse_randomizer_command(&empty_command()).expect("parse"),
            Some(RandomizerCommand::ChooseAmount {
                language: "pt".into(),
                engine: "piper".into()
            })
        );
        assert_eq!(
            parse_amount_component_id("randAmount:42"),
            Some("42".into())
        );
        assert_eq!(parse_fill_component_id("randFill:42"), Some("42".into()));
        assert_eq!(parse_amount_component_id("randFill:42"), None);
    }

    #[test]
    fn sessions_expire_and_picker_is_bounded() {
        let session = RandomizerSession {
            user_id: "u".into(),
            guild_id: "g".into(),
            amount: Some(2),
            locale: "en".into(),
            language: "pt".into(),
            engine: "piper".into(),
            issued_at_ms: 10,
        };
        assert!(session.valid_at(10 + SESSION_TTL_MS));
        assert!(!session.valid_at(11 + SESSION_TTL_MS));
        assert!(pick_option(&["a".into(), "b".into()]).is_some());
    }
}
