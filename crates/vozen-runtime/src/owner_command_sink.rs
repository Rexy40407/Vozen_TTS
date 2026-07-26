//! Opt-in gateway adapter for the owner-only Premium grant and gift-code commands.
//!
//! The command catalog keeps these roots in the owner guild, but the sink repeats both the owner
//! identity and owner-guild checks before touching SQLite. It therefore remains safe if a stale
//! command registration or a forged interaction reaches the gateway.

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::ui::message_embed;
use serenity::{
    builder::{CreateAllowedMentions, CreateInteractionResponse, CreateInteractionResponseMessage},
    client::Context,
    model::application::Interaction,
};
use uuid::Uuid;
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, OwnerCommand, OwnerPlan, VoiceResponseLocalizer,
    parse_owner_command,
};
use vozen_store::{PremiumCodeInput, PremiumCodePlan, SqliteStore};

const DAY_MS: i64 = 86_400_000;
const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";

#[derive(Clone)]
pub struct OwnerCommandRuntimeOptions {
    pub owner_id: String,
    pub owner_guild_id: String,
}

pub struct OwnerCommandGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    options: OwnerCommandRuntimeOptions,
    localizer: VoiceResponseLocalizer,
}

impl OwnerCommandGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        options: OwnerCommandRuntimeOptions,
    ) -> Result<Self, GatewayEventDispatchError> {
        Ok(Self {
            store,
            options,
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

    fn authorized(&self, command: &serenity::model::application::CommandInteraction) -> bool {
        owner_identity_matches(
            &self.options.owner_id,
            &self.options.owner_guild_id,
            command.user.id.get(),
            command.guild_id.map(|guild_id| guild_id.get()),
        )
    }

    fn response(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        if !self.authorized(command) {
            return self.message("grant.denied", command, &BTreeMap::new());
        }
        let parsed = parse_owner_command(&command.data).map_err(|_| GatewayEventDispatchError)?;
        let Some(parsed) = parsed else {
            return self.message("error.generic", command, &BTreeMap::new());
        };
        match parsed {
            OwnerCommand::Grant {
                user_id,
                plan,
                days,
                seats,
            } => {
                let now = now_ms();
                let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
                let expires_at = match plan {
                    OwnerPlan::Plus => store
                        .grant_user_premium(&user_id.to_string(), days, "manual", now)
                        .map_err(|_| GatewayEventDispatchError)?,
                    OwnerPlan::Premium => store
                        .grant_guild_pass(&user_id.to_string(), seats, days, "manual", now)
                        .map_err(|_| GatewayEventDispatchError)?,
                };
                let mut parameters = BTreeMap::new();
                parameters.insert("user", user_id.to_string());
                parameters.insert("days", days.to_string());
                parameters.insert("date", discord_date(expires_at));
                if plan == OwnerPlan::Plus {
                    self.message("grant.okPlus", command, &parameters)
                } else {
                    parameters.insert("seats", seats.to_string());
                    self.message("grant.okPremium", command, &parameters)
                }
            }
            OwnerCommand::GenerateCode {
                plan,
                days,
                seats,
                amount,
                expires_days,
            } => {
                let now = now_ms();
                let expires_at =
                    expires_days.map(|value| now.saturating_add(value.saturating_mul(DAY_MS)));
                let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
                let mut codes = Vec::with_capacity(amount as usize);
                for _ in 0..amount {
                    for _ in 0..5 {
                        let code = generate_code();
                        let input = PremiumCodeInput {
                            code: code.clone(),
                            plan: match plan {
                                OwnerPlan::Premium => PremiumCodePlan::Premium,
                                OwnerPlan::Plus => PremiumCodePlan::Plus,
                            },
                            days,
                            seats,
                            created_by: self.options.owner_id.clone(),
                            created_at: now,
                            expires_at,
                        };
                        if store
                            .insert_premium_code(&input)
                            .map_err(|_| GatewayEventDispatchError)?
                        {
                            codes.push(code);
                            break;
                        }
                    }
                }
                let mut parameters = BTreeMap::new();
                parameters.insert("count", codes.len().to_string());
                parameters.insert(
                    "plan",
                    match plan {
                        OwnerPlan::Premium => "premium".to_owned(),
                        OwnerPlan::Plus => "plus".to_owned(),
                    },
                );
                parameters.insert("days", days.to_string());
                parameters.insert(
                    "list",
                    codes
                        .iter()
                        .map(|code| format!("`{code}`"))
                        .collect::<Vec<_>>()
                        .join("\n"),
                );
                self.message("gencode.done", command, &parameters)
            }
        }
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for OwnerCommandGatewaySink {
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
        if command.data.name != "vozen-grant" && command.data.name != "generate-code" {
            return Ok(());
        }
        let response = CreateInteractionResponseMessage::new()
            .embeds(vec![message_embed(self.response(&command)?)])
            .ephemeral(true)
            .allowed_mentions(
                CreateAllowedMentions::new()
                    .all_users(false)
                    .all_roles(false)
                    .everyone(false),
            );
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

fn generate_code() -> String {
    let mut value = Uuid::new_v4().as_u128();
    let mut chars = [b'A'; 8];
    for character in &mut chars {
        let index = (value % CODE_ALPHABET.len() as u128) as usize;
        *character = CODE_ALPHABET[index];
        value = value
            .checked_div(CODE_ALPHABET.len() as u128)
            .unwrap_or_else(|| Uuid::new_v4().as_u128());
    }
    format!(
        "VOZEN-{}-{}",
        String::from_utf8_lossy(&chars[..4]),
        String::from_utf8_lossy(&chars[4..])
    )
}

fn discord_date(ms: i64) -> String {
    format!("<t:{}:D>", ms.div_euclid(1_000))
}

fn owner_identity_matches(
    owner_id: &str,
    owner_guild_id: &str,
    user_id: u64,
    guild_id: Option<u64>,
) -> bool {
    user_id.to_string() == owner_id && guild_id.is_some_and(|id| id.to_string() == owner_guild_id)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| {
            duration.as_millis().min(i64::MAX as u128) as i64
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_codes_keep_the_node_format_and_safe_alphabet() {
        for _ in 0..32 {
            let code = generate_code();
            assert!(code.starts_with("VOZEN-"));
            assert_eq!(code.len(), 15);
            assert!(
                code.strip_prefix("VOZEN-")
                    .expect("prefix")
                    .bytes()
                    .all(|byte| byte == b'-' || CODE_ALPHABET.contains(&byte))
            );
        }
    }

    #[test]
    fn discord_date_matches_node_timestamp_shape() {
        assert_eq!(discord_date(1_234_567), "<t:1234:D>");
    }

    #[test]
    fn owner_authorization_requires_both_user_and_control_guild() {
        assert!(owner_identity_matches(
            "123456789012345678",
            "223456789012345678",
            123456789012345678,
            Some(223456789012345678),
        ));
        assert!(!owner_identity_matches(
            "123456789012345678",
            "223456789012345678",
            123456789012345679,
            Some(223456789012345678),
        ));
        assert!(!owner_identity_matches(
            "123456789012345678",
            "223456789012345678",
            123456789012345678,
            None,
        ));
    }
}
