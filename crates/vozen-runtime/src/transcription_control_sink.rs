//! Opt-in gateway adapter for `/transcribe revoke`.
//!
//! This leaf only withdraws the invoking user's consent row. It deliberately does not start or
//! stop a voice receiver; those live-session operations remain Node-owned until receiver parity
//! exists in Rust.

use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{Arc, Mutex, RwLock},
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

/// Process-local consent cache read by the 20 ms Songbird receiver. The audio callback never
/// touches SQLite; lifecycle/interaction handlers refresh this cache outside the audio thread.
#[derive(Clone, Default)]
pub struct SttConsentRegistry {
    by_guild: Arc<RwLock<BTreeMap<String, BTreeSet<u64>>>>,
}

impl SttConsentRegistry {
    #[cfg(feature = "voice-driver")]
    pub fn is_consented(&self, guild_id: &str, user_id: u64) -> bool {
        self.by_guild.read().ok().is_some_and(|all| {
            all.get(guild_id)
                .is_some_and(|users| users.contains(&user_id))
        })
    }

    #[cfg(feature = "voice-driver")]
    pub fn grant(&self, guild_id: &str, user_id: u64) {
        if let Ok(mut all) = self.by_guild.write() {
            all.entry(guild_id.to_owned()).or_default().insert(user_id);
        }
    }

    pub fn revoke(&self, guild_id: &str, user_id: u64) {
        if let Ok(mut all) = self.by_guild.write()
            && let Some(users) = all.get_mut(guild_id)
        {
            users.remove(&user_id);
            if users.is_empty() {
                all.remove(guild_id);
            }
        }
    }

    #[cfg(feature = "voice-driver")]
    pub fn clear_guild(&self, guild_id: &str) {
        if let Ok(mut all) = self.by_guild.write() {
            all.remove(guild_id);
        }
    }
}

pub struct TranscriptionControlGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
    consent_registry: SttConsentRegistry,
}

impl TranscriptionControlGatewaySink {
    pub fn new_with_registry(
        store: Arc<Mutex<SqliteStore>>,
        consent_registry: SttConsentRegistry,
    ) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            consent_registry,
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
        if revoked {
            self.consent_registry
                .revoke(&guild_id, command.user.id.get());
        }
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
