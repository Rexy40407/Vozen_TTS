//! Opt-in gateway adapter for `/transcribe revoke`.
//!
//! This leaf only withdraws the invoking user's consent row. It deliberately does not start or
//! stop a voice receiver; those live-session operations remain Node-owned until receiver parity
//! exists in Rust.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_transcription_control_command,
};
use vozen_store::SqliteStore;

pub struct TranscriptionControlGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
}

impl TranscriptionControlGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            return self
                .localizer
                .render_key(
                    "stt.guildOnly",
                    Some(&command.locale),
                    command.guild_locale.as_deref(),
                    &BTreeMap::new(),
                )
                .ok_or(GatewayEventDispatchError);
        };
        let user_id = command.user.id.get().to_string();
        let guild_id = guild_id.get().to_string();
        let revoked = self
            .store
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .revoke_stt_consent(&user_id, &guild_id)
            .map_err(|_| GatewayEventDispatchError)?;
        let key = if revoked {
            "stt.revoked"
        } else {
            "stt.revokeNone"
        };
        self.localizer
            .render_key(
                key,
                Some(&command.locale),
                command.guild_locale.as_deref(),
                &BTreeMap::new(),
            )
            .ok_or(GatewayEventDispatchError)
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for TranscriptionControlGatewaySink {
    async fn on_message(
        &self,
        _context: Context,
        _message: serenity::model::channel::Message,
    ) -> Result<(), GatewayEventDispatchError> {
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
        let Some(_) = parse_transcription_control_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let response = CreateInteractionResponseMessage::new()
            .content(self.response(&command)?)
            .ephemeral(true);
        command
            .create_response(&context, CreateInteractionResponse::Message(response))
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}
