//! Opt-in Discord delivery adapter for automatic channel translation.
//!
//! It performs a current permission check for both mapped channels before forwarding only the
//! minimised message to the translation service. The Node listener remains authoritative until
//! the matching ownership flag is deliberately enabled.

use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
};

use serenity::{
    builder::{CreateAllowedMentions, CreateMessage},
    client::Context,
    model::{
        Permissions,
        application::Interaction,
        channel::{ChannelType, Message},
        id::{ChannelId, GuildId, UserId},
    },
};
use vozen_core::TRANSLATION_MARKER;
use vozen_discord::{
    AutomaticTranslationInvocation, AutomaticTranslationOutcome, AutomaticTranslationService,
    GatewayEventDispatchError, GatewayEventSink, GatewayState,
};
use vozen_store::SqliteStore;

use crate::{system_now_ms, translation_provider::RuntimeTranslationProvider};

const QUOTA_NOTICE_COOLDOWN_MS: i64 = 5 * 60 * 1_000;
const MAX_QUOTA_NOTICE_KEYS: usize = 500;
const SHORTENED_NOTICE: &str = "\n\n_Translation was shortened to the configured safety limit._";
const QUOTA_NOTICE: &str = "Translation limit reached; try again later.";

#[derive(Default)]
struct QuotaNoticeCooldown {
    timestamps: HashMap<(String, String), i64>,
    order: VecDeque<(String, String)>,
}

impl QuotaNoticeCooldown {
    fn should_notify(&mut self, guild_id: &str, user_id: &str, now_ms: i64) -> bool {
        self.timestamps
            .retain(|_, timestamp| now_ms.saturating_sub(*timestamp) < QUOTA_NOTICE_COOLDOWN_MS);
        self.order.retain(|key| self.timestamps.contains_key(key));
        let key = (guild_id.to_owned(), user_id.to_owned());
        if self.timestamps.contains_key(&key) {
            return false;
        }
        while self.timestamps.len() >= MAX_QUOTA_NOTICE_KEYS {
            let Some(expired) = self.order.pop_front() else {
                break;
            };
            self.timestamps.remove(&expired);
        }
        self.timestamps.insert(key.clone(), now_ms);
        self.order.push_back(key);
        true
    }

    fn forget_guild(&mut self, guild_id: &str) {
        self.timestamps.retain(|(guild, _), _| guild != guild_id);
        self.order.retain(|(guild, _)| guild != guild_id);
    }
}

pub struct AutomaticTranslationGatewaySink {
    store: Arc<Mutex<SqliteStore>>,
    service: AutomaticTranslationService<RuntimeTranslationProvider>,
    gateway_state: GatewayState,
    quota_notices: Mutex<QuotaNoticeCooldown>,
}

impl AutomaticTranslationGatewaySink {
    pub fn new(
        store: Arc<Mutex<SqliteStore>>,
        gateway_state: GatewayState,
        provider: RuntimeTranslationProvider,
    ) -> Self {
        Self {
            service: AutomaticTranslationService::new(
                Arc::clone(&store),
                provider,
                Arc::new(system_now_ms),
            ),
            store,
            gateway_state,
            quota_notices: Mutex::new(QuotaNoticeCooldown::default()),
        }
    }

    fn mapped_destination(&self, guild_id: &str, source_channel_id: &str) -> Option<String> {
        self.store
            .lock()
            .ok()?
            .translation_mappings(guild_id)
            .ok()?
            .into_iter()
            .find(|mapping| mapping.source_channel_id == source_channel_id)
            .map(|mapping| mapping.destination_channel_id)
    }

    async fn permits_mapping(
        &self,
        context: &Context,
        guild_id: &str,
        source_channel_id: &str,
        destination_channel_id: &str,
    ) -> bool {
        let (Ok(guild_id), Ok(source_channel_id), Ok(destination_channel_id), Some(bot_user_id)) = (
            guild_id.parse::<u64>(),
            source_channel_id.parse::<u64>(),
            destination_channel_id.parse::<u64>(),
            self.gateway_state.bot_user_id(),
        ) else {
            return false;
        };
        let Ok(bot_user_id) = bot_user_id.parse::<u64>() else {
            return false;
        };
        let guild_id = GuildId::new(guild_id);
        let (guild, channels, member) = tokio::join!(
            guild_id.to_partial_guild(&context.http),
            guild_id.channels(&context.http),
            guild_id.member(&context.http, UserId::new(bot_user_id)),
        );
        let (Ok(guild), Ok(channels), Ok(member)) = (guild, channels, member) else {
            return false;
        };
        let Some(source) = channels.get(&ChannelId::new(source_channel_id)) else {
            return false;
        };
        let Some(destination) = channels.get(&ChannelId::new(destination_channel_id)) else {
            return false;
        };
        matches!(source.kind, ChannelType::Text)
            && matches!(destination.kind, ChannelType::Text)
            && guild
                .user_permissions_in(source, &member)
                .contains(Permissions::VIEW_CHANNEL)
            && guild
                .user_permissions_in(destination, &member)
                .contains(Permissions::VIEW_CHANNEL | Permissions::SEND_MESSAGES)
    }

    async fn send_quota_notice(
        &self,
        context: &Context,
        source_channel_id: ChannelId,
        guild_id: &str,
        author_id: &str,
    ) {
        let should_notify = self
            .quota_notices
            .lock()
            .is_ok_and(|mut notices| notices.should_notify(guild_id, author_id, system_now_ms()));
        if !should_notify {
            return;
        }
        let _ = source_channel_id
            .send_message(
                &context.http,
                CreateMessage::new()
                    .content(QUOTA_NOTICE)
                    .allowed_mentions(no_mentions()),
            )
            .await;
    }
}

#[async_trait::async_trait]
impl GatewayEventSink for AutomaticTranslationGatewaySink {
    async fn on_message(
        &self,
        context: Context,
        message: Message,
    ) -> Result<(), GatewayEventDispatchError> {
        let Some(guild_id) = message.guild_id.map(|id| id.get().to_string()) else {
            return Ok(());
        };
        // Match Node's early exits before making any REST request. Automatic translation never
        // reads bot/webhook traffic, and blank content cannot produce a safe provider input.
        if message.content.trim().is_empty() || message.author.bot || message.webhook_id.is_some() {
            return Ok(());
        }
        let Some(bot_user_id) = self.gateway_state.bot_user_id() else {
            return Ok(());
        };
        if message.author.id.get().to_string() == bot_user_id {
            return Ok(());
        }
        let source_channel_id = message.channel_id.get().to_string();
        let Some(destination_channel_id) = self.mapped_destination(&guild_id, &source_channel_id)
        else {
            return Ok(());
        };
        if !self
            .permits_mapping(
                &context,
                &guild_id,
                &source_channel_id,
                &destination_channel_id,
            )
            .await
        {
            return Ok(());
        }
        let outcome = self
            .service
            .prepare(AutomaticTranslationInvocation {
                guild_id: &guild_id,
                channel_id: &source_channel_id,
                author_id: &message.author.id.get().to_string(),
                raw: &message.content,
                is_self: false,
                is_bot: message.author.bot,
                is_webhook: message.webhook_id.is_some(),
                authorized_destination_channel_id: Some(&destination_channel_id),
            })
            .await;
        match outcome {
            AutomaticTranslationOutcome::Ready(delivery) => {
                let Ok(destination_channel_id) = delivery.destination_channel_id.parse::<u64>()
                else {
                    return Ok(());
                };
                let content = format!(
                    "{}{}{}",
                    delivery.text,
                    if delivery.shortened {
                        SHORTENED_NOTICE
                    } else {
                        ""
                    },
                    TRANSLATION_MARKER
                );
                if ChannelId::new(destination_channel_id)
                    .send_message(
                        &context.http,
                        CreateMessage::new()
                            .content(content)
                            .allowed_mentions(no_mentions()),
                    )
                    .await
                    .is_ok()
                {
                    delivery.mark_delivered();
                }
            }
            AutomaticTranslationOutcome::QuotaExceeded => {
                self.send_quota_notice(
                    &context,
                    message.channel_id,
                    &guild_id,
                    &message.author.id.get().to_string(),
                )
                .await;
            }
            _ => {}
        }
        Ok(())
    }

    async fn on_interaction(
        &self,
        _context: Context,
        _interaction: Interaction,
    ) -> Result<(), GatewayEventDispatchError> {
        Ok(())
    }

    async fn on_guild_delete(&self, guild_id: &str) -> Result<(), GatewayEventDispatchError> {
        if let Ok(mut notices) = self.quota_notices.lock() {
            notices.forget_guild(guild_id);
        }
        Ok(())
    }
}

fn no_mentions() -> CreateAllowedMentions {
    CreateAllowedMentions::new()
        .all_users(false)
        .all_roles(false)
        .everyone(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quota_notice_is_per_guild_and_user_with_a_bounded_cooldown_map() {
        let mut notices = QuotaNoticeCooldown::default();
        assert!(notices.should_notify("guild", "user", 100));
        assert!(!notices.should_notify("guild", "user", 101));
        assert!(notices.should_notify("guild", "other", 101));
        assert!(notices.should_notify("guild", "user", 100 + QUOTA_NOTICE_COOLDOWN_MS));
        for index in 0..=MAX_QUOTA_NOTICE_KEYS {
            assert!(notices.should_notify("other", &format!("user-{index}"), 1_000_000));
        }
        assert!(notices.timestamps.len() <= MAX_QUOTA_NOTICE_KEYS);
    }

    #[test]
    fn forgetting_a_guild_removes_only_its_quota_notice_state() {
        let mut notices = QuotaNoticeCooldown::default();
        assert!(notices.should_notify("first", "user", 100));
        assert!(notices.should_notify("second", "user", 100));
        notices.forget_guild("first");
        assert!(
            !notices
                .timestamps
                .contains_key(&(String::from("first"), String::from("user")))
        );
        assert!(
            notices
                .timestamps
                .contains_key(&(String::from("second"), String::from("user")))
        );
    }
}
