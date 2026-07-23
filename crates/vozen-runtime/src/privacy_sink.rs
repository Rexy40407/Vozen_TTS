//! Opt-in gateway adapter for the destructive `/privacy erase` flow.

use std::{
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use serenity::{
    builder::{
        CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
    },
    client::Context,
    model::application::{ButtonStyle, Interaction},
};
use vozen_discord::{
    GatewayEventDispatchError, GatewayEventSink, VoiceResponseLocalizer,
    parse_privacy_erase_command,
};
use vozen_store::SqliteStore;

const CONFIRMATION_TTL_SECONDS: i64 = 30;

fn confirmation_is_fresh(issued_at: i64, now: i64) -> bool {
    issued_at <= now && now.saturating_sub(issued_at) <= CONFIRMATION_TTL_SECONDS
}

pub struct PrivacyGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    localizer: VoiceResponseLocalizer,
}

impl PrivacyGatewaySink {
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
        locale: &str,
        guild_locale: Option<&str>,
    ) -> Result<String, GatewayEventDispatchError> {
        self.localizer
            .render_key(key, Some(locale), guild_locale, &Default::default())
            .ok_or(GatewayEventDispatchError)
    }

    fn warning(
        &self,
        command: &serenity::model::application::CommandInteraction,
    ) -> Result<String, GatewayEventDispatchError> {
        let user_id = command.user.id.to_string();
        let guild_id = command.guild_id.map(|id| id.get().to_string());
        let now_ms = now_ms();
        let store = self.store.lock().map_err(|_| GatewayEventDispatchError)?;
        let has_paid = store
            .is_user_premium(&user_id, now_ms)
            .map_err(|_| GatewayEventDispatchError)?
            || guild_id
                .as_deref()
                .map(|guild_id| {
                    store
                        .is_guild_premium(guild_id, now_ms)
                        .map_err(|_| GatewayEventDispatchError)
                })
                .transpose()?
                .unwrap_or(false);
        let confirm = self.message(
            "privacy.eraseConfirm",
            &command.locale,
            command.guild_locale.as_deref(),
        )?;
        if has_paid {
            Ok(format!(
                "{confirm}\n\n{}",
                self.message(
                    "privacy.erasePremiumNote",
                    &command.locale,
                    command.guild_locale.as_deref(),
                )?
            ))
        } else {
            Ok(confirm)
        }
    }

    fn confirmation_id(action: &str, user_id: &str, issued_at: i64) -> String {
        format!("privacy:{action}:{user_id}:{issued_at}")
    }

    fn parse_confirmation(id: &str) -> Option<(&str, &str, i64)> {
        let mut parts = id.split(':');
        if parts.next()? != "privacy" {
            return None;
        }
        let action = parts.next()?;
        let user_id = parts.next()?;
        let issued_at = parts.next()?.parse().ok()?;
        (parts.next().is_none() && matches!(action, "yes" | "no"))
            .then_some((action, user_id, issued_at))
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for PrivacyGatewaySink {
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
                if parse_privacy_erase_command(&command.data)
                    .map_err(|_| GatewayEventDispatchError)?
                    .is_none()
                {
                    return Ok(());
                }
                let issued_at = now_seconds();
                let user_id = command.user.id.to_string();
                let response = CreateInteractionResponseMessage::new()
                    .content(self.warning(&command)?)
                    .components(vec![CreateActionRow::Buttons(vec![
                        CreateButton::new(Self::confirmation_id("yes", &user_id, issued_at))
                            .label(self.message(
                                "privacy.eraseYes",
                                &command.locale,
                                command.guild_locale.as_deref(),
                            )?)
                            .style(ButtonStyle::Danger)
                            .emoji('🗑'),
                        CreateButton::new(Self::confirmation_id("no", &user_id, issued_at))
                            .label(self.message(
                                "privacy.eraseNo",
                                &command.locale,
                                command.guild_locale.as_deref(),
                            )?)
                            .style(ButtonStyle::Secondary),
                    ])])
                    .ephemeral(true);
                command
                    .create_response(&context, CreateInteractionResponse::Message(response))
                    .await
                    .map_err(|_| GatewayEventDispatchError)?;
            }
            Interaction::Component(component) => {
                let Some((action, expected_user, issued_at)) =
                    Self::parse_confirmation(&component.data.custom_id)
                else {
                    return Ok(());
                };
                let current_user = component.user.id.to_string();
                let now = now_seconds();
                if expected_user != current_user || !confirmation_is_fresh(issued_at, now) {
                    let response = CreateInteractionResponseMessage::new()
                        .content(self.message(
                            "privacy.eraseCancelled",
                            &component.locale,
                            component.guild_locale.as_deref(),
                        )?)
                        .ephemeral(true);
                    component
                        .create_response(&context, CreateInteractionResponse::Message(response))
                        .await
                        .map_err(|_| GatewayEventDispatchError)?;
                    return Ok(());
                }
                let content = if action == "yes" {
                    match self
                        .store
                        .lock()
                        .map_err(|_| GatewayEventDispatchError)?
                        .erase_user_data(&current_user)
                    {
                        Ok(()) => self.message(
                            "privacy.eraseDone",
                            &component.locale,
                            component.guild_locale.as_deref(),
                        )?,
                        Err(_) => self.message(
                            "error.generic",
                            &component.locale,
                            component.guild_locale.as_deref(),
                        )?,
                    }
                } else {
                    self.message(
                        "privacy.eraseCancelled",
                        &component.locale,
                        component.guild_locale.as_deref(),
                    )?
                };
                let response = CreateInteractionResponseMessage::new()
                    .content(content)
                    .components(Vec::new())
                    .ephemeral(true);
                component
                    .create_response(&context, CreateInteractionResponse::UpdateMessage(response))
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

fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs() as i64)
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
    use super::PrivacyGatewaySink;

    #[test]
    fn confirmation_ids_bind_action_user_and_expiry() {
        let id = PrivacyGatewaySink::confirmation_id("yes", "123", 456);
        assert_eq!(
            PrivacyGatewaySink::parse_confirmation(&id),
            Some(("yes", "123", 456))
        );
        assert!(PrivacyGatewaySink::parse_confirmation("privacy:yes:123:not-a-time").is_none());
        assert!(PrivacyGatewaySink::parse_confirmation("privacy:yes:123:456:extra").is_none());
    }

    #[test]
    fn future_and_expired_confirmations_are_not_fresh() {
        assert!(super::confirmation_is_fresh(100, 100));
        assert!(super::confirmation_is_fresh(70, 100));
        assert!(!super::confirmation_is_fresh(69, 100));
        assert!(!super::confirmation_is_fresh(101, 100));
    }
}
