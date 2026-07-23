//! Opt-in gateway adapter for boolean `/config` settings.

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
    ConfigToggle, ConfigToggleFailure, ConfigToggleInvocation, ConfigToggleOutcome,
    ConfigToggleService, GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_config_toggle_command,
};
use vozen_store::SqliteStore;

pub struct ConfigToggleGatewaySink {
    service: ConfigToggleService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigToggleGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigToggleService::new(store),
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
        result: Result<ConfigToggleOutcome, ConfigToggleFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match result {
            Ok(outcome) => outcome,
            Err(ConfigToggleFailure::NeedsManageGuild | ConfigToggleFailure::GuildRequired) => {
                return self.message("error.needManageGuild", command, &BTreeMap::new());
            }
            Err(ConfigToggleFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        let parameters: BTreeMap<&str, String> = BTreeMap::new();
        let key = match (outcome.toggle, outcome.enabled) {
            (ConfigToggle::AutoRead, true) => "config.autoreadOn",
            (ConfigToggle::AutoRead, false) => "config.autoreadOff",
            (ConfigToggle::Enabled, true) => "config.enabledOn",
            (ConfigToggle::Enabled, false) => "config.enabledOff",
            (ConfigToggle::Xsaid, true) => "config.xsaidOn",
            (ConfigToggle::Xsaid, false) => "config.xsaidOff",
            (ConfigToggle::AutoJoin, true) => "config.autojoinOn",
            (ConfigToggle::AutoJoin, false) => "config.autojoinOff",
            (ConfigToggle::AlwaysOn, true) => "config.stayOn",
            (ConfigToggle::AlwaysOn, false) => "config.stayOff",
            (ConfigToggle::ReadBots, true) => "config.readBotsOn",
            (ConfigToggle::ReadBots, false) => "config.readBotsOff",
            (ConfigToggle::TextInVoice, true) => "config.textInVoiceOn",
            (ConfigToggle::TextInVoice, false) => "config.textInVoiceOff",
            (ConfigToggle::AntiSpam, true) => "config.antispamOn",
            (ConfigToggle::AntiSpam, false) => "config.antispamOff",
            (ConfigToggle::Streaks, true) => "config.streaksOn",
            (ConfigToggle::Streaks, false) => "config.streaksOff",
            (ConfigToggle::Soundboard, true) => "config.soundboardOn",
            (ConfigToggle::Soundboard, false) => "config.soundboardOff",
            (ConfigToggle::Greet, true) => "config.greetOn",
            (ConfigToggle::Greet, false) => "config.greetOff",
            (ConfigToggle::VoteReminders, _) => {
                let state_key = if outcome.enabled {
                    "config.on"
                } else {
                    "config.off"
                };
                let label = self.message("config.votePromosLabel", command, &BTreeMap::new())?;
                let state = self.message(state_key, command, &BTreeMap::new())?;
                return Ok(format!("{label}: **{state}**"));
            }
        };
        self.message(key, command, &parameters)
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigToggleGatewaySink {
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
            parse_config_toggle_command(&command.data).map_err(|_| GatewayEventDispatchError)?
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
            ConfigToggleInvocation {
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
    fn response_keys_follow_the_node_toggle_copy() {
        let sink = ConfigToggleGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"auto-read","type":1,"options":[{"name":"active","type":5,"value":true}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                Ok(ConfigToggleOutcome {
                    toggle: ConfigToggle::AutoRead,
                    enabled: true,
                }),
            )
            .expect("response");
        assert!(content.contains("Automatic reading is now on"));
    }
}
