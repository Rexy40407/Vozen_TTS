//! Safe boundary between Serenity interactions and Rust command handlers.
//!
//! It deliberately validates the versioned command contract before a handler sees any user input.
//! The gateway does not install this dispatcher until the individual areas are promoted from
//! shadow mode, preventing a partial Rust runtime from stealing production interactions.

use async_trait::async_trait;
use serenity::model::application::CommandData;
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DispatchOutcome {
    /// The handler sent/deferred the Discord response and owns the interaction lifecycle.
    Handled,
    /// The area is intentionally not live in this runtime yet. The gateway must not invoke this
    /// adapter in that configuration; this variant makes accidental activation testable.
    NotEnabled,
}

#[derive(Debug, Error)]
pub enum InteractionDispatchError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("command handler failed")]
    Handler,
}

/// Handler boundary. Implementations must reply or defer within Discord's interaction deadline;
/// they receive the already-validated broad area and the original typed data for leaf arguments.
#[async_trait]
pub trait InteractionHandler: Send + Sync {
    async fn handle(
        &self,
        area: CommandArea,
        command: &CommandData,
    ) -> Result<DispatchOutcome, InteractionDispatchError>;
}

/// Validates the root, kind and subcommand tree before passing the interaction to an enabled
/// handler. The validation happens before any response side effect, making forged/stale Discord
/// payloads fail closed.
pub async fn dispatch_interaction<H: InteractionHandler>(
    handler: &H,
    command: &CommandData,
) -> Result<DispatchOutcome, InteractionDispatchError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    handler.handle(area, command).await
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    #[derive(Default)]
    struct RecordingHandler {
        areas: Mutex<Vec<CommandArea>>,
    }

    #[async_trait]
    impl InteractionHandler for RecordingHandler {
        async fn handle(
            &self,
            area: CommandArea,
            _command: &CommandData,
        ) -> Result<DispatchOutcome, InteractionDispatchError> {
            self.areas.lock().expect("areas").push(area);
            Ok(DispatchOutcome::Handled)
        }
    }

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid Discord command payload")
    }

    #[tokio::test]
    async fn dispatcher_routes_only_after_contract_validation() {
        let handler = RecordingHandler::default();
        let queue_remove = command(
            r#"{"id":"1","name":"queue","type":1,"options":[{"name":"remove","type":1,"options":[]}]}"#,
        );
        assert_eq!(
            dispatch_interaction(&handler, &queue_remove)
                .await
                .expect("dispatch known command"),
            DispatchOutcome::Handled
        );
        assert_eq!(
            *handler.areas.lock().expect("areas"),
            vec![CommandArea::Queue]
        );

        let forged_path = command(
            r#"{"id":"1","name":"queue","type":1,"options":[{"name":"invented","type":1,"options":[]}]}"#,
        );
        assert!(matches!(
            dispatch_interaction(&handler, &forged_path).await,
            Err(InteractionDispatchError::Contract(
                ContractError::UnknownCommandPath { .. }
            ))
        ));
        assert_eq!(
            *handler.areas.lock().expect("areas"),
            vec![CommandArea::Queue]
        );
    }
}
