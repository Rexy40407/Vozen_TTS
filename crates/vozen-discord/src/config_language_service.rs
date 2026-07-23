//! SQLite-backed service for the `/config language` guild setting.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::ConfigLanguageCommand;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigLanguageOutcome {
    Saved { locale: String },
    Unsupported,
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

pub struct ConfigLanguageInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
    pub locale_supported: bool,
}

pub struct ConfigLanguageService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigLanguageService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }

    pub fn execute(
        &self,
        invocation: ConfigLanguageInvocation<'_>,
        command: ConfigLanguageCommand,
    ) -> ConfigLanguageOutcome {
        if !invocation.can_manage_guild {
            return ConfigLanguageOutcome::NeedsManageGuild;
        }
        let Some(guild_id) = invocation.guild_id else {
            return ConfigLanguageOutcome::GuildRequired;
        };
        if !invocation.locale_supported {
            return ConfigLanguageOutcome::Unsupported;
        }
        match self.store.lock() {
            Ok(store) => match store.update_guild_config(
                guild_id,
                GuildConfigPatch {
                    locale: Some(command.locale.clone()),
                    ..GuildConfigPatch::default()
                },
            ) {
                Ok(_) => ConfigLanguageOutcome::Saved {
                    locale: command.locale,
                },
                Err(_) => ConfigLanguageOutcome::StoreUnavailable,
            },
            Err(_) => ConfigLanguageOutcome::StoreUnavailable,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorization_and_locale_validation_happen_before_writes() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigLanguageService::new(store.clone());
        let command = ConfigLanguageCommand {
            locale: "pt".into(),
        };
        assert_eq!(
            service.execute(
                ConfigLanguageInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false,
                    locale_supported: true,
                },
                command.clone(),
            ),
            ConfigLanguageOutcome::NeedsManageGuild
        );
        assert_eq!(
            service.execute(
                ConfigLanguageInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                    locale_supported: false,
                },
                command.clone(),
            ),
            ConfigLanguageOutcome::Unsupported
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .guild_config("guild")
                .expect("config")
                .locale,
            "en"
        );
        assert_eq!(
            service.execute(
                ConfigLanguageInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                    locale_supported: true,
                },
                command,
            ),
            ConfigLanguageOutcome::Saved {
                locale: "pt".into()
            }
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .guild_config("guild")
                .expect("config")
                .locale,
            "pt"
        );
    }
}
