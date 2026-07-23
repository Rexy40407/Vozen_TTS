//! Opt-in gateway adapter for the public `/vote` command.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{
        CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
    },
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_vote_command,
};
use vozen_store::{SqliteStore, VOTE_REDEMPTION_SECRET_MIN_LENGTH};

pub struct VoteGatewaySink {
    client_id: Option<String>,
    redemption_secret: Option<String>,
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
}

impl VoteGatewaySink {
    pub fn new(
        client_id: Option<String>,
        redemption_secret: Option<String>,
        store: Arc<Mutex<SqliteStore>>,
    ) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            client_id,
            redemption_secret,
            store,
            localizer: VoiceResponseLocalizer::from_generated_contract()
                .map_err(|_| GatewayEventDispatchError)?,
        })
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<(String, Option<(String, String)>), GatewayEventDispatchError> {
        let Some(client_id) = self.client_id.as_deref().filter(|id| !id.trim().is_empty()) else {
            return Ok((
                self.localizer
                    .render_key(
                        "vote.noClientId",
                        Some(&command.locale),
                        command.guild_locale.as_deref(),
                        &BTreeMap::new(),
                    )
                    .ok_or(GatewayEventDispatchError)?,
                None,
            ));
        };

        let url = format!("https://top.gg/bot/{client_id}/vote");
        let mut parameters = BTreeMap::new();
        parameters.insert("url", url.clone());
        let mut content = self
            .localizer
            .render_key(
                "vote.link",
                Some(&command.locale),
                command.guild_locale.as_deref(),
                &parameters,
            )
            .ok_or(GatewayEventDispatchError)?;
        if let Some(secret) = self
            .redemption_secret
            .as_deref()
            .filter(|secret| secret.len() >= VOTE_REDEMPTION_SECRET_MIN_LENGTH)
        {
            let already_redeemed = self
                .store
                .lock()
                .ok()
                .and_then(|store| {
                    store
                        .vote_reward_status(&command.user.id.to_string(), secret)
                        .ok()
                })
                .is_some_and(|status| status.already_redeemed);
            if already_redeemed {
                let status = self
                    .localizer
                    .render_key(
                        "vote.cooldownStatus",
                        Some(&command.locale),
                        command.guild_locale.as_deref(),
                        &BTreeMap::new(),
                    )
                    .ok_or(GatewayEventDispatchError)?;
                content.push_str("\n\n");
                content.push_str(&status);
            }
        }
        let button_label = self
            .localizer
            .render_key(
                "vote.button",
                Some(&command.locale),
                command.guild_locale.as_deref(),
                &BTreeMap::new(),
            )
            .ok_or(GatewayEventDispatchError)?;
        Ok((content, Some((url, button_label))))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for VoteGatewaySink {
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
        if parse_vote_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        let (content, vote) = self.response(&command)?;
        let mut response = CreateInteractionResponseMessage::new().content(content);
        if let Some((url, button_label)) = vote {
            response = response.components(vec![CreateActionRow::Buttons(vec![
                CreateButton::new_link(url).label(button_label),
            ])]);
        }
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
    #[test]
    fn vote_url_uses_the_application_id() {
        assert_eq!(
            format!("https://top.gg/bot/{}/vote", "123"),
            "https://top.gg/bot/123/vote"
        );
    }
}
