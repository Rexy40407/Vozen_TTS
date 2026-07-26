//! Opt-in gateway adapter for `/config tts-channel`.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use crate::ui::message_embed;
use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::{Permissions, application::Interaction, channel::ChannelType, id::ChannelId},
};
use vozen_discord::{
    ConfigChannelCommand, ConfigChannelFailure, ConfigChannelInvocation, ConfigChannelOutcome,
    ConfigChannelService, GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_config_channel_command,
};
use vozen_store::SqliteStore;

pub struct ConfigChannelGatewaySink {
    service: ConfigChannelService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigChannelGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigChannelService::new(store),
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
        outcome: Result<ConfigChannelOutcome, ConfigChannelFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        match outcome {
            Ok(ConfigChannelOutcome::Saved { channel_id }) => {
                let mut parameters = BTreeMap::new();
                parameters.insert("channel", format!("<#{}>", channel_id));
                self.message("config.channelSet", command, &parameters)
            }
            Err(ConfigChannelFailure::NeedsManageGuild | ConfigChannelFailure::GuildRequired) => {
                self.message("error.needManageGuild", command, &BTreeMap::new())
            }
            Err(ConfigChannelFailure::StoreUnavailable) => {
                self.message("error.generic", command, &BTreeMap::new())
            }
        }
    }

    async fn channel_is_allowed(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
        parsed: ConfigChannelCommand,
    ) -> Result<(), &'static str> {
        let Some(guild_id) = command.guild_id else {
            return Err("guild");
        };
        let guild = guild_id
            .to_partial_guild(&context.http)
            .await
            .map_err(|_| "access")?;
        let channels = guild_id
            .channels(&context.http)
            .await
            .map_err(|_| "access")?;
        let channel_id = ChannelId::new(parsed.channel_id);
        let Some(channel) = channels.get(&channel_id) else {
            return Err("access");
        };
        if channel.kind != ChannelType::Text {
            return Err("type");
        }
        let bot = context
            .http
            .get_current_user()
            .await
            .map_err(|_| "access")?;
        let bot_member = guild_id
            .member(&context.http, bot.id)
            .await
            .map_err(|_| "access")?;
        if !guild
            .user_permissions_in(channel, &bot_member)
            .contains(Permissions::VIEW_CHANNEL)
        {
            return Err("access");
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigChannelGatewaySink {
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
            parse_config_channel_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        if let Err(reason) = self.channel_is_allowed(&context, &command, parsed).await {
            let key = if reason == "type" {
                "config.channelWrongType"
            } else {
                "config.channelNoAccess"
            };
            let mut parameters = BTreeMap::new();
            parameters.insert("channel", format!("<#{}>", parsed.channel_id));
            let content = self.message(key, &command, &parameters)?;
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
            return Ok(());
        }
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let outcome = self.service.execute(
            ConfigChannelInvocation {
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
    fn saved_response_uses_a_safe_channel_mention() {
        let sink = ConfigChannelGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"tts-channel","type":1,"options":[{"name":"channel","type":7,"value":"123"}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                Ok(ConfigChannelOutcome::Saved { channel_id: 123 }),
            )
            .expect("response");
        assert!(content.contains("<#123>"));
    }
}
