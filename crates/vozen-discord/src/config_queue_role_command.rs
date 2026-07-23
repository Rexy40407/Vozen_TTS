//! Strict parser for the `/config priority-role` and `/config blocked-role` leaves.

use serenity::model::application::{CommandData, CommandDataOptionValue};
use thiserror::Error;
use vozen_contracts::ContractError;

use crate::{CommandArea, command_path_from_options, route_command};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigQueueRoleSetting {
    Priority,
    Blocked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigQueueRoleCommand {
    pub setting: ConfigQueueRoleSetting,
    pub role_id: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigQueueRoleCommandError {
    #[error("incoming command does not match the registered command contract: {0}")]
    Contract(#[from] ContractError),
    #[error("config queue role command has an invalid option shape")]
    InvalidShape,
    #[error("config queue role command has an invalid role type")]
    InvalidRole,
}

pub fn parse_config_queue_role_command(
    command: &CommandData,
) -> Result<Option<ConfigQueueRoleCommand>, ConfigQueueRoleCommandError> {
    let path = command_path_from_options(&command.options);
    let area = route_command(&command.name, command.kind.into(), &path)?;
    if command.name != "config" || area != CommandArea::ServerConfig || path.len() != 1 {
        return Ok(None);
    }
    let setting = match path[0] {
        "priority-role" => ConfigQueueRoleSetting::Priority,
        "blocked-role" => ConfigQueueRoleSetting::Blocked,
        _ => return Ok(None),
    };
    if command.options.len() != 1 {
        return Err(ConfigQueueRoleCommandError::InvalidShape);
    }
    let CommandDataOptionValue::SubCommand(options) = &command.options[0].value else {
        return Err(ConfigQueueRoleCommandError::InvalidShape);
    };
    if options.len() > 1 || command.options[0].name != path[0] {
        return Err(ConfigQueueRoleCommandError::InvalidShape);
    }
    let Some(option) = options.first() else {
        return Ok(Some(ConfigQueueRoleCommand {
            setting,
            role_id: None,
        }));
    };
    if option.name != "role" {
        return Err(ConfigQueueRoleCommandError::InvalidShape);
    }
    let CommandDataOptionValue::Role(role_id) = &option.value else {
        return Err(ConfigQueueRoleCommandError::InvalidRole);
    };
    Ok(Some(ConfigQueueRoleCommand {
        setting,
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
    fn parses_set_and_clear_for_both_settings() {
        assert_eq!(
            parse_config_queue_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"priority-role","type":1,"options":[{"name":"role","type":8,"value":"123"}]}]}"#
            )).expect("priority"),
            Some(ConfigQueueRoleCommand { setting: ConfigQueueRoleSetting::Priority, role_id: Some("123".into()) })
        );
        assert_eq!(
            parse_config_queue_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"blocked-role","type":1,"options":[]}]}"#
            )).expect("clear"),
            Some(ConfigQueueRoleCommand { setting: ConfigQueueRoleSetting::Blocked, role_id: None })
        );
    }

    #[test]
    fn rejects_wrong_role_payloads_and_leaves_other_config_paths_unclaimed() {
        assert!(matches!(
            parse_config_queue_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"priority-role","type":1,"options":[{"name":"role","type":3,"value":"123"}]}]}"#
            )),
            Err(ConfigQueueRoleCommandError::InvalidRole)
        ));
        assert_eq!(
            parse_config_queue_role_command(&command(
                r#"{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}]}"#
            )).expect("show"),
            None
        );
    }
}
