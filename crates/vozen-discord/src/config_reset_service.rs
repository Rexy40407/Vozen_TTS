//! SQLite-backed service for resetting a guild's configuration scope.

use std::sync::{Arc, Mutex};

use crate::ConfigResetCommand;
use vozen_store::SqliteStore;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigResetOutcome;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigResetFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigResetInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigResetService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigResetService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigResetInvocation<'_>,
        _command: ConfigResetCommand,
    ) -> Result<ConfigResetOutcome, ConfigResetFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigResetFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigResetFailure::GuildRequired);
        };
        let store = self
            .store
            .lock()
            .map_err(|_| ConfigResetFailure::StoreUnavailable)?;
        store
            .reset_guild_config(guild_id)
            .map_err(|_| ConfigResetFailure::StoreUnavailable)?;
        store
            .clear_translation_config(guild_id)
            .map_err(|_| ConfigResetFailure::StoreUnavailable)?;
        Ok(ConfigResetOutcome)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vozen_store::{GuildConfigPatch, TranslationMapping, TranslationPreferencePatch};

    #[test]
    fn resets_guild_config_and_translation_scope_only_after_authorization() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        {
            let guard = store.lock().expect("store");
            guard
                .update_guild_config(
                    "guild",
                    GuildConfigPatch {
                        autoread: Some(true),
                        ..Default::default()
                    },
                )
                .expect("config");
            guard
                .upsert_translation_mapping(&TranslationMapping {
                    guild_id: "guild".into(),
                    source_channel_id: "source".into(),
                    destination_channel_id: "destination".into(),
                    target_locale: "pt".into(),
                })
                .expect("mapping");
            guard
                .update_translation_preference(
                    "guild",
                    "user",
                    TranslationPreferencePatch {
                        opted_out: Some(true),
                        ..Default::default()
                    },
                )
                .expect("preference");
        }
        let service = ConfigResetService::new(store.clone());
        assert!(matches!(
            service.execute(
                ConfigResetInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false,
                },
                ConfigResetCommand,
            ),
            Err(ConfigResetFailure::NeedsManageGuild)
        ));
        service
            .execute(
                ConfigResetInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                },
                ConfigResetCommand,
            )
            .expect("reset");
        let guard = store.lock().expect("store");
        assert!(!guard.guild_config("guild").expect("config").autoread);
        assert!(
            guard
                .translation_mappings("guild")
                .expect("mappings")
                .is_empty()
        );
        assert!(
            !guard
                .translation_preference("guild", "user")
                .expect("preference")
                .opted_out
        );
    }
}
