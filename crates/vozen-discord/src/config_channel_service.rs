//! SQLite-backed service for the configured auto-read text channel.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::ConfigChannelCommand;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigChannelOutcome {
    Saved { channel_id: u64 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigChannelFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigChannelInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigChannelService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigChannelService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigChannelInvocation<'_>,
        command: ConfigChannelCommand,
    ) -> Result<ConfigChannelOutcome, ConfigChannelFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigChannelFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigChannelFailure::GuildRequired);
        };
        self.store
            .lock()
            .map_err(|_| ConfigChannelFailure::StoreUnavailable)?
            .update_guild_config(
                guild_id,
                GuildConfigPatch {
                    tts_channel_id: Some(Some(command.channel_id.to_string())),
                    ..Default::default()
                },
            )
            .map(|_| ConfigChannelOutcome::Saved {
                channel_id: command.channel_id,
            })
            .map_err(|_| ConfigChannelFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_only_the_channel_and_requires_manage_guild() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigChannelService::new(store.clone());
        let invocation = ConfigChannelInvocation {
            guild_id: Some("guild"),
            can_manage_guild: true,
        };
        assert_eq!(
            service.execute(invocation, ConfigChannelCommand { channel_id: 123 }),
            Ok(ConfigChannelOutcome::Saved { channel_id: 123 })
        );
        let config = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        assert_eq!(config.tts_channel_id.as_deref(), Some("123"));
        assert!(!config.autoread);
        assert!(matches!(
            service.execute(
                ConfigChannelInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false
                },
                ConfigChannelCommand { channel_id: 124 },
            ),
            Err(ConfigChannelFailure::NeedsManageGuild)
        ));
    }
}
