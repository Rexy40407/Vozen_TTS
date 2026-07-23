//! SQLite-backed service for the mutually exclusive queue role settings.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::{ConfigQueueRoleCommand, ConfigQueueRoleSetting};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigQueueRoleOutcome {
    Saved {
        setting: ConfigQueueRoleSetting,
        role_id: Option<String>,
    },
    Conflict,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigQueueRoleFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigQueueRoleInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigQueueRoleService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigQueueRoleService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigQueueRoleInvocation<'_>,
        command: ConfigQueueRoleCommand,
    ) -> Result<ConfigQueueRoleOutcome, ConfigQueueRoleFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigQueueRoleFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigQueueRoleFailure::GuildRequired);
        };
        let store = self
            .store
            .lock()
            .map_err(|_| ConfigQueueRoleFailure::StoreUnavailable)?;
        let current = store
            .guild_config(guild_id)
            .map_err(|_| ConfigQueueRoleFailure::StoreUnavailable)?;
        let conflicts = command
            .role_id
            .as_deref()
            .is_some_and(|role_id| match command.setting {
                ConfigQueueRoleSetting::Priority => {
                    current.blocked_role_id.as_deref() == Some(role_id)
                }
                ConfigQueueRoleSetting::Blocked => {
                    current.priority_role_id.as_deref() == Some(role_id)
                }
            });
        if conflicts {
            return Ok(ConfigQueueRoleOutcome::Conflict);
        }
        let role_id = command.role_id.clone();
        let patch = match command.setting {
            ConfigQueueRoleSetting::Priority => GuildConfigPatch {
                priority_role_id: Some(role_id.clone()),
                ..Default::default()
            },
            ConfigQueueRoleSetting::Blocked => GuildConfigPatch {
                blocked_role_id: Some(role_id.clone()),
                ..Default::default()
            },
        };
        store
            .update_guild_config(guild_id, patch)
            .map(|_| ConfigQueueRoleOutcome::Saved {
                setting: command.setting,
                role_id,
            })
            .map_err(|_| ConfigQueueRoleFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enforces_cross_field_conflict_and_preserves_independent_fields() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigQueueRoleService::new(store.clone());
        let invocation = ConfigQueueRoleInvocation {
            guild_id: Some("guild"),
            can_manage_guild: true,
        };
        assert_eq!(
            service.execute(
                invocation,
                ConfigQueueRoleCommand {
                    setting: ConfigQueueRoleSetting::Blocked,
                    role_id: Some("123".into())
                }
            ),
            Ok(ConfigQueueRoleOutcome::Saved {
                setting: ConfigQueueRoleSetting::Blocked,
                role_id: Some("123".into())
            })
        );
        assert_eq!(
            service.execute(
                invocation,
                ConfigQueueRoleCommand {
                    setting: ConfigQueueRoleSetting::Priority,
                    role_id: Some("123".into())
                }
            ),
            Ok(ConfigQueueRoleOutcome::Conflict)
        );
        assert_eq!(
            service.execute(
                invocation,
                ConfigQueueRoleCommand {
                    setting: ConfigQueueRoleSetting::Priority,
                    role_id: Some("456".into())
                }
            ),
            Ok(ConfigQueueRoleOutcome::Saved {
                setting: ConfigQueueRoleSetting::Priority,
                role_id: Some("456".into())
            })
        );
        let config = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        assert_eq!(config.blocked_role_id.as_deref(), Some("123"));
        assert_eq!(config.priority_role_id.as_deref(), Some("456"));
    }
}
