//! Opt-in gateway adapter for `/redeem` gift codes.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::ui::message_embed;
use serenity::{
    builder::{CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_redeem_command,
};
use vozen_store::{PremiumCodePlan, RedeemCodeStatus, SqliteStore};

pub struct RedeemGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
}

impl RedeemGatewaySink {
    pub fn new(store: Arc<Mutex<SqliteStore>>) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
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
        code: &str,
    ) -> Result<String, GatewayEventDispatchError> {
        let result = self
            .store
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .redeem_premium_code(code, &command.user.id.get().to_string(), now_ms())
            .map_err(|_| GatewayEventDispatchError)?;
        let key = match result.status {
            RedeemCodeStatus::NotFound => {
                return self.message("redeem.notFound", command, &BTreeMap::new());
            }
            RedeemCodeStatus::Used => {
                return self.message("redeem.used", command, &BTreeMap::new());
            }
            RedeemCodeStatus::Expired => {
                return self.message("redeem.expired", command, &BTreeMap::new());
            }
            RedeemCodeStatus::Redeemed => match result.plan {
                Some(PremiumCodePlan::Plus) => "redeem.okPlus",
                Some(PremiumCodePlan::Premium) => "redeem.okPremium",
                None => return self.message("error.generic", command, &BTreeMap::new()),
            },
        };
        let mut parameters = BTreeMap::new();
        parameters.insert("days", result.days.unwrap_or_default().to_string());
        parameters.insert("date", discord_date(result.granted_expires_at.unwrap_or(0)));
        parameters.insert("seats", result.seats.unwrap_or_default().to_string());
        self.message(key, command, &parameters)
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for RedeemGatewaySink {
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
            parse_redeem_command(&command.data).map_err(|_| GatewayEventDispatchError)?
        else {
            return Ok(());
        };
        let response = CreateInteractionResponseMessage::new()
            .embeds(vec![message_embed(self.response(&command, &parsed.code)?)])
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

fn discord_date(ms: i64) -> String {
    format!("<t:{}:D>", ms.div_euclid(1_000))
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| {
            duration.as_millis().min(i64::MAX as u128) as i64
        })
}
