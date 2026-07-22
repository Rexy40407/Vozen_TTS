#![forbid(unsafe_code)]

//! Versioned, language-neutral contracts shared by the legacy Node runtime and Rust rewrite.

use serde::Deserialize;
use thiserror::Error;

pub const DISCORD_COMMAND_CONTRACT_VERSION: u16 = 1;

#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct DiscordCommandCatalog {
    pub schema_version: u16,
    pub generated_from: String,
    #[serde(default)]
    pub public_commands: Vec<DiscordCommand>,
    #[serde(default)]
    pub owner_commands: Vec<DiscordCommand>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct DiscordCommand {
    pub name: String,
    #[serde(default)]
    pub options: Vec<DiscordCommand>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ContractError {
    #[error("invalid JSON: {0}")]
    InvalidJson(String),
    #[error("unsupported command contract schema {found}")]
    UnsupportedSchema { found: u16 },
    #[error("command name is empty")]
    EmptyCommandName,
    #[error("duplicate root command name: {0}")]
    DuplicateRootCommand(String),
}

impl DiscordCommandCatalog {
    pub fn from_json(json: &str) -> Result<Self, ContractError> {
        let catalog = serde_json::from_str::<Self>(json)
            .map_err(|error| ContractError::InvalidJson(error.to_string()))?;
        catalog.validate()?;
        Ok(catalog)
    }

    pub fn root_commands(&self) -> impl Iterator<Item = &DiscordCommand> {
        self.public_commands.iter().chain(&self.owner_commands)
    }

    pub fn command_names(&self) -> Vec<&str> {
        self.root_commands()
            .map(|command| command.name.as_str())
            .collect()
    }

    pub fn validate(&self) -> Result<(), ContractError> {
        if self.schema_version != DISCORD_COMMAND_CONTRACT_VERSION {
            return Err(ContractError::UnsupportedSchema {
                found: self.schema_version,
            });
        }

        let mut names = std::collections::BTreeSet::new();
        for command in self.root_commands() {
            validate_command(command)?;
            if !names.insert(command.name.as_str()) {
                return Err(ContractError::DuplicateRootCommand(command.name.clone()));
            }
        }
        Ok(())
    }
}

fn validate_command(command: &DiscordCommand) -> Result<(), ContractError> {
    if command.name.trim().is_empty() {
        return Err(ContractError::EmptyCommandName);
    }
    for option in &command.options {
        validate_command(option)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const CURRENT_COMMANDS: &str = include_str!("../../../contracts/discord-commands.json");

    #[test]
    fn current_discord_command_contract_is_valid() {
        let catalog = DiscordCommandCatalog::from_json(CURRENT_COMMANDS).expect("valid contract");
        assert!(catalog.command_names().contains(&"setup"));
        assert!(catalog.command_names().contains(&"server-pronunciation"));
        assert!(catalog.command_names().contains(&"vozen-grant"));
    }

    #[test]
    fn rejects_duplicate_root_commands() {
        let contract = r#"{
          "schema_version": 1,
          "generated_from": "test",
          "public_commands": [{"name": "setup"}],
          "owner_commands": [{"name": "setup"}]
        }"#;
        assert_eq!(
            DiscordCommandCatalog::from_json(contract),
            Err(ContractError::DuplicateRootCommand("setup".into()))
        );
    }
}
