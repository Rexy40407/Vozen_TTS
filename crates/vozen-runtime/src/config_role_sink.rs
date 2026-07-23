//! Opt-in gateway adapter for `/config role`.

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
    ConfigRoleFailure, ConfigRoleInvocation, ConfigRoleOutcome, ConfigRoleService,
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_config_role_command,
};
use vozen_store::SqliteStore;

pub struct ConfigRoleGatewaySink {
    service: ConfigRoleService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigRoleGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigRoleService::new(store),
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
        outcome: Result<ConfigRoleOutcome, ConfigRoleFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match outcome {
            Ok(outcome) => outcome,
            Err(ConfigRoleFailure::NeedsManageGuild | ConfigRoleFailure::GuildRequired) => {
                return self.message("error.needManageGuild", command, &BTreeMap::new());
            }
            Err(ConfigRoleFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        match outcome {
            ConfigRoleOutcome::Saved {
                role_id: Some(role_id),
            } => {
                let mut parameters = BTreeMap::new();
                parameters.insert("role", format!("<@&{role_id}>"));
                self.message("config.roleSet", command, &parameters)
            }
            ConfigRoleOutcome::Saved { role_id: None } => {
                self.message("config.roleCleared", command, &BTreeMap::new())
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigRoleGatewaySink {
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
            parse_config_role_command(&command.data).map_err(|_| GatewayEventDispatchError)?
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
            ConfigRoleInvocation {
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
    fn responses_keep_role_mentions_and_clear_copy_separate() {
        let sink = ConfigRoleGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"role","type":1,"options":[{"name":"role","type":8,"value":"123"}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                Ok(ConfigRoleOutcome::Saved {
                    role_id: Some("123".into()),
                }),
            )
            .expect("response");
        assert!(content.contains("<@&123>"));
    }
}
