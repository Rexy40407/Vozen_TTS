//! Opt-in gateway adapter for the read-only `/config show` command.

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
    ConfigShowFailure, ConfigShowInvocation, ConfigShowOutcome, ConfigShowService,
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_config_show_command,
};
use vozen_store::SqliteStore;

pub struct ConfigShowGatewaySink {
    service: ConfigShowService,
    localizer: VoiceResponseLocalizer,
}

impl ConfigShowGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            service: ConfigShowService::new(store),
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

    fn value(
        &self,
        command: &serenity::model::application::CommandInteraction,
        key: &str,
    ) -> Result<String, GatewayEventDispatchError> {
        self.message(key, command, &BTreeMap::new())
    }

    fn line(
        &self,
        command: &serenity::model::application::CommandInteraction,
        key: &str,
        value: impl Into<String>,
    ) -> Result<String, GatewayEventDispatchError> {
        let mut parameters = BTreeMap::new();
        parameters.insert("value", value.into());
        self.message(key, command, &parameters)
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
        result: Result<ConfigShowOutcome, ConfigShowFailure>,
    ) -> Result<String, GatewayEventDispatchError> {
        let outcome = match result {
            Ok(outcome) => outcome,
            Err(ConfigShowFailure::NeedsManageGuild | ConfigShowFailure::GuildRequired) => {
                return self.message("error.needManageGuild", command, &BTreeMap::new());
            }
            Err(ConfigShowFailure::StoreUnavailable) => {
                return self.message("error.generic", command, &BTreeMap::new());
            }
        };
        let config = outcome.config;
        let on = self.value(command, "config.on")?;
        let off = self.value(command, "config.off")?;
        let none = self.value(command, "config.valueNone")?;
        let any = self.value(command, "config.valueAny")?;
        let auto_detect = self.value(command, "config.valueAutoDetect")?;
        let channel = config
            .tts_channel_id
            .map(|id| format!("<#{}>", id))
            .unwrap_or_else(|| none.clone());
        let role = config
            .tts_role_id
            .map(|id| format!("<@&{}>", id))
            .unwrap_or_else(|| any.clone());
        let priority_role = config
            .priority_role_id
            .map(|id| format!("<@&{}>", id))
            .unwrap_or_else(|| none.clone());
        let blocked_role = config
            .blocked_role_id
            .map(|id| format!("<@&{}>", id))
            .unwrap_or_else(|| none.clone());
        let voice = if config.default_voice.is_empty() {
            auto_detect
        } else {
            config.default_voice
        };
        let greet_language = greet_language_label(&config.greet_locale);

        Ok([
            self.value(command, "config.showTitle")?,
            self.line(command, "config.showChannel", channel)?,
            self.line(
                command,
                "config.showAutoread",
                if config.autoread { &on } else { &off },
            )?,
            self.line(command, "config.showRole", role)?,
            self.line(command, "config.showPriorityRole", priority_role)?,
            self.line(command, "config.showBlockedRole", blocked_role)?,
            self.line(
                command,
                "config.showEnabled",
                if config.enabled { &on } else { &off },
            )?,
            self.line(
                command,
                "config.showXsaid",
                if config.xsaid { &on } else { &off },
            )?,
            self.line(
                command,
                "config.showAutojoin",
                if config.autojoin { &on } else { &off },
            )?,
            self.line(
                command,
                "config.showReadBots",
                if config.read_bots { &on } else { &off },
            )?,
            self.line(
                command,
                "config.showTextInVoice",
                if config.text_in_voice { &on } else { &off },
            )?,
            self.line(
                command,
                "config.showAntispam",
                if config.antispam { &on } else { &off },
            )?,
            self.line(
                command,
                "config.showSoundboard",
                if config.soundboard { &on } else { &off },
            )?,
            {
                let mut parameters = BTreeMap::new();
                parameters.insert(
                    "value",
                    if config.greet_on_join {
                        on.clone()
                    } else {
                        off.clone()
                    },
                );
                parameters.insert("language", greet_language.to_owned());
                self.message("config.showGreet", command, &parameters)?
            },
            self.line(command, "config.showVoice", voice)?,
            self.line(command, "config.showMaxChars", config.max_chars.to_string())?,
            self.line(
                command,
                "config.showRateLimit",
                config.rate_per_min.to_string(),
            )?,
            {
                let mut parameters = BTreeMap::new();
                parameters.insert("count", outcome.blocklist_count.to_string());
                self.message("config.showBlocklist", command, &parameters)?
            },
        ]
        .join("\n"))
    }
}

fn greet_language_label(locale: &str) -> &'static str {
    match locale {
        "pt" => "Português",
        "es" => "Español",
        "fr" => "Français",
        "de" => "Deutsch",
        "it" => "Italiano",
        "nl" => "Nederlands",
        "sv" => "Svenska",
        "da" => "Dansk",
        "fi" => "Suomi",
        "pl" => "Polski",
        "ru" => "Русский",
        "uk" => "Українська",
        "tr" => "Türkçe",
        "cs" => "Čeština",
        "el" => "Ελληνικά",
        "ro" => "Română",
        "ca" => "Català",
        "hu" => "Magyar",
        _ => "English",
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for ConfigShowGatewaySink {
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
            parse_config_show_command(&command.data).map_err(|_| GatewayEventDispatchError)?
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
                ConfigShowInvocation {
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
    fn response_keeps_mentions_and_current_values() {
        let sink = ConfigShowGatewaySink::new(Arc::new(Mutex::new(
            SqliteStore::open_in_memory().expect("store"),
        )))
        .expect("sink");
        let command: serenity::model::application::CommandInteraction = serde_json::from_str(
            r#"{"id":"1","application_id":"1","data":{"id":"1","name":"config","type":1,"options":[{"name":"show","type":1,"options":[]}]},"guild_id":"2","channel_id":"3","member":null,"user":{"id":"4","username":"user","discriminator":"0"},"token":"token","version":1,"app_permissions":null,"locale":"en-US","guild_locale":null,"entitlements":[],"authorizing_integration_owners":{},"context":null,"attachment_size_limit":0}"#,
        )
        .expect("command");
        let config = vozen_store::GuildConfig {
            tts_channel_id: Some("123".into()),
            tts_role_id: Some("456".into()),
            default_voice: "en_US-amy-medium".into(),
            ..Default::default()
        };
        let content = sink
            .response(
                &command,
                Ok(ConfigShowOutcome {
                    config,
                    blocklist_count: 3,
                }),
            )
            .expect("response");
        assert!(content.contains("<#123>"));
        assert!(content.contains("<@&456>"));
        assert!(content.contains("en_US-amy-medium"));
        assert!(content.contains("Greet on join: on (English)"));
        assert!(!content.contains("{language}"));
        assert!(content.contains("Blocklist: 3 words"));
    }
}
