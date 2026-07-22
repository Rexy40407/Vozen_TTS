//! Contract-backed handler routing for chat-input commands.
//!
//! This is intentionally separate from Serenity event wiring: shadow mode must not consume a
//! user interaction until its handler has parity. The route table nevertheless makes missing
//! ports explicit and fails tests if Node adds a command that Rust has not classified.

use vozen_contracts::{ContractError, DiscordCommandCatalog};

const COMMANDS: &str = include_str!("../../../contracts/discord-commands.json");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandArea {
    CoreVoice,
    Queue,
    Fun,
    Personal,
    ServerConfig,
    Monetization,
    Discovery,
    Privacy,
    Games,
    Translation,
    Transcription,
    Owner,
}

/// Classifies every Node root command. It does not imply the handler is live; that decision is
/// made by the runtime only after the corresponding parity tests are enabled.
pub fn command_area(root: &str) -> Option<CommandArea> {
    Some(match root {
        "join" | "leave" | "tts" | "tts-file" | "skip" | "shut-up" | "Speak" => {
            CommandArea::CoreVoice
        }
        "queue" => CommandArea::Queue,
        "laugh" | "joke" | "rizz" | "sound" | "8-ball" | "fortune" | "fact" | "wyr" => {
            CommandArea::Fun
        }
        "voice" | "pronunciation" | "birthday" => CommandArea::Personal,
        "config" | "setup" | "stats" | "server-pronunciation" | "server-stats" | "top-speakers" => {
            CommandArea::ServerConfig
        }
        "premium" | "redeem" | "generate-code" => CommandArea::Monetization,
        "invite" | "vote" | "help" | "uptime" | "bot-stats" => CommandArea::Discovery,
        "privacy" => CommandArea::Privacy,
        "game" | "cast" | "randomizer" => CommandArea::Games,
        "translate" | "Translate" => CommandArea::Translation,
        "transcribe" | "Transcribe voice message" => CommandArea::Transcription,
        "vozen-grant" | "dev" => CommandArea::Owner,
        _ => return None,
    })
}

/// Resolves the incoming application-command shape before returning its broad handler area.
/// Unknown paths and wrong types are rejected by the shared Node-generated contract first.
pub fn route_command(
    root: &str,
    command_type: u8,
    path: &[&str],
) -> Result<CommandArea, ContractError> {
    let catalog = DiscordCommandCatalog::from_json(COMMANDS)?;
    catalog.resolve_command(root, command_type, path)?;
    command_area(root).ok_or_else(|| ContractError::UnknownCommandPath {
        root: root.to_owned(),
        segment: root.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_contract_root_has_an_explicit_rust_migration_area() {
        let catalog = DiscordCommandCatalog::from_json(COMMANDS).expect("valid command contract");
        let missing = catalog
            .command_names()
            .into_iter()
            .filter(|name| command_area(name).is_none())
            .collect::<Vec<_>>();
        assert!(
            missing.is_empty(),
            "unclassified command roots: {missing:?}"
        );
    }

    #[test]
    fn route_validates_the_contract_before_classifying() {
        assert_eq!(
            route_command("queue", 1, &["remove"]).expect("known route"),
            CommandArea::Queue
        );
        assert!(matches!(
            route_command("queue", 1, &["invented"]),
            Err(ContractError::UnknownCommandPath { .. })
        ));
    }
}
