use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use serenity::all::{Context, Interaction, Message};
use vozen_discord::{GatewayEventDispatchError, GatewayEventSink};
use vozen_store::SqliteStore;

pub struct GuildLifecycleGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
}

impl GuildLifecycleGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Self {
        Self { store }
    }
}

#[async_trait]
impl GatewayEventSink for GuildLifecycleGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: Message,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_interaction(
        &self,
        _context: Context,
        _interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_guild_create(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        let Ok(store) = self.store.lock() else {
            return Err(GatewayEventDispatchError);
        };
        store
            .unmark_guild_departed(guild_id)
            .map_err(|_| GatewayEventDispatchError)
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        let Ok(store) = self.store.lock() else {
            return Err(GatewayEventDispatchError);
        };
        store
            .mark_guild_departed(guild_id, now_ms())
            .map_err(|_| GatewayEventDispatchError)
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}
