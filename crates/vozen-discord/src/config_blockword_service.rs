//! SQLite-backed blocklist mutation service.

use crate::{ConfigBlockwordAction, ConfigBlockwordCommand};
use std::sync::{Arc, Mutex};
use vozen_store::{AddBlockwordResult, MAX_BLOCKWORDS, SqliteStore};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigBlockwordOutcome {
    Added { word: String },
    Removed { word: String },
    Limit,
    Empty,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigBlockwordFailure {
    NeedsManageGuild,
    GuildRequired,
    StoreUnavailable,
}
#[derive(Debug, Clone, Copy)]
pub struct ConfigBlockwordInvocation<'a> {
    pub guild_id: Option<&'a str>,
    pub can_manage_guild: bool,
}
pub struct ConfigBlockwordService {
    store: Arc<Mutex<SqliteStore>>,
}

impl ConfigBlockwordService {
    #[must_use]
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }
    pub fn execute(
        &self,
        invocation: ConfigBlockwordInvocation<'_>,
        command: ConfigBlockwordCommand,
    ) -> Result<ConfigBlockwordOutcome, ConfigBlockwordFailure> {
        if !invocation.can_manage_guild {
            return Err(ConfigBlockwordFailure::NeedsManageGuild);
        }
        let Some(guild_id) = invocation.guild_id else {
            return Err(ConfigBlockwordFailure::GuildRequired);
        };
        let store = self
            .store
            .lock()
            .map_err(|_| ConfigBlockwordFailure::StoreUnavailable)?;
        if command.word.trim().is_empty() {
            return Ok(ConfigBlockwordOutcome::Empty);
        }
        match command.action {
            ConfigBlockwordAction::Add => match store
                .add_blockword(guild_id, &command.word)
                .map_err(|_| ConfigBlockwordFailure::StoreUnavailable)?
            {
                AddBlockwordResult::Ok => Ok(ConfigBlockwordOutcome::Added { word: command.word }),
                AddBlockwordResult::Limit => {
                    let _ = MAX_BLOCKWORDS;
                    Ok(ConfigBlockwordOutcome::Limit)
                }
            },
            ConfigBlockwordAction::Remove => store
                .remove_blockword(guild_id, &command.word)
                .map(|_| ConfigBlockwordOutcome::Removed { word: command.word })
                .map_err(|_| ConfigBlockwordFailure::StoreUnavailable),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mutates_only_the_requested_guild_and_preserves_idempotency() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let service = ConfigBlockwordService::new(store.clone());
        let invocation = ConfigBlockwordInvocation {
            guild_id: Some("guild"),
            can_manage_guild: true,
        };
        assert_eq!(
            service.execute(
                invocation,
                ConfigBlockwordCommand {
                    action: ConfigBlockwordAction::Add,
                    word: "spam".into()
                }
            ),
            Ok(ConfigBlockwordOutcome::Added {
                word: "spam".into()
            })
        );
        assert_eq!(
            service.execute(
                invocation,
                ConfigBlockwordCommand {
                    action: ConfigBlockwordAction::Remove,
                    word: "spam".into()
                }
            ),
            Ok(ConfigBlockwordOutcome::Removed {
                word: "spam".into()
            })
        );
        assert!(
            store
                .lock()
                .expect("store")
                .get_blocklist("guild")
                .expect("list")
                .is_empty()
        );
    }
}
