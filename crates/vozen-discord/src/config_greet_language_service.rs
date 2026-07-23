//! SQLite-backed service for the join-greeting locale.

use crate::ConfigGreetLanguageCommand;
use std::sync::{Arc, Mutex};
use vozen_store::{GuildConfigPatch, SqliteStore};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigGreetLanguageOutcome {
    Saved { locale: String },
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigGreetLanguageFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigGreetLanguageInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
    pub locale_supported: bool,
}

pub struct ConfigGreetLanguageService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigGreetLanguageService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }
    pub fn execute(
        &self,
        invocation: ConfigGreetLanguageInvocation<'_>,
        command: ConfigGreetLanguageCommand,
    ) -> Result<ConfigGreetLanguageOutcome, ConfigGreetLanguageFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigGreetLanguageFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigGreetLanguageFailure::GuildRequired);
        };
        if !invocation.locale_supported {
            return Ok(ConfigGreetLanguageOutcome::Unsupported);
        }
        self.store
            .lock()
            .map_err(|_| ConfigGreetLanguageFailure::StoreUnavailable)?
            .update_guild_config(
                guild_id,
                GuildConfigPatch {
                    greet_locale: Some(command.locale.clone()),
                    ..Default::default()
                },
            )
            .map(|_| ConfigGreetLanguageOutcome::Saved {
                locale: command.locale,
            })
            .map_err(|_| ConfigGreetLanguageFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_locale_and_authorization_before_writing() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigGreetLanguageService::new(store.clone());
        let command = ConfigGreetLanguageCommand {
            locale: "pt".into(),
        };
        assert!(matches!(
            service.execute(
                ConfigGreetLanguageInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false,
                    locale_supported: true
                },
                command.clone()
            ),
            Err(ConfigGreetLanguageFailure::NeedsManageGuild)
        ));
        assert_eq!(
            service.execute(
                ConfigGreetLanguageInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                    locale_supported: false
                },
                command.clone()
            ),
            Ok(ConfigGreetLanguageOutcome::Unsupported)
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .guild_config("guild")
                .expect("config")
                .greet_locale,
            "en"
        );
        assert_eq!(
            service.execute(
                ConfigGreetLanguageInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: true,
                    locale_supported: true
                },
                command
            ),
            Ok(ConfigGreetLanguageOutcome::Saved {
                locale: "pt".into()
            })
        );
    }
}
