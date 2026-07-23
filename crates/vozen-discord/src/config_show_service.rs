//! SQLite-backed read-only service for `/config show`.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfig, SqliteStore};

use crate::ConfigShowCommand;

#[derive(Debug, Clone, PartialEq)]
pub struct ConfigShowOutcome {
    pub config: GuildConfig,
    pub blocklist_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigShowFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigShowInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigShowService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigShowService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigShowInvocation<'_>,
        _command: ConfigShowCommand,
    ) -> Result<ConfigShowOutcome, ConfigShowFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigShowFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigShowFailure::GuildRequired);
        };
        let store = self
            .store
            .lock()
            .map_err(|_| ConfigShowFailure::StoreUnavailable)?;
        let config = store
            .guild_config(guild_id)
            .map_err(|_| ConfigShowFailure::StoreUnavailable)?;
        let blocklist_count = store
            .get_blocklist(guild_id)
            .map_err(|_| ConfigShowFailure::StoreUnavailable)?
            .len();
        Ok(ConfigShowOutcome {
            config,
            blocklist_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_current_config_and_blocklist_without_writing() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        store
            .lock()
            .expect("store")
            .add_blockword("guild", "spam")
            .expect("blockword");
        let service = ConfigShowService::new(store.clone());
        let result = service
            .execute(
                ConfigShowInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                },
                ConfigShowCommand,
            )
            .expect("show");
        assert_eq!(result.config, GuildConfig::default());
        assert_eq!(result.blocklist_count, 1);
        assert!(matches!(
            service.execute(
                ConfigShowInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false,
                },
                ConfigShowCommand,
            ),
            Err(ConfigShowFailure::NeedsManageGuild)
        ));
    }
}
