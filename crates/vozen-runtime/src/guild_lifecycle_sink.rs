use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use serenity::all::{Context, Interaction, Message};
use vozen_discord::{GatewayEventDispatchError, GatewayEventSink};
use vozen_store::{OperationalMetric, OperationalProvider, ProviderHealth, SqliteStore};

use crate::topgg_metrics::TopggMetricsTrigger;

pub struct GuildLifecycleGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    topgg_trigger: Option<TopggMetricsTrigger>,
}

impl GuildLifecycleGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>, topgg_trigger: Option<TopggMetricsTrigger>) -> Self {
        Self {
            store,
            topgg_trigger,
        }
    }
}

#[async_trait]
impl GatewayEventSink for GuildLifecycleGatewaySink {
    async fn on_ready(&self, _context: Context) -> Result<(), GatewayEventDispatchError> {
        let Ok(store) = self.store.lock() else {
            return Err(GatewayEventDispatchError);
        };
        store
            .set_provider_health(
                OperationalProvider::Internal,
                ProviderHealth::Healthy,
                now_ms(),
            )
            .map_err(|_| GatewayEventDispatchError)
    }

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
        let now = now_ms();
        store
            .unmark_guild_departed(guild_id)
            .map_err(|_| GatewayEventDispatchError)?;
        let joined = store
            .record_guild_join(guild_id, None, now)
            .map_err(|_| GatewayEventDispatchError)?;
        if joined {
            store
                .add_operational_metric(
                    OperationalMetric::GuildJoin,
                    OperationalProvider::Internal,
                    1.0,
                    None,
                )
                .map_err(|_| GatewayEventDispatchError)?;
            if let Some(trigger) = &self.topgg_trigger {
                trigger.request_sync();
            }
        }
        Ok(())
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        let Ok(store) = self.store.lock() else {
            return Err(GatewayEventDispatchError);
        };
        let now = now_ms();
        store
            .mark_guild_departed(guild_id, now)
            .map_err(|_| GatewayEventDispatchError)?;
        if store
            .record_guild_departure(guild_id, now)
            .map_err(|_| GatewayEventDispatchError)?
        {
            store
                .add_operational_metric(
                    OperationalMetric::GuildLeave,
                    OperationalProvider::Internal,
                    1.0,
                    None,
                )
                .map_err(|_| GatewayEventDispatchError)?;
            if let Some(trigger) = &self.topgg_trigger {
                trigger.request_sync();
            }
        }
        Ok(())
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}
