//! SQLite-backed service for the numeric guild limits.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::{ConfigNumericCommand, ConfigNumericSetting};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigNumericOutcome {
    Saved {
        setting: ConfigNumericSetting,
        value: i64,
    },
    OutOfRange {
        setting: ConfigNumericSetting,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigNumericFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigNumericInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

pub struct ConfigNumericService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigNumericService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigNumericInvocation<'_>,
        command: ConfigNumericCommand,
    ) -> Result<ConfigNumericOutcome, ConfigNumericFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigNumericFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigNumericFailure::GuildRequired);
        };
        let patch = match command.setting {
            ConfigNumericSetting::MaxChars if (1..=2_000).contains(&command.value) => {
                GuildConfigPatch {
                    max_chars: Some(command.value),
                    ..Default::default()
                }
            }
            ConfigNumericSetting::RateLimit if (1..=120).contains(&command.value) => {
                GuildConfigPatch {
                    rate_per_min: Some(command.value),
                    ..Default::default()
                }
            }
            _ => {
                return Ok(ConfigNumericOutcome::OutOfRange {
                    setting: command.setting,
                });
            }
        };
        self.store
            .lock()
            .map_err(|_| ConfigNumericFailure::StoreUnavailable)?
            .update_guild_config(guild_id, patch)
            .map(|_| ConfigNumericOutcome::Saved {
                setting: command.setting,
                value: command.value,
            })
            .map_err(|_| ConfigNumericFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_ranges_before_persisting_and_preserves_other_limits() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigNumericService::new(store.clone());
        let invocation = ConfigNumericInvocation {
            guild_id: Some("guild"),
            can_manage_guild: true,
        };
        assert_eq!(
            service.execute(
                invocation,
                ConfigNumericCommand {
                    setting: ConfigNumericSetting::MaxChars,
                    value: 0
                },
            ),
            Ok(ConfigNumericOutcome::OutOfRange {
                setting: ConfigNumericSetting::MaxChars
            })
        );
        let before = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        assert_eq!(before.max_chars, 300);
        assert_eq!(
            service.execute(
                invocation,
                ConfigNumericCommand {
                    setting: ConfigNumericSetting::RateLimit,
                    value: 30
                },
            ),
            Ok(ConfigNumericOutcome::Saved {
                setting: ConfigNumericSetting::RateLimit,
                value: 30
            })
        );
        let after = store
            .lock()
            .expect("store")
            .guild_config("guild")
            .expect("config");
        assert_eq!(after.rate_per_min, 30);
        assert_eq!(after.max_chars, 300);
    }
}
