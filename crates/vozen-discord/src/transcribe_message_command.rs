//! Contract and target-shape validation for the message context-menu STT command.
//!
//! This module deliberately does not download or inspect user content. It only admits the exact
//! Discord interaction shape; the runtime adapter owns attachment policy and Whisper execution.

use serenity::model::application::{CommandData, CommandType, ResolvedTarget};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, route_command};

pub const TRANSCRIBE_MESSAGE_COMMAND: &str = "Transcribe voice message";

#[derive(Debug, Clone, Copy)]
pub struct TranscribeMessageCommand<'a> {
    pub message: &'a serenity::model::channel::Message,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TranscribeMessageCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("the transcription command must be a message context menu interaction")]
    WrongType,
    #[error("the transcription command is missing its target message")]
    MissingTarget,
    #[error("the transcription command target was not resolved by Discord")]
    UnresolvedTarget,
}

/// Validates the generated command contract and returns only a resolved Discord message.
///
/// A missing/forged target fails closed before any defer, download, or model invocation.
pub fn parse_transcribe_message_command<'a>(
    command: &'a CommandData,
) -> Result<Option<TranscribeMessageCommand<'a>>, TranscribeMessageCommandError> {
    if command.name != TRANSCRIBE_MESSAGE_COMMAND {
        return Ok(None);
    }
    if command.kind != CommandType::Message {
        return Err(TranscribeMessageCommandError::WrongType);
    }
    route_command(TRANSCRIBE_MESSAGE_COMMAND, command.kind.into(), &[])?
        .eq(&CommandArea::Transcription)
        .then_some(())
        .ok_or(TranscribeMessageCommandError::WrongType)?;
    if command.target_id.is_none() {
        return Err(TranscribeMessageCommandError::MissingTarget);
    }
    match command.target() {
        Some(ResolvedTarget::Message(message)) => Ok(Some(TranscribeMessageCommand { message })),
        _ => Err(TranscribeMessageCommandError::UnresolvedTarget),
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
                "name": TRANSCRIBE_MESSAGE_COMMAND,
                "type": 3,
                "target_id": "42",
                "resolved": {"messages": {"42": message}}
            })
            .to_string(),
        );
        let parsed = parse_transcribe_message_command(&payload).expect("context menu command");
        assert_eq!(parsed.map(|value| value.message.id.get()), Some(42));
    }

    #[test]
    fn rejects_wrong_type_missing_target_and_unresolved_target() {
        assert!(matches!(
            parse_transcribe_message_command(&command(
                r#"{"id":"1","name":"Transcribe voice message","type":1}"#,
            )),
            Err(TranscribeMessageCommandError::WrongType)
        ));
        assert!(matches!(
            parse_transcribe_message_command(&command(
                r#"{"id":"1","name":"Transcribe voice message","type":3}"#,
            )),
            Err(TranscribeMessageCommandError::MissingTarget)
        ));
        assert!(matches!(
            parse_transcribe_message_command(&command(
                r#"{"id":"1","name":"Transcribe voice message","type":3,"target_id":"42"}"#,
            )),
            Err(TranscribeMessageCommandError::UnresolvedTarget)
        ));
    }

    #[test]
    fn ignores_other_context_menu_commands() {
        assert!(
            parse_transcribe_message_command(&command(
                r#"{"id":"1","name":"Translate","type":3,"target_id":"42"}"#,
            ))
            .expect("other command should remain Node-owned")
            .is_none()
        );
    }
}
