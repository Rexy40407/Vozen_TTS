//! Opt-in gateway adapter for the public `/help` command.

use std::collections::BTreeMap;

use serenity::{
    builder::{
        CreateEmbed, CreateEmbedFooter, CreateInteractionResponse, CreateInteractionResponseMessage,
    },
    client::Context,
    model::application::Interaction,
};
use vozen_contracts::DiscordCommandCatalog;
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_help_command,
};

const COMMANDS: &str = include_str!("../../../contracts/discord-commands.json");
const SOURCE_URL: &str = "https://github.com/Rexy40407/vozen";

pub struct HelpGatewaySink {
    support_url: String,
    localizer: VoiceResponseLocalizer,
}

impl HelpGatewaySink {
    pub fn new(support_url: String) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            support_url,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn message(
        &self,
        command: &serenity::model::application::CommandInteraction,
        key: &str,
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
    ) -> Result<CreateEmbed, GatewayEventDispatchError> {
        let quick_start = self.message(command, "help.quickStartBody", &BTreeMap::new())?;
        let started = self.message(command, "help.groupStartedBody", &BTreeMap::new())?;
        let voice = self.message(command, "help.groupVoiceBody", &BTreeMap::new())?;
        let fun = self.message(command, "help.groupFunBody", &BTreeMap::new())?;
        let admin = self.message(command, "help.groupAdminBody", &BTreeMap::new())?;
        let mut more = self.message(command, "help.groupMoreBody", &BTreeMap::new())?;

        if let Ok(catalog) = DiscordCommandCatalog::from_json(COMMANDS) {
            let mentioned = [
                quick_start.as_str(),
                started.as_str(),
                voice.as_str(),
                fun.as_str(),
                admin.as_str(),
                more.as_str(),
            ]
            .join("\n");
            let missing = catalog
                .command_names()
                .into_iter()
                .filter(|name| !mentioned.contains(&format!("/{name}")))
                .map(|name| format!("• /{name}"))
                .collect::<Vec<_>>();
            if !missing.is_empty() {
                more.push('\n');
                more.push_str(&missing.join("\n"));
            }
        }

        let mut support = BTreeMap::new();
        support.insert("url", self.support_url.clone());
        let support = self.message(command, "help.support", &support)?;
        let mut source = BTreeMap::new();
        source.insert("url", SOURCE_URL.to_owned());
        let source = self.message(command, "help.source", &source)?;
        let mut footer = BTreeMap::new();
        footer.insert("command", "/setup".to_owned());

        Ok(CreateEmbed::new()
            .title(self.message(command, "help.embedTitle", &BTreeMap::new())?)
            .description(format!(
                "{}\n{}\n\n{}\n\n{}\n{}",
                self.message(command, "help.title", &BTreeMap::new())?,
                self.message(command, "help.intro", &BTreeMap::new())?,
                self.message(command, "welcome.enginePlans", &BTreeMap::new())?,
                support,
                source,
            ))
            .field(
                self.message(command, "help.quickStartTitle", &BTreeMap::new())?,
                quick_start,
                false,
            )
            .field(
                self.message(command, "help.groupStarted", &BTreeMap::new())?,
                started,
                false,
            )
            .field(
                self.message(command, "help.groupVoice", &BTreeMap::new())?,
                voice,
                false,
            )
            .field(
                self.message(command, "help.groupFun", &BTreeMap::new())?,
                fun,
                false,
            )
            .field(
                self.message(command, "help.groupAdmin", &BTreeMap::new())?,
                admin,
                false,
            )
            .field(
                self.message(command, "help.groupMore", &BTreeMap::new())?,
                more,
                false,
            )
            .footer(CreateEmbedFooter::new(self.message(
                command,
                "help.footer",
                &footer,
            )?)))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for HelpGatewaySink {
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
        if parse_help_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        let response = CreateInteractionResponseMessage::new()
            .embeds(vec![self.response(&command)?])
            .ephemeral(true);
        command
            .create_response(&context, CreateInteractionResponse::Message(response))
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
    fn source_and_support_urls_are_stable_inputs() {
        assert_eq!(SOURCE_URL, "https://github.com/Rexy40407/vozen");
        assert!(COMMANDS.contains("\"name\": \"help\""));
    }
}
