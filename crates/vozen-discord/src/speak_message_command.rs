//! Contract and target-shape validation for the message context-menu Speak command.
//!
//! This parser deliberately admits only Discord-resolved message targets. Content policy,
//! same-call admission, and synthesis remain owned by the core voice service.

use serenity::model::application::{CommandData, CommandType, ResolvedTarget};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, route_command};

pub const SPEAK_MESSAGE_COMMAND: &str = "Speak";

#[derive(Debug, Clone, Copy)]
pub struct SpeakMessageCommand<'a> {
    pub message: &'a serenity::model::channel::Message,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SpeakMessageCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the speak command must be a message context menu interaction")]
    WrongType,
    #[error("the speak command is missing its target message")]
    MissingTarget,
    #[error("the speak command target was not resolved by Discord")]
    UnresolvedTarget,
}

/// Validates the generated command contract and returns only a resolved Discord message.
/// Malformed or forged payloads fail closed before any interaction response or synthesis.
pub fn parse_speak_message_command<'a>(
    command: &'a CommandData,
) -> Result<Option<SpeakMessageCommand<'a>>, SpeakMessageCommandError> {
    if command.name != SPEAK_MESSAGE_COMMAND {
        return Ok(None);
    }
    if command.kind != CommandType::Message {
        return Err(SpeakMessageCommandError::WrongType);
    }
    route_command(SPEAK_MESSAGE_COMMAND, command.kind.into(), &[])?
        .eq(&CommandArea::CoreVoice)
        .then_some(())
        .ok_or(SpeakMessageCommandError::WrongType)?;
    if command.target_id.is_none() {
        return Err(SpeakMessageCommandError::MissingTarget);
    }
    match command.target() {
        Some(ResolvedTarget::Message(message)) => Ok(Some(SpeakMessageCommand { message })),
        _ => Err(SpeakMessageCommandError::UnresolvedTarget),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid Discord command payload")
    }

    #[test]
    fn accepts_only_a_resolved_message_context_menu_target() {
        let mut message = serde_json::to_value(serenity::model::channel::Message::default())
            .expect("serializable message defaults");
        message["id"] = serde_json::json!("42");
        message["channel_id"] = serde_json::json!("7");
        let payload = command(
            &serde_json::json!({
                "id": "1",
                "name": SPEAK_MESSAGE_COMMAND,
                "type": 3,
                "target_id": "42",
                "resolved": {"messages": {"42": message}}
            })
            .to_string(),
        );
        let parsed = parse_speak_message_command(&payload).expect("context menu command");
        assert_eq!(parsed.map(|value| value.message.id.get()), Some(42));
    }

    #[test]
    fn rejects_wrong_type_missing_target_and_unresolved_target() {
        assert!(matches!(
            parse_speak_message_command(&command(r#"{"id":"1","name":"Speak","type":1}"#)),
            Err(SpeakMessageCommandError::WrongType)
        ));
        assert!(matches!(
            parse_speak_message_command(&command(r#"{"id":"1","name":"Speak","type":3}"#)),
            Err(SpeakMessageCommandError::MissingTarget)
        ));
        assert!(matches!(
            parse_speak_message_command(&command(
                r#"{"id":"1","name":"Speak","type":3,"target_id":"42"}"#
            )),
            Err(SpeakMessageCommandError::UnresolvedTarget)
        ));
    }

    #[test]
    fn ignores_other_context_menu_commands() {
        assert!(
            parse_speak_message_command(&command(
                r#"{"id":"1","name":"Translate","type":3,"target_id":"42"}"#
            ))
            .expect("other command should remain Node-owned")
            .is_none()
        );
    }
}
