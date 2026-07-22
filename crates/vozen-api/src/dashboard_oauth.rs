//! Discord OAuth adapter for the dashboard authorization boundary.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::dashboard_api::{DashboardAccess, DashboardAuthorizer, ManageableGuild};

const DISCORD_OAUTH_ME: &str = "https://discord.com/api/v10/oauth2/@me";
const DISCORD_GUILDS: &str = "https://discord.com/api/v10/users/@me/guilds";
const DASHBOARD_TIMEOUT: Duration = Duration::from_secs(5);
const CACHE_TTL_MS: i64 = 60_000;
const CACHE_MAX_ENTRIES: usize = 512;
const MANAGE_GUILD: u64 = 0x20;
const ADMINISTRATOR: u64 = 0x8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DashboardDiscordError {
    InvalidToken,
    Unavailable,
}

#[async_trait]
pub trait DashboardDiscordHttp: Send + Sync {
    async fn get_json(
        &self,
        url: &'static str,
        bearer: &str,
    ) -> Result<Value, DashboardDiscordError>;
}

#[derive(Clone)]
pub struct ReqwestDashboardDiscordHttp {
    client: reqwest::Client,
}

impl ReqwestDashboardDiscordHttp {
    pub fn new() -> Result<Self, reqwest::Error> {
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(DASHBOARD_TIMEOUT)
                .build()?,
        })
    }
}

#[async_trait]
impl DashboardDiscordHttp for ReqwestDashboardDiscordHttp {
    async fn get_json(
        &self,
        url: &'static str,
        bearer: &str,
    ) -> Result<Value, DashboardDiscordError> {
        let response = self
            .client
            .get(url)
            .bearer_auth(bearer)
            .send()
            .await
            .map_err(|_| DashboardDiscordError::Unavailable)?;
        if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
            return Err(DashboardDiscordError::InvalidToken);
        }
        if !response.status().is_success() {
            return Err(DashboardDiscordError::Unavailable);
        }
        response
            .json()
            .await
            .map_err(|_| DashboardDiscordError::Unavailable)
    }
}

type BotPresence = Arc<dyn Fn(&str) -> bool + Send + Sync>;

#[derive(Clone)]
pub struct DiscordDashboardAuthorizer {
    expected_client_id: Arc<str>,
    http: Arc<dyn DashboardDiscordHttp>,
    bot_has_guild: BotPresence,
    now: Arc<dyn Fn() -> i64 + Send + Sync>,
    cache: Arc<Mutex<HashMap<[u8; 32], CachedGuilds>>>,
}

#[derive(Clone)]
struct CachedGuilds {
    guilds: Option<Vec<ManageableGuild>>,
    expires_at: i64,
}

impl DiscordDashboardAuthorizer {
    pub fn production(
        expected_client_id: impl Into<String>,
        bot_has_guild: impl Fn(&str) -> bool + Send + Sync + 'static,
    ) -> Result<Self, reqwest::Error> {
        Ok(Self::new(
            expected_client_id,
            Arc::new(ReqwestDashboardDiscordHttp::new()?),
            Arc::new(bot_has_guild),
            Arc::new(system_now_ms),
        ))
    }

    pub fn new(
        expected_client_id: impl Into<String>,
        http: Arc<dyn DashboardDiscordHttp>,
        bot_has_guild: BotPresence,
        now: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self {
            expected_client_id: Arc::from(expected_client_id.into()),
            http,
            bot_has_guild,
            now,
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn fetch_manageable(&self, bearer: &str) -> Option<Vec<ManageableGuild>> {
        let now = (self.now)();
        let key = token_hash(bearer);
        if let Some(cached) = self.cache_get(key, now) {
            return cached;
        }
        let guilds = match self.http.get_json(DISCORD_OAUTH_ME, bearer).await {
            Ok(oauth) if oauth_authorized(&oauth, &self.expected_client_id) => {
                match self.http.get_json(DISCORD_GUILDS, bearer).await {
                    Ok(guilds) => parse_manageable_guilds(guilds, &self.bot_has_guild),
                    Err(_) => None,
                }
            }
            _ => None,
        };
        self.cache_put(key, guilds.clone(), now);
        guilds
    }

    fn cache_get(&self, key: [u8; 32], now: i64) -> Option<Option<Vec<ManageableGuild>>> {
        let Ok(mut cache) = self.cache.lock() else {
            return None;
        };
        cache.retain(|_, item| item.expires_at > now);
        cache.get(&key).map(|item| item.guilds.clone())
    }

    fn cache_put(&self, key: [u8; 32], guilds: Option<Vec<ManageableGuild>>, now: i64) {
        let Ok(mut cache) = self.cache.lock() else {
            return;
        };
        cache.retain(|_, item| item.expires_at > now);
        while cache.len() >= CACHE_MAX_ENTRIES && !cache.contains_key(&key) {
            let Some(oldest) = cache
                .iter()
                .min_by_key(|(_, value)| value.expires_at)
                .map(|(key, _)| *key)
            else {
                break;
            };
            cache.remove(&oldest);
        }
        cache.insert(
            key,
            CachedGuilds {
                guilds,
                expires_at: now.saturating_add(CACHE_TTL_MS),
            },
        );
    }
}

#[async_trait]
impl DashboardAuthorizer for DiscordDashboardAuthorizer {
    async fn manageable_guilds(&self, bearer: &str) -> DashboardAccess<Vec<ManageableGuild>> {
        self.fetch_manageable(bearer)
            .await
            .map_or(DashboardAccess::Unauthenticated, DashboardAccess::Allowed)
    }

    async fn authorize_guild(&self, bearer: &str, guild_id: &str) -> DashboardAccess<()> {
        let Some(guilds) = self.fetch_manageable(bearer).await else {
            return DashboardAccess::Unauthenticated;
        };
        if !(self.bot_has_guild)(guild_id) || !guilds.iter().any(|guild| guild.id == guild_id) {
            DashboardAccess::Forbidden
        } else {
            DashboardAccess::Allowed(())
        }
    }
}

fn oauth_authorized(value: &Value, expected_client_id: &str) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    let application_id = object
        .get("application")
        .and_then(Value::as_object)
        .and_then(|application| application.get("id"))
        .and_then(Value::as_str);
    let scopes: Vec<_> = object
        .get("scopes")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    application_id == Some(expected_client_id)
        && scopes.contains(&"identify")
        && scopes.contains(&"guilds")
}

fn parse_manageable_guilds(
    value: Value,
    bot_has_guild: &BotPresence,
) -> Option<Vec<ManageableGuild>> {
    let rows = value.as_array()?;
    Some(
        rows.iter()
            .filter_map(|row| {
                let object = row.as_object()?;
                let id = object.get("id")?.as_str()?;
                if !(bot_has_guild)(id)
                    || !can_manage(object.get("permissions"), object.get("owner"))
                {
                    return None;
                }
                Some(ManageableGuild {
                    id: id.to_owned(),
                    name: object
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or(id)
                        .to_owned(),
                    icon: object
                        .get("icon")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                })
            })
            .collect(),
    )
}

fn can_manage(permissions: Option<&Value>, owner: Option<&Value>) -> bool {
    if owner == Some(&Value::Bool(true)) {
        return true;
    }
    let bits = match permissions {
        Some(Value::String(value)) => value.parse::<u64>().ok(),
        Some(Value::Number(value)) => value.as_u64(),
        _ => None,
    };
    bits.is_some_and(|bits| bits & MANAGE_GUILD != 0 || bits & ADMINISTRATOR != 0)
}

fn token_hash(token: &str) -> [u8; 32] {
    Sha256::digest(token.as_bytes()).into()
}
fn system_now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct Fake {
        oauth: Value,
        guilds: Value,
    }
    #[async_trait]
    impl DashboardDiscordHttp for Fake {
        async fn get_json(
            &self,
            url: &'static str,
            _bearer: &str,
        ) -> Result<Value, DashboardDiscordError> {
            Ok(match url {
                DISCORD_OAUTH_ME => self.oauth.clone(),
                DISCORD_GUILDS => self.guilds.clone(),
                _ => unreachable!(),
            })
        }
    }
    fn authorizer(oauth: Value, guilds: Value, present: bool) -> DiscordDashboardAuthorizer {
        DiscordDashboardAuthorizer::new(
            "our-app",
            Arc::new(Fake { oauth, guilds }),
            Arc::new(move |_| present),
            Arc::new(|| 1_000),
        )
    }

    #[tokio::test]
    async fn accepts_only_our_guild_scoped_tokens_and_manageable_live_guilds() {
        let auth = authorizer(
            json!({"application":{"id":"our-app"},"scopes":["identify","guilds"]}),
            json!([
                {"id":"guild-a","name":"Mine","permissions":"32"},
                {"id":"guild-b","name":"No access","permissions":"0"}
            ]),
            true,
        );
        assert_eq!(
            auth.manageable_guilds("secret").await,
            DashboardAccess::Allowed(vec![ManageableGuild {
                id: "guild-a".into(),
                name: "Mine".into(),
                icon: None
            }])
        );
        assert_eq!(
            auth.authorize_guild("secret", "guild-a").await,
            DashboardAccess::Allowed(())
        );
        assert_eq!(
            auth.authorize_guild("secret", "guild-b").await,
            DashboardAccess::Forbidden
        );
    }

    #[tokio::test]
    async fn wrong_audience_or_scope_fails_closed_before_guild_data_is_used() {
        let auth = authorizer(
            json!({"application":{"id":"other"},"scopes":["identify","guilds"]}),
            json!([]),
            true,
        );
        assert_eq!(
            auth.manageable_guilds("secret").await,
            DashboardAccess::Unauthenticated
        );
        let no_scope = authorizer(
            json!({"application":{"id":"our-app"},"scopes":["identify"]}),
            json!([]),
            true,
        );
        assert_eq!(
            no_scope.authorize_guild("secret", "guild-a").await,
            DashboardAccess::Unauthenticated
        );
    }
}
