//! SQLite-backed service for the guild default voice.

use std::sync::{Arc, Mutex};

use vozen_store::{GuildConfigPatch, SqliteStore};

use crate::ConfigDefaultVoiceCommand;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigDefaultVoiceOutcome {
    Saved { model: String },
    UnknownModel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigDefaultVoiceFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}

#[derive(Debug, Clone, Copy)]
pub struct ConfigDefaultVoiceInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}

#[derive(Debug, Clone)]
pub struct ConfigDefaultVoiceSettings {
    pub available_models: Vec<String>,
}

pub struct ConfigDefaultVoiceService {
    store: Arc<Mutex<SqliteStore>>,
    settings: ConfigDefaultVoiceSettings,
}

impl ConfigDefaultVoiceService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>, settings: ConfigDefaultVoiceSettings) -> Self {
        Self { store, settings }
    }

    pub fn execute(
        &self,
        invocation: ConfigDefaultVoiceInvocation<'_>,
        command: ConfigDefaultVoiceCommand,
    ) -> Result<ConfigDefaultVoiceOutcome, ConfigDefaultVoiceFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigDefaultVoiceFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigDefaultVoiceFailure::GuildRequired);
        };
        if !self
            .settings
            .available_models
            .iter()
            .any(|model| model == &command.model)
        {
            return Ok(ConfigDefaultVoiceOutcome::UnknownModel);
        }
        self.store
            .lock()
            .map_err(|_| ConfigDefaultVoiceFailure::StoreUnavailable)?
            .update_guild_config(
                guild_id,
                GuildConfigPatch {
                    default_voice: Some(command.model.clone()),
                    ..Default::default()
                },
            )
            .map(|_| ConfigDefaultVoiceOutcome::Saved {
                model: command.model,
            })
            .map_err(|_| ConfigDefaultVoiceFailure::StoreUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_model_and_authorization_before_writing() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigDefaultVoiceService::new(
            store.clone(),
            ConfigDefaultVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
            },
        );
        let invocation = ConfigDefaultVoiceInvocation {
            guild_id: Some("guild"),
            can_manage_guild: true,
        };
        assert_eq!(
            service.execute(
                invocation,
                ConfigDefaultVoiceCommand {
                    model: "missing".into()
                }
            ),
            Ok(ConfigDefaultVoiceOutcome::UnknownModel)
        );
        assert_eq!(
            store
                .lock()
                .expect("store")
                .guild_config("guild")
                .expect("config")
                .default_voice,
            ""
        );
        assert_eq!(
            service.execute(
                invocation,
                ConfigDefaultVoiceCommand {
                    model: "en_US-amy-medium".into()
                }
            ),
            Ok(ConfigDefaultVoiceOutcome::Saved {
                model: "en_US-amy-medium".into()
            })
        );
        assert!(matches!(
            service.execute(
                ConfigDefaultVoiceInvocation {
                    guild_id: Some("guild"),
                    can_manage_guild: false
                },
                ConfigDefaultVoiceCommand {
                    model: "en_US-amy-medium".into()
                },
            ),
            Err(ConfigDefaultVoiceFailure::NeedsManageGuild)
        ));
    }
}
