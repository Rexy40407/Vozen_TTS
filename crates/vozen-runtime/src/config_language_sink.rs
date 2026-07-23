//! Opt-in gateway adapter for the direct `/config language` setting.

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
    ConfigLanguageInvocation, ConfigLanguageOutcome, ConfigLanguageService,
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, locale_display_options,
    parse_config_language_command,
};
use vozen_store::SqliteStore;

pub struct ConfigLanguageGatewaySink {
    service: ConfigLanguageService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigLanguageGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigLanguageService::new(store),
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
        outcome: ConfigLanguageOutcome,
    ) -> Result<String, GatewayEventDispatchError> {
        match outcome {
            ConfigLanguageOutcome::Saved { locale } => {
                let language = locale_display_options()
                    .into_iter()
                    .find(|option| option.id == locale)
                    .map(|option| option.label)
                    .unwrap_or_else(|| locale.clone());
                let mut parameters = BTreeMap::new();
                parameters.insert("language", language);
                self.message("config.language.set", command, &parameters)
            }
            ConfigLanguageOutcome::Unsupported => {
                self.message("config.language.unsupported", command, &BTreeMap::new())
            }
            ConfigLanguageOutcome::NeedsManageGuild | ConfigLanguageOutcome::GuildRequired => {
                self.message("error.needManageGuild", command, &BTreeMap::new())
            }
            ConfigLanguageOutcome::StoreUnavailable => {
                self.message("error.generic", command, &BTreeMap::new())
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigLanguageGatewaySink {
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
            parse_config_language_command(&command.data).map_err(|_| GatewayEventDispatchError)?
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
            ConfigLanguageInvocation {
                guild_id: guild_id.as_deref(),
                can_manage_guild,
                locale_supported: self.localizer.supports_explicit_locale(&parsed.locale),
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
    fn saved_response_uses_the_selected_language_name() {
        let sink = ConfigLanguageGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"language","type":1,"options":[{"name":"locale","type":3,"value":"pt"}]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        ).expect("command");
        let content = sink
            .response(
                &command,
                ConfigLanguageOutcome::Saved {
                    locale: "pt".into(),
                },
            )
            .expect("response");
        assert!(content.contains("Português"));
    }
}
