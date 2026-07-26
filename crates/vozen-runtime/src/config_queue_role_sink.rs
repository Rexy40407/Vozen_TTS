//! Opt-in gateway adapter for queue priority/block role settings.

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
    ConfigQueueRoleFailure, ConfigQueueRoleInvocation, ConfigQueueRoleOutcome,
    ConfigQueueRoleService, ConfigQueueRoleSetting, GatewayEventDispatchError, GatewayEventSink,
    VoiceResponseLocalizer, parse_config_queue_role_command,
};
use vozen_store::SqliteStore;

pub struct ConfigQueueRoleGatewaySink {
    service: ConfigQueueRoleService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigQueueRoleGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigQueueRoleService::new(store),
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
        outcome: Result<ConfigQueueRoleOutcome, ConfigQueueRoleFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match outcome {
            Ok(value) => value,
            Err(
                ConfigQueueRoleFailure::NeedsManageGuild | ConfigQueueRoleFailure::GuildRequired,
            ) => return self.message("error.needManageGuild", command, &BTreeMap::new()),
            Err(ConfigQueueRoleFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        match outcome {
            ConfigQueueRoleOutcome::Conflict => {
                self.message("config.rolesConflict", command, &BTreeMap::new())
            }
            ConfigQueueRoleOutcome::Saved {
                setting,
                role_id: Some(role_id),
            } => {
                let mut parameters = BTreeMap::new();
                parameters.insert("role", format!("<@&{role_id}>"));
                self.message(
                    match setting {
                        ConfigQueueRoleSetting::Priority => "config.priorityRoleSet",
                        ConfigQueueRoleSetting::Blocked => "config.blockedRoleSet",
                    },
                    command,
                    &parameters,
                )
            }
            ConfigQueueRoleOutcome::Saved {
                setting,
                role_id: None,
            } => self.message(
                match setting {
                    ConfigQueueRoleSetting::Priority => "config.priorityRoleCleared",
                    ConfigQueueRoleSetting::Blocked => "config.blockedRoleCleared",
                },
                command,
                &BTreeMap::new(),
            ),
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigQueueRoleGatewaySink {
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
        let Some(parsed) = parse_config_queue_role_command(&command.data)
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
        let content = self.response(
            &command,
            self.service.execute(
                ConfigQueueRoleInvocation {
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
    fn conflict_response_is_distinct() {
        let sink = ConfigQueueRoleGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"priority-role","type":1,"options":[]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#).expect("command");
        let content = sink
            .response(&command, Ok(ConfigQueueRoleOutcome::Conflict))
            .expect("response");
        assert!(content.contains("different role"));
    }
}
