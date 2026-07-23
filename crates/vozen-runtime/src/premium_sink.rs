//! Opt-in gateway adapter for read-only `/premium info`.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use serenity::{
    builder::{
        CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
    },
    client::Context,
    model::application::Interaction,
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer, parse_premium_info_command,
};
use vozen_store::{SqliteStore, VOTE_REDEMPTION_SECRET_MIN_LENGTH};

pub struct PremiumGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    kofi_url: String,
    client_id: Option<String>,
    redemption_secret: Option<String>,
    guild_sku_id: Option<u64>,
    user_sku_id: Option<u64>,
    localizer: VoiceResponseLocalizer,
}

impl PremiumGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        kofi_url: String,
        client_id: Option<String>,
        redemption_secret: Option<String>,
        guild_sku_id: Option<u64>,
        user_sku_id: Option<u64>,
    ) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            kofi_url,
            client_id,
            redemption_secret,
            guild_sku_id,
            user_sku_id,
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
    ) -> Result<(String, bool), GatewayEventDispatchError> {
        let now = now_ms();
        let user_id = command.user.id.get().to_string();
        let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
        let guild_active = command
            .guild_id
            .map(|id| id.get().to_string())
            .map(|guild_id| {
                let active = store
                    .is_guild_premium(&guild_id, now)
                    .map_err(|_| GatewayEventDispatchError)?;
                let expiry = store
                    .effective_guild_premium_expiry(&guild_id, now)
                    .map_err(|_| GatewayEventDispatchError)?;
                Ok::<_, GatewayEventDispatchError>((active, expiry))
            })
            .transpose()?
            .unwrap_or((false, None));
        let status = store
            .premium_status(&user_id, now)
            .map_err(|_| GatewayEventDispatchError)?;
        let mut lines = Vec::new();
        if command.guild_id.is_some() {
            if guild_active.0 {
                let mut parameters = BTreeMap::new();
                parameters.insert("date", discord_date(guild_active.1.unwrap_or(now)));
                lines.push(self.message("premium.lineServerActive", command, &parameters)?);
            } else {
                lines.push(self.message("premium.lineServerFree", command, &BTreeMap::new())?);
            }
        }
        let pass_active = status.pass.as_ref().is_some_and(|pass| pass.active);
        if let Some(pass) = status.pass.as_ref().filter(|pass| pass.active) {
            let mut parameters = BTreeMap::new();
            parameters.insert("used", pass.used.to_string());
            parameters.insert("total", pass.seats.to_string());
            parameters.insert("date", discord_date(pass.expires_at));
            lines.push(self.message("premium.linePass", command, &parameters)?);
            if !pass.guilds.is_empty() {
                let mut parameters = BTreeMap::new();
                parameters.insert("servers", pass.guilds.join(", "));
                lines.push(self.message("premium.passServers", command, &parameters)?);
            }
        }
        if status.plus_active {
            let mut parameters = BTreeMap::new();
            parameters.insert("date", discord_date(status.plus_expires_at.unwrap_or(now)));
            lines.push(self.message("premium.lineUserActive", command, &parameters)?);
        } else {
            lines.push(self.message("premium.lineUserFree", command, &BTreeMap::new())?);
        }
        let any_active = guild_active.0 || pass_active || status.plus_active;
        if any_active {
            lines.push(String::new());
            lines.push(self.message("premium.enginePerks", command, &BTreeMap::new())?);
        } else {
            lines.push(self.message("premium.pitch", command, &BTreeMap::new())?);
            lines.push(String::new());
            lines.push(self.message("premium.enginePerks", command, &BTreeMap::new())?);
            lines.push(String::new());
            let mut parameters = BTreeMap::new();
            parameters.insert("link", self.kofi_url.clone());
            lines.push(self.message("premium.buyHint", command, &parameters)?);
            if let Some(secret) = self.redemption_secret.as_deref()
                && secret.len() >= VOTE_REDEMPTION_SECRET_MIN_LENGTH
            {
                let eligible = store
                    .vote_reward_status(&user_id, secret)
                    .map_err(|_| GatewayEventDispatchError)?
                    .eligible;
                if eligible {
                    if let Some(client_id) = self.client_id.as_deref() {
                        lines.push(String::new());
                        let mut parameters = BTreeMap::new();
                        parameters.insert("url", format!("https://top.gg/bot/{client_id}/vote"));
                        lines.push(self.message("vote.upsell", command, &parameters)?);
                    }
                } else {
                    lines.push(String::new());
                    lines.push(self.message("vote.cooldownStatus", command, &BTreeMap::new())?);
                }
            }
        }
        Ok((lines.join("\n"), any_active))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for PremiumGatewaySink {
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
        if parse_premium_info_command(&command.data)
            .map_err(|_| GatewayEventDispatchError)?
            .is_none()
        {
            return Ok(());
        }
        let (content, _active) = self.response(&command)?;
        let mut buttons = Vec::new();
        if let Some(sku) = self.guild_sku_id
            && command.guild_id.is_some()
        {
            buttons.push(CreateButton::new_premium(sku));
        }
        if let Some(sku) = self.user_sku_id {
            buttons.push(CreateButton::new_premium(sku));
        }
        let mut response = CreateInteractionResponseMessage::new()
            .content(content)
            .ephemeral(true);
        if !buttons.is_empty() {
            response = response.components(vec![CreateActionRow::Buttons(buttons)]);
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
