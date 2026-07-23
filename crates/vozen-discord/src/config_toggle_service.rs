//! SQLite-backed service for boolean guild configuration leaves.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::{ConfigToggle, ConfigToggleCommand};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigToggleOutcome {
    pub toggle: ConfigToggle,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigToggleFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

pub struct ConfigToggleInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigToggleService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigToggleService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigToggleInvocation<'_>,
        command: ConfigToggleCommand,
    ) -> Result<ConfigToggleOutcome, ConfigToggleFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigToggleFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigToggleFailure::GuildRequired);
        };
        let patch = match command.toggle {
            ConfigToggle::AutoRead => GuildConfigPatch {
                autoread: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::Enabled => GuildConfigPatch {
                enabled: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::Xsaid => GuildConfigPatch {
                xsaid: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::AutoJoin => GuildConfigPatch {
                autojoin: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::AlwaysOn => GuildConfigPatch {
                stay_in_call: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::ReadBots => GuildConfigPatch {
                read_bots: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::TextInVoice => GuildConfigPatch {
                text_in_voice: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::AntiSpam => GuildConfigPatch {
                antispam: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::Streaks => GuildConfigPatch {
                streak_announce: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::Soundboard => GuildConfigPatch {
                soundboard: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::VoteReminders => GuildConfigPatch {
                vote_promos: Some(command.enabled),
                ..Default::default()
            },
            ConfigToggle::Greet => GuildConfigPatch {
                greet_on_join: Some(command.enabled),
                ..Default::default()
            },
        };
        self.store
            .lock()
            .map_err(|_| ConfigToggleFailure::StoreUnavailable)?
            .update_guild_config(guild_id, patch)
            .map(|_| ConfigToggleOutcome {
                toggle: command.toggle,
                enabled: command.enabled,
            })
            .map_err(|_| ConfigToggleFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toggle_updates_only_its_setting_and_requires_manage_server() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigToggleService::new(store.clone());
        let command = ConfigToggleCommand {
            toggle: ConfigToggle::AutoRead,
            enabled: true,
        };
        assert_eq!(
            service.execute(
                ConfigToggleInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false
                },
                command,
            ),
            Err(ConfigToggleFailure::NeedsManageGuild)
        );
        let before = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        let result = service
            .execute(
                ConfigToggleInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                },
                command,
            )
            .expect("saved");
        assert!(result.enabled);
        let after = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        assert!(after.autoread);
        assert_eq!(after.max_chars, before.max_chars);
        assert_eq!(after.locale, before.locale);
    }
}
