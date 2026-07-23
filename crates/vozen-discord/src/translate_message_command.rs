//! Contract and target-shape validation for the message context-menu Translate command.

use serenity::model::application::{CommandData, CommandType, ResolvedTarget};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, route_command};

pub const TRANSLATE_MESSAGE_COMMAND: &str = "Translate";

#[derive(Debug, Clone, Copy)]
pub struct TranslateMessageCommand<'a> {
    pub message: &'a serenity::model::channel::Message,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranslateMessageCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the translate command must be a message context menu interaction")]
    WrongType,
    #[error("the translate command is missing its target message")]
    MissingTarget,
    #[error("the translate command target was not resolved by Discord")]
    UnresolvedTarget,
}

pub fn parse_translate_message_command<'a>(
    command: &'a CommandData,
) -> Result<Option<TranslateMessageCommand<'a>>, TranslateMessageCommandError> {
    if command.name != TRANSLATE_MESSAGE_COMMAND {
        return Ok(None);
    }
    if command.kind != CommandType::Message {
        return Err(TranslateMessageCommandError::WrongType);
    }
    route_command(TRANSLATE_MESSAGE_COMMAND, command.kind.into(), &[])?
        .eq(&CommandArea::Translation)
        .then_some(())
        .ok_or(TranslateMessageCommandError::WrongType)?;
    if command.target_id.is_none() {
        return Err(TranslateMessageCommandError::MissingTarget);
    }
    match command.target() {
        Some(ResolvedTarget::Message(message)) => Ok(Some(TranslateMessageCommand { message })),
        _ => Err(TranslateMessageCommandError::UnresolvedTarget),
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
                "name": TRANSLATE_MESSAGE_COMMAND,
                "type": 3,
                "target_id": "42",
                "resolved": {"messages": {"42": message}}
            })
            .to_string(),
        );
        let parsed = parse_translate_message_command(&payload).expect("context menu command");
        assert_eq!(parsed.map(|value| value.message.id.get()), Some(42));
    }

    #[test]
    fn rejects_wrong_type_missing_target_and_unresolved_target() {
        assert!(matches!(
            parse_translate_message_command(&command(r#"{"id":"1","name":"Translate","type":1}"#)),
            Err(TranslateMessageCommandError::WrongType)
        ));
        assert!(matches!(
            parse_translate_message_command(&command(r#"{"id":"1","name":"Translate","type":3}"#)),
            Err(TranslateMessageCommandError::MissingTarget)
        ));
        assert!(matches!(
            parse_translate_message_command(&command(
                r#"{"id":"1","name":"Translate","type":3,"target_id":"42"}"#
            )),
            Err(TranslateMessageCommandError::UnresolvedTarget)
        ));
    }

    #[test]
    fn ignores_other_context_menu_commands() {
        assert!(
            parse_translate_message_command(&command(
                r#"{"id":"1","name":"Speak","type":3,"target_id":"42"}"#
            ))
            .expect("other command should remain Node-owned")
            .is_none()
        );
    }
}
