//! Opt-in gateway adapter for `/config reset`.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::{Permissions, application::Interaction},
};
use vozen_discord::{
    ConfigResetFailure, ConfigResetInvocation, ConfigResetService, GatewayEventDispatchError,
    GatewayEventSink, VoiceResponseLocalizer, parse_config_reset_command,
};
use vozen_store::SqliteStore;

pub struct ConfigResetGatewaySink {
    service: ConfigResetService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigResetGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigResetService::new(store),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
        result: Result<vozen_discord::ConfigResetOutcome, ConfigResetFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let key = match result {
            Ok(_) => "config.reset",
            Err(ConfigResetFailure::NeedsManageGuild | ConfigResetFailure::GuildRequired) => {
                "error.needManageGuild"
            }
            Err(ConfigResetFailure::StoreUnavailable) => "error.generic",
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
impl GatewayEventSink for ConfigResetGatewaySink {
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
        let Some(parsed) =
            parse_config_reset_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let content = self.response(
            &command,
            self.service.execute(
                ConfigResetInvocation {
                    guild_id: guild_id.as_deref(),
                    can_manage_guild,
                },
                parsed,
            ),
        )?;
        command
            .create_response(
                &context,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(content)
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
    fn response_uses_reset_copy_and_keeps_errors_distinct() {
        let sink = ConfigResetGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"reset","type":1,"options":[]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        )
        .expect("command");
        let content = sink
            .response(&command, Ok(vozen_discord::ConfigResetOutcome))
            .expect("response");
        assert!(content.contains("Config reset to defaults"));
        let denied = sink
            .response(&command, Err(ConfigResetFailure::NeedsManageGuild))
            .expect("denied");
        assert!(denied.contains("Manage Server"));
    }
}
