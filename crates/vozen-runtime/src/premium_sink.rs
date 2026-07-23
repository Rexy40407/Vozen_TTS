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
    model::{
        Permissions,
        application::{ComponentInteraction, Interaction},
    },
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, PremiumCommand, VoiceResponseLocalizer,
    parse_premium_command,
};
use vozen_store::{ActivateStatus, SqliteStore, VOTE_REDEMPTION_SECRET_MIN_LENGTH};

const ACTIVATION_TTL_SECONDS: i64 = 30;

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

    fn component_message(
        &self,
        key: &str,
        component: &ComponentInteraction,
        parameters: &BTreeMap<&str, String>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(
                key,
                Some(&component.locale),
                component.guild_locale.as_deref(),
                parameters,
            )
            .ok_or(GatewayEventDispatchError)
    }

    fn command_permission(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> bool {
        command
            .member
            .as_ref()
            .and_then(|member| member.permissions)
            .is_some_and(|permissions| permissions.contains(Permissions::MANAGE_GUILD))
    }

    fn activation_id(action: &str, user_id: &str, guild_id: &str, issued_at: i64) -> String {
        format!("premium:activate:{action}:{user_id}:{guild_id}:{issued_at}")
    }

    fn parse_activation_id(id: &str) -> Option<(&str, &str, &str, i64)> {
        let mut parts = id.split(':');
        if parts.next()? != "premium" || parts.next()? != "activate" {
            return None;
        }
        let action = parts.next()?;
        let user = parts.next()?;
        let guild = parts.next()?;
        let issued = parts.next()?.parse().ok()?;
        (parts.next().is_none() && matches!(action, "yes" | "no"))
            .then_some((action, user, guild, issued))
    }

    fn activate_response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<CreateInteractionResponseMessage, GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            return Ok(CreateInteractionResponseMessage::new()
                .content(self.message("premium.needManageGuild", command, &BTreeMap::new())?)
                .ephemeral(true));
        };
        if !self.command_permission(command) {
            return Ok(CreateInteractionResponseMessage::new()
                .content(self.message("premium.needManageGuild", command, &BTreeMap::new())?)
                .ephemeral(true));
        }
        let user_id = command.user.id.get().to_string();
        let guild_id = guild_id.get().to_string();
        let now = now_ms();
        let (content, row) = {
            let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
            let Some(pass) = store
                .premium_pass(&user_id)
                .map_err(|_| GatewayEventDispatchError)?
            else {
                let mut p = BTreeMap::new();
                p.insert("link", self.kofi_url.clone());
                return Ok(CreateInteractionResponseMessage::new()
                    .content(self.message("premium.noPass", command, &p)?)
                    .ephemeral(true));
            };
            if pass.expires_at <= now {
                let mut p = BTreeMap::new();
                p.insert("link", self.kofi_url.clone());
                return Ok(CreateInteractionResponseMessage::new()
                    .content(self.message("premium.noPass", command, &p)?)
                    .ephemeral(true));
            }
            let activations = store
                .pass_activations(&user_id)
                .map_err(|_| GatewayEventDispatchError)?;
            if activations.iter().any(|id| id == &guild_id) {
                return Ok(CreateInteractionResponseMessage::new()
                    .content(self.message("premium.alreadyActive", command, &BTreeMap::new())?)
                    .ephemeral(true));
            }
            if activations.len() as i64 >= pass.seats {
                let mut p = BTreeMap::new();
                p.insert("total", pass.seats.to_string());
                p.insert("servers", activations.join(", "));
                return Ok(CreateInteractionResponseMessage::new()
                    .content(self.message("premium.noSeats", command, &p)?)
                    .ephemeral(true));
            }
            let issued_at = now_seconds();
            let mut p = BTreeMap::new();
            p.insert("total", pass.seats.to_string());
            p.insert("used", activations.len().to_string());
            let content = self.message("premium.confirmActivate", command, &p)?;
            let yes = self.message("premium.confirmYes", command, &BTreeMap::new())?;
            let no = self.message("premium.confirmNo", command, &BTreeMap::new())?;
            let row = CreateActionRow::Buttons(vec![
                CreateButton::new(Self::activation_id("yes", &user_id, &guild_id, issued_at))
                    .label(yes)
                    .style(serenity::model::application::ButtonStyle::Success),
                CreateButton::new(Self::activation_id("no", &user_id, &guild_id, issued_at))
                    .label(no)
                    .style(serenity::model::application::ButtonStyle::Secondary),
            ]);
            (content, row)
        };
        Ok(CreateInteractionResponseMessage::new()
            .content(content)
            .components(vec![row])
            .ephemeral(true))
    }

    async fn activate(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<(), GatewayEventDispatchError> {
        let response = self.activate_response(command)?;
        command
            .create_response(context, CreateInteractionResponse::Message(response))
            .await
            .map_err(|_| GatewayEventDispatchError)?;
        Ok(())
    }

    async fn deactivate(
        &self,
        context: &Context,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<(), GatewayEventDispatchError> {
        let Some(guild_id) = command.guild_id else {
            let content = self.message("premium.needManageGuild", command, &BTreeMap::new())?;
            command
                .create_response(
                    context,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new()
                            .content(content)
                            .ephemeral(true),
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        };
        if !self.command_permission(command) {
            let content = self.message("premium.needManageGuild", command, &BTreeMap::new())?;
            command
                .create_response(
                    context,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new()
                            .content(content)
                            .ephemeral(true),
                    ),
                )
                .await
                .map_err(|_| GatewayEventDispatchError)?;
            return Ok(());
        }
        let removed = self
            .store
            .lock()
            .map_err(|_| GatewayEventDispatchError)?
            .deactivate_seat(
                &command.user.id.get().to_string(),
                &guild_id.get().to_string(),
            )
            .map_err(|_| GatewayEventDispatchError)?;
        let content = self.message(
            if removed {
                "premium.deactivateOk"
            } else {
                "premium.deactivateNone"
            },
            command,
            &BTreeMap::new(),
        )?;
        command
            .create_response(
                context,
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
        match interaction {
            Interaction::Command(command) => {
                let Some(parsed) =
                    parse_premium_command(&command.data).map_err(|_| GatewayEventDispatchError)?
                else {
                    return Ok(());
                };
                match parsed {
                    PremiumCommand::Info => {
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
                    }
                    PremiumCommand::Activate => self.activate(&context, &command).await?,
                    PremiumCommand::Deactivate => self.deactivate(&context, &command).await?,
                }
            }
            Interaction::Component(component) => {
                let Some((action, user, guild, issued)) =
                    Self::parse_activation_id(&component.data.custom_id)
                else {
                    return Ok(());
                };
                let now = now_seconds();
                if user != component.user.id.get().to_string()
                    || component
                        .guild_id
                        .is_none_or(|id| id.get().to_string() != guild)
                    || issued > now
                    || now.saturating_sub(issued) > ACTIVATION_TTL_SECONDS
                {
                    let content = self.component_message(
                        "premium.activateCancelled",
                        &component,
                        &BTreeMap::new(),
                    )?;
                    component
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
                    return Ok(());
                }
                let content = if action == "no" {
                    self.component_message(
                        "premium.activateCancelled",
                        &component,
                        &BTreeMap::new(),
                    )?
                } else {
                    let result = self
                        .store
                        .lock()
                        .map_err(|_| GatewayEventDispatchError)?
                        .activate_seat(user, guild, now_ms())
                        .map_err(|_| GatewayEventDispatchError)?;
                    match result.status {
                        ActivateStatus::Ok => {
                            let mut p = BTreeMap::new();
                            p.insert("date", discord_date(result.expires_at.unwrap_or(0)));
                            p.insert("used", result.used.unwrap_or_default().to_string());
                            p.insert("total", result.seats.unwrap_or_default().to_string());
                            self.component_message("premium.activateOk", &component, &p)?
                        }
                        ActivateStatus::Already => self.component_message(
                            "premium.alreadyActive",
                            &component,
                            &BTreeMap::new(),
                        )?,
                        ActivateStatus::NoSeats => {
                            let mut p = BTreeMap::new();
                            p.insert("total", result.seats.unwrap_or_default().to_string());
                            p.insert(
                                "servers",
                                self.store
                                    .lock()
                                    .map_err(|_| GatewayEventDispatchError)?
                                    .pass_activations(user)
                                    .map_err(|_| GatewayEventDispatchError)?
                                    .join(", "),
                            );
                            self.component_message("premium.noSeats", &component, &p)?
                        }
                        ActivateStatus::NoPass | ActivateStatus::Expired => {
                            let mut p = BTreeMap::new();
                            p.insert("link", self.kofi_url.clone());
                            self.component_message("premium.noPass", &component, &p)?
                        }
                    }
                };
                component
                    .create_response(
                        &context,
                        CreateInteractionResponse::UpdateMessage(
                            CreateInteractionResponseMessage::new()
                                .content(content)
                                .components(Vec::new())
                                .ephemeral(true),
                        ),
                    )
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
            }
            _ => {}
        }
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

fn now_seconds() -> i64 {
    now_ms().div_euclid(1_000)
}
