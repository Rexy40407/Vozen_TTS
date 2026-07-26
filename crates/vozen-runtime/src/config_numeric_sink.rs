//! Opt-in gateway adapter for `/config max-chars` and `/config rate-limit`.

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
    ConfigNumericFailure, ConfigNumericInvocation, ConfigNumericOutcome, ConfigNumericService,
    ConfigNumericSetting, GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_config_numeric_command,
};
use vozen_store::SqliteStore;

pub struct ConfigNumericGatewaySink {
    service: ConfigNumericService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigNumericGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigNumericService::new(store),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
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
        result: Result<ConfigNumericOutcome, ConfigNumericFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match result {
            Ok(outcome) => outcome,
            Err(ConfigNumericFailure::NeedsManageGuild | ConfigNumericFailure::GuildRequired) => {
                return self.message("error.needManageGuild", command, &BTreeMap::new());
            }
            Err(ConfigNumericFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        let (key, value) = match outcome {
            ConfigNumericOutcome::Saved { setting, value } => (
                match setting {
                    ConfigNumericSetting::MaxChars => "config.maxCharsSet",
                    ConfigNumericSetting::RateLimit => "config.rateLimitSet",
                },
                value,
            ),
            ConfigNumericOutcome::OutOfRange { setting } => (
                match setting {
                    ConfigNumericSetting::MaxChars => "config.maxCharsRange",
                    ConfigNumericSetting::RateLimit => "config.rateLimitRange",
                },
                0,
            ),
        };
        let mut parameters = BTreeMap::new();
        if matches!(outcome, ConfigNumericOutcome::Saved { .. }) {
            parameters.insert("value", value.to_string());
        }
        self.message(key, command, &parameters)
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigNumericGatewaySink {
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
            parse_config_numeric_command(&command.data).map_err(|_| GatewayEventDispatchError)?
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
            ConfigNumericInvocation {
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
    fn responses_keep_numeric_placeholders_and_range_errors_separate() {
        let sink = ConfigNumericGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"max-chars","type":1,"options":[{"name":"value","type":4,"value":500}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                Ok(ConfigNumericOutcome::Saved {
                    setting: ConfigNumericSetting::MaxChars,
                    value: 500,
                }),
            )
            .expect("response");
        assert!(content.contains("500"));
    }
}
