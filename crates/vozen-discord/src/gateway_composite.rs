//! Composition for independently promoted gateway slices.
//!
//! Each slice still validates and claims only its own Discord events. Dispatching all sinks is
//! safe because a handler must leave unpromoted events untouched; this allows private exports to
//! be promoted without coupling them to in-call Songbird playback.

use std::sync::Arc;

use async_trait::async_trait;
use serenity::{client::Context, model::application::Interaction};

use crate::{GatewayEventDispatchError, GatewayEventSink};

pub struct CompositeGatewayEventSink {
    sinks: Vec<Arc<dyn GatewayEventSink>>,
}

impl CompositeGatewayEventSink {
    #[must_use]
    pub fn new(sinks: Vec<Arc<dyn GatewayEventSink>>) -> Self {
        Self { sinks }
    }
}

#[async_trait]
impl GatewayEventSink for CompositeGatewayEventSink {
    async fn on_ready(&self, context: Context) -> Result<(), GatewayEventDispatchError> {
        for sink in &self.sinks {
            sink.on_ready(context.clone()).await?;
        }
        Ok(())
    }

    async fn on_entitlement_change(
        &self,
        context: Context,
    ) -> Result<(), GatewayEventDispatchError> {
        for sink in &self.sinks {
            sink.on_entitlement_change(context.clone()).await?;
        }
        Ok(())
    }

    async fn on_guild_create(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        for sink in &self.sinks {
            sink.on_guild_create(guild_id).await?;
        }
        Ok(())
    }

    async fn on_message(
        &self,
        context: Context,
        message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        for sink in &self.sinks {
            sink.on_message(context.clone(), message.clone()).await?;
        }
        Ok(())
    }

    async fn on_interaction(
        &self,
        context: Context,
        interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        for sink in &self.sinks {
            sink.on_interaction(context.clone(), interaction.clone())
                .await?;
        }
        Ok(())
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        for sink in &self.sinks {
            sink.on_guild_delete(guild_id).await?;
        }
        Ok(())
    }
}
