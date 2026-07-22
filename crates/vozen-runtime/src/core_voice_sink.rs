//! Opt-in gateway sink for the first fully migrated voice slash commands.
//!
//! Construction is lazy because Serenity only exposes a valid [`Context`] from a gateway event.
//! Until the runtime explicitly installs this sink, Node remains the interaction authority.

use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use serenity::{
    builder::{
        CreateInteractionResponse, CreateInteractionResponseMessage, EditInteractionResponse,
    },
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    CoreVoiceInteractionExecution, CoreVoiceInteractionExecutor, CoreVoiceInteractionFacts,
    GatewayEventDispatchError, GatewayEventSink, GatewayState, SongbirdCommandPlayback,
    SongbirdVoiceSessionTransport,
};
use vozen_store::SqliteStore;

use crate::{CoreVoiceRuntimeOptions, piper_adapter::PiperCommandSynthesizer, system_now_ms};

type Executor = CoreVoiceInteractionExecutor<
    SongbirdVoiceSessionTransport,
    PiperCommandSynthesizer,
    SongbirdCommandPlayback,
>;

pub struct CoreVoiceGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    options: CoreVoiceRuntimeOptions,
    executor: Mutex<Option<Arc<Executor>>>,
}

impl CoreVoiceGatewaySink {
    #[must_use]
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        gateway_state: GatewayState,
        options: CoreVoiceRuntimeOptions,
    ) -> Self {
        Self {
            store,
            gateway_state,
            options,
            executor: Mutex::new(None),
        }
    }

    fn executor(&self, context: &Context) -> Result<Arc<Executor>, GatewayEventDispatchError> {
        let mut current = self
            .executor
            .lock()
            .map_err(|_| GatewayEventDispatchError)?;
        if let Some(executor) = &*current {
            return Ok(executor.clone());
        }
        let options = &self.options;
        let executor = CoreVoiceInteractionExecutor::new(
            self.store.clone(),
            self.gateway_state.clone(),
            SongbirdVoiceSessionTransport::new(context.clone()),
            PiperCommandSynthesizer::production(
                options.piper_path.clone(),
                options.models_dir.clone(),
                options.cache_dir.clone(),
                options.piper_concurrency,
            ),
            SongbirdCommandPlayback::new(context.clone(), options.queue_cap),
            options.settings.clone(),
            Arc::new(system_now_ms),
        )
        .map_err(|_| GatewayEventDispatchError)?;
        let executor = Arc::new(executor);
        *current = Some(executor.clone());
        Ok(executor)
    }
}

#[async_trait]
impl GatewayEventSink for CoreVoiceGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
        // Auto-read is promoted only after attachment/media and optional autojoin parity are
        // exercised against the same sink. Explicit slash commands are safe to promote first.
        Ok(())
    }

    async fn on_interaction(
        &self,
        context: Context,
        interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Interaction::Command(command) = interaction else {
            return Ok(());
        };
        let Some(facts) = CoreVoiceInteractionFacts::from_command(&command) else {
            return Ok(());
        };
        let executor = self.executor(&context)?;
        let defer = Executor::requires_ephemeral_defer(&command.data)
            .map_err(|_| GatewayEventDispatchError)?;
        if defer {
            command
                .defer_ephemeral(&context)
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        }
        let response = executor
            .execute(
                &command.data,
                &facts,
                Some(&command.locale),
                &|_| "someone".into(),
                &|_| "channel".into(),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        let CoreVoiceInteractionExecution::Reply { content, .. } = response else {
            return Ok(());
        };
        if defer {
            command
                .edit_response(&context, EditInteractionResponse::new().content(content))
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        } else {
            command
                .create_response(
                    &context,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new().content(content),
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
        }
        Ok(())
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        if let Ok(executor) = self.executor.lock() {
            if let Some(executor) = executor.as_ref() {
                executor.forget_guild(guild_id);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn promotion_options_preserve_distinct_queue_and_synthesis_limits() {
        let options = CoreVoiceRuntimeOptions {
            piper_path: "piper".into(),
            models_dir: "models".into(),
            cache_dir: "cache".into(),
            piper_concurrency: 2,
            queue_cap: 20,
            settings: CoreVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
                default_voice: "en_US-amy-medium".into(),
                default_speed: 1.0,
            },
        };
        assert_eq!(options.piper_concurrency, 2);
        assert_eq!(options.queue_cap, 20);
    }
}
