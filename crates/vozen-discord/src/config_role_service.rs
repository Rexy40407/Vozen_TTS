//! SQLite-backed service for the auto-read role restriction.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::ConfigRoleCommand;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigRoleOutcome {
    Saved { role_id: Option<String> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigRoleFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigRoleInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigRoleService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigRoleService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigRoleInvocation<'_>,
        command: ConfigRoleCommand,
    ) -> Result<ConfigRoleOutcome, ConfigRoleFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigRoleFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigRoleFailure::GuildRequired);
        };
        self.store
            .lock()
            .map_err(|_| ConfigRoleFailure::StoreUnavailable)?
            .update_guild_config(
                guild_id,
                GuildConfigPatch {
                    tts_role_id: Some(command.role_id.clone()),
                    ..Default::default()
                },
            )
            .map(|_| ConfigRoleOutcome::Saved {
                role_id: command.role_id,
            })
            .map_err(|_| ConfigRoleFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_and_clears_only_the_tts_role_and_requires_manage_guild() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigRoleService::new(store.clone());
        let invocation = ConfigRoleInvocation {
            guild_id: Some("guild"),
            can_manage_guild: true,
        };
        assert_eq!(
            service.execute(
                invocation,
                ConfigRoleCommand {
                    role_id: Some("123".into())
                },
            ),
            Ok(ConfigRoleOutcome::Saved {
                role_id: Some("123".into())
            })
        );
        let configured = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        assert_eq!(configured.tts_role_id.as_deref(), Some("123"));
        assert_eq!(configured.max_chars, 300);
        assert_eq!(
            service.execute(invocation, ConfigRoleCommand { role_id: None }),
            Ok(ConfigRoleOutcome::Saved { role_id: None })
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .guild_config("guild")
                .expect("config")
                .tts_role_id,
            None
        );
        assert!(matches!(
            service.execute(
                ConfigRoleInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false
                },
                ConfigRoleCommand {
                    role_id: Some("123".into())
                },
            ),
            Err(ConfigRoleFailure::NeedsManageGuild)
        ));
    }
}
