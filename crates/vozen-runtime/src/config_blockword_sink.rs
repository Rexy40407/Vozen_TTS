//! Opt-in gateway adapter for block-word mutations.

use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::{Permissions, application::Interaction},
};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
use vozen_discord::{
    ConfigBlockwordFailure, ConfigBlockwordInvocation, ConfigBlockwordOutcome,
    ConfigBlockwordService, GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_config_blockword_command,
};
use vozen_store::SqliteStore;

pub struct ConfigBlockwordGatewaySink {
    service: ConfigBlockwordService,
    localizer: VoiceResponseLocalizer,
}
impl ConfigBlockwordGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigBlockwordService::new(store),
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }
    fn message(
        &self,
        key: &str,
        command: &serenity::model::application::CommandInteraction,
        params: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(
                key,
                Some(&command.locale),
                command.guild_locale.as_deref(),
                params,
            )
            .ok_or(GatewayEventDispatchError)
    }
    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
        outcome: Result<ConfigBlockwordOutcome, ConfigBlockwordFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match outcome {
            Ok(value) => value,
            Err(
                ConfigBlockwordFailure::NeedsManageGuild | ConfigBlockwordFailure::GuildRequired,
            ) => return self.message("error.needManageGuild", command, &BTreeMap::new()),
            Err(ConfigBlockwordFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        let mut params = BTreeMap::new();
        match outcome {
            ConfigBlockwordOutcome::Added { word } => {
                params.insert("word", word);
                self.message("config.blocked", command, &params)
            }
            ConfigBlockwordOutcome::Removed { word } => {
                params.insert("word", word);
                self.message("config.unblocked", command, &params)
            }
            ConfigBlockwordOutcome::Limit => {
                params.insert("max", "500".into());
                self.message("config.blockLimit", command, &params)
            }
            ConfigBlockwordOutcome::Empty => {
                self.message("config.wordEmpty", command, &BTreeMap::new())
            }
        }
    }
}
#[async_trait::async_trait]
impl GatewayEventSink for ConfigBlockwordGatewaySink {
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
            parse_config_blockword_command(&command.data).map_err(|_| GatewayEventDispatchError)?
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
                ConfigBlockwordInvocation {
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
    fn limit_and_word_responses_are_distinct() {
        let sink = ConfigBlockwordGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"block-word","type":2,"options":[{"name":"add","type":1,"options":[{"name":"word","type":3,"value":"spam"}]}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#).expect("command");
        let content = sink
            .response(
                &command,
                Ok(ConfigBlockwordOutcome::Added {
                    word: "spam".into(),
                }),
            )
            .expect("response");
        assert!(content.contains("spam"));
    }
}
