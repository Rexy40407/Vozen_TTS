//! Opt-in gateway adapter for `/config greet-language`.

use crate::ui::message_embed;
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
    ConfigGreetLanguageFailure, ConfigGreetLanguageInvocation, ConfigGreetLanguageOutcome,
    ConfigGreetLanguageService, GatewayEventDispatchError, GatewayEventSink,
    VoiceResponseLocalizer, parse_config_greet_language_command,
};
use vozen_store::SqliteStore;

const GREETING_LANGUAGES: &[(&str, &str)] = &[
    ("en", "English"),
    ("pt", "Portugu\u{00ea}s"),
    ("es", "Espa\u{00f1}ol"),
    ("fr", "Fran\u{00e7}ais"),
    ("de", "Deutsch"),
    ("it", "Italiano"),
    ("nl", "Nederlands"),
    ("sv", "Svenska"),
    ("da", "Dansk"),
    ("fi", "Suomi"),
    ("pl", "Polski"),
    (
        "ru",
        "\u{0420}\u{0443}\u{0441}\u{0441}\u{043a}\u{0438}\u{0439}",
    ),
    (
        "uk",
        "\u{0423}\u{043a}\u{0440}\u{0430}\u{0457}\u{043d}\u{0441}\u{044c}\u{043a}\u{0430}",
    ),
    ("tr", "T\u{00fc}rk\u{00e7}e"),
    ("cs", "\u{010c}e\u{0161}tina"),
    (
        "el",
        "\u{0395}\u{03bb}\u{03bb}\u{03b7}\u{03bd}\u{03b9}\u{03ba}\u{03ac}",
    ),
    ("ro", "Rom\u{00e2}n\u{0103}"),
    ("ca", "Catal\u{00e0}"),
    ("hu", "Magyar"),
];

fn greeting_label(locale: &str) -> Option<&'static str> {
    GREETING_LANGUAGES
        .iter()
        .find(|(code, _)| *code == locale)
        .map(|(_, label)| *label)
}

pub struct ConfigGreetLanguageGatewaySink {
    service: ConfigGreetLanguageService,
    localizer: VoiceResponseLocalizer,
}
impl ConfigGreetLanguageGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigGreetLanguageService::new(store),
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
        outcome: Result<ConfigGreetLanguageOutcome, ConfigGreetLanguageFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match outcome {
            Ok(value) => value,
            Err(
                ConfigGreetLanguageFailure::NeedsManageGuild
                | ConfigGreetLanguageFailure::GuildRequired,
            ) => return self.message("error.needManageGuild", command, &BTreeMap::new()),
            Err(ConfigGreetLanguageFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        match outcome {
            ConfigGreetLanguageOutcome::Unsupported => {
                self.message("config.language.unsupported", command, &BTreeMap::new())
            }
            ConfigGreetLanguageOutcome::Saved { locale } => {
                let mut params = BTreeMap::new();
                params.insert(
                    "language",
                    greeting_label(&locale).unwrap_or(&locale).to_owned(),
                );
                self.message("config.greetLangSet", command, &params)
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigGreetLanguageGatewaySink {
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
        let Some(parsed) = parse_config_greet_language_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let supported = greeting_label(&parsed.locale).is_some();
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let can_manage_guild = command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD));
        let content = self.response(
            &command,
            self.service.execute(
                ConfigGreetLanguageInvocation {
                    guild_id: guild_id.as_deref(),
                    can_manage_guild,
                    locale_supported: supported,
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
    fn greeting_catalogue_keeps_all_node_locales() {
        assert_eq!(GREETING_LANGUAGES.len(), 19);
        assert_eq!(greeting_label("pt"), Some("Português"));
        assert_eq!(greeting_label("xx"), None);
    }
}
