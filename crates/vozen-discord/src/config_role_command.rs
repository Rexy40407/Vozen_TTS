//! Strict parser for the promoted `/config role` leaf.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigRoleCommand {
    pub role_id: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigRoleCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config role command has an invalid option shape")]
    InvalidShape,
    #[error("config role command has an invalid role type")]
    InvalidRole,
}

pub fn parse_config_role_command(
    command: &CommandData,
) -> Result<Option<ConfigRoleCommand>, ConfigRoleCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path != ["role"] {
        return Ok(None);
    }
    if command.options.len() != 1 {
        return Err(ConfigRoleCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigRoleCommandError::InvalidShape);
    };
    if command.options[0].name != "role" || options.len() > 1 {
        return Err(ConfigRoleCommandError::InvalidShape);
    }
    let Some(option) = options.first() else {
        return Ok(Some(ConfigRoleCommand { role_id: None }));
    };
    if option.name != "role" {
        return Err(ConfigRoleCommandError::InvalidShape);
    }
    let CommandDataOptionValue::Role(role_id) = &option.value else {
        return Err(ConfigRoleCommandError::InvalidRole);
    };
    Ok(Some(ConfigRoleCommand {
        role_id: Some(role_id.get().to_string()),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(payload: &str) -> CommandData {
        serde_json::from_str(payload).expect("valid command data")
    }

    #[test]
    fn parses_set_and_clear_and_leaves_other_config_paths_unclaimed() {
        assert_eq!(
            parse_config_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"role","type":1,"options":[{"name":"role","type":8,"value":"123"}]}]}"#
            )).expect("role"),
            Some(ConfigRoleCommand { role_id: Some("123".into()) })
        );
        assert_eq!(
            parse_config_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"role","type":1,"options":[]}]}"#
            )).expect("clear"),
            Some(ConfigRoleCommand { role_id: None })
        );
        assert_eq!(
            parse_config_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]}"#
            )).expect("language"),
            None
        );
    }

    #[test]
    fn rejects_forged_or_wrongly_typed_roles() {
        assert!(matches!(
            parse_config_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"role","type":1,"options":[{"name":"role","type":3,"value":"123"}]}]}"#
            )),
            Err(ConfigRoleCommandError::InvalidRole)
        ));
        assert!(matches!(
            parse_config_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"role","type":1,"options":[{"name":"other","type":8,"value":"123"}]}]}"#
            )),
            Err(ConfigRoleCommandError::InvalidShape)
        ));
    }
}
