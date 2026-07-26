//! Opt-in gateway adapter for `/config default-voice`.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use crate::ui::message_embed;
use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::{Permissions, application::Interaction},
};
use vozen_discord::{
    ConfigDefaultVoiceFailure, ConfigDefaultVoiceInvocation, ConfigDefaultVoiceOutcome,
    ConfigDefaultVoiceService, ConfigDefaultVoiceSettings, GatewayEventDispatchError,
    GatewayEventSink, VoiceDisplayCatalog, VoiceResponseLocalizer,
    parse_config_default_voice_command,
};
use vozen_store::SqliteStore;

pub struct ConfigDefaultVoiceGatewaySink {
    service: ConfigDefaultVoiceService,
    localizer: VoiceResponseLocalizer,
    displays: VoiceDisplayCatalog,
    available_models: Vec<String>,
}

impl ConfigDefaultVoiceGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        settings: ConfigDefaultVoiceSettings,
    ) -> Result<Self, GatewayEventDispatchError> {
        let available_models = settings.available_models.clone();
        Ok(Self {
            service: ConfigDefaultVoiceService::new(store, settings),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            displays: VoiceDisplayCatalog::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
            available_models,
        })
    }

    fn message(
        &self,
        key: &str,
        command: &serenity::model::application::CommandInteraction,
        parameters: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(
                key,
                Some(&command.locale),
                command.guild_locale.as_deref(),
                parameters,
            )
            .ok_or(GatewayEventDispatchError)
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
        outcome: Result<ConfigDefaultVoiceOutcome, ConfigDefaultVoiceFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match outcome {
            Ok(outcome) => outcome,
            Err(
                ConfigDefaultVoiceFailure::NeedsManageGuild
                | ConfigDefaultVoiceFailure::GuildRequired,
            ) => {
                return self.message("error.needManageGuild", command, &BTreeMap::new());
            }
            Err(ConfigDefaultVoiceFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        match outcome {
            ConfigDefaultVoiceOutcome::UnknownModel => {
                self.message("voice.unknownModel", command, &BTreeMap::new())
            }
            ConfigDefaultVoiceOutcome::Saved { model } => {
                let mut parameters = BTreeMap::new();
                parameters.insert(
                    "name",
                    self.displays
                        .voice_name(Some(&command.locale), &self.available_models, &model),
                );
                parameters.insert("model", model);
                self.message("config.defaultVoiceSet", command, &parameters)
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigDefaultVoiceGatewaySink {
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
        let Some(parsed) = parse_config_default_voice_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let outcome = self.service.execute(
            ConfigDefaultVoiceInvocation {
                guild_id: guild_id.as_deref(),
                can_manage_guild,
            },
            parsed,
        );
        let content = self.response(&command, outcome)?;
        command
            .create_response(
                &context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .embeds(vec![message_embed(content)])
                        .ephemeral(true),
                ),
            )
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn on_guild_delete(&self, _guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn responses_localize_unknown_and_saved_model_outcomes() {
        let sink = ConfigDefaultVoiceGatewaySink::new(
            Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store"))),
            ConfigDefaultVoiceSettings {
                available_models: vec!["en_US-amy-medium".into()],
            },
        )
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"default-voice","type":1,"options":[{"name":"model","type":3,"value":"en_US-amy-medium"}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                Ok(ConfigDefaultVoiceOutcome::Saved {
                    model: "en_US-amy-medium".into(),
                }),
            )
            .expect("response");
        assert!(content.contains("Amy"));
    }
}
