//! Owner-only admin console logic.
//!
//! This is the Rust counterpart of `src/premium/adminApi.ts`. HTTP wiring is intentionally kept
//! separate so the authentication and money-surface decisions can be tested without opening a
//! listener. A caller must still install this service behind an owner-only route.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use serde::Serialize;
use vozen_store::{AdminPassRow, AdminPassesView, AdminPlusRow, KofiPendingGrant, SqliteStore};

use crate::admin_auth::{
    DEFAULT_ADMIN_SESSION_TTL_SECONDS, sign_admin_session, verify_admin_session,
};

const MAX_DAYS: i64 = 3_650;
const MAX_SEATS: i64 = 100;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminAuthorization {
    pub user_id: String,
    pub application_id: String,
}

#[async_trait]
pub trait AdminAuthorizationResolver: Send + Sync {
    async fn resolve_authorization(&self, bearer: &str) -> Option<AdminAuthorization>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AdminLogin {
    pub token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AdminPlus {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AdminPass {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub seats: i64,
    pub used: i64,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AdminPending {
    #[serde(rename = "transactionId")]
    pub transaction_id: String,
    #[serde(rename = "emailHash")]
    pub email_hash: Option<String>,
    pub plan: String,
    pub days: i64,
    pub seats: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "claimedAt")]
    pub claimed_at: Option<i64>,
    #[serde(rename = "isSubscription")]
    pub is_subscription: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AdminPasses {
    pub plus: Vec<AdminPlus>,
    pub passes: Vec<AdminPass>,
    pub pending: Vec<AdminPending>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdminGrant {
    Plus { id: String, days: i64 },
    Premium { id: String, days: i64, seats: i64 },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdminGrantError {
    BadId,
    BadDays,
    BadSeats,
    Store,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdminRevoke {
    Plus { id: String },
    Premium { id: String },
}

#[derive(Clone)]
pub struct AdminApi {
    store: Arc<Mutex<SqliteStore>>,
    resolver: Arc<dyn AdminAuthorizationResolver>,
    now: Arc<dyn Fn() -> i64 + Send + Sync>,
    secret: Option<Arc<str>>,
    owner_id: Option<Arc<str>>,
    client_id: Option<Arc<str>>,
    ttl_seconds: i64,
    log: Arc<dyn Fn(&str) + Send + Sync>,
}

pub struct AdminApiConfig {
    pub store: Arc<Mutex<SqliteStore>>,
    pub resolver: Arc<dyn AdminAuthorizationResolver>,
    pub now: Arc<dyn Fn() -> i64 + Send + Sync>,
    pub admin_session_secret: Option<String>,
    pub owner_id: Option<String>,
    pub admin_client_id: Option<String>,
    pub session_ttl_seconds: Option<i64>,
    pub log: Arc<dyn Fn(&str) + Send + Sync>,
}

impl AdminApi {
    #[must_use]
    pub fn new(config: AdminApiConfig) -> Self {
        let strong_secret = config
            .admin_session_secret
            .as_deref()
            .is_some_and(|secret| secret.len() >= 32);
        if config.admin_session_secret.is_some() && !strong_secret {
            (config.log)("[admin] ADMIN_SESSION_SECRET is shorter than 32 chars — admin disabled");
        }
        Self {
            store: config.store,
            resolver: config.resolver,
            now: config.now,
            secret: strong_secret.then(|| Arc::<str>::from(config.admin_session_secret.unwrap())),
            owner_id: config
                .owner_id
                .filter(|value| !value.is_empty())
                .map(Arc::from),
            client_id: config
                .admin_client_id
                .filter(|value| !value.is_empty())
                .map(Arc::from),
            ttl_seconds: config
                .session_ttl_seconds
                .unwrap_or(DEFAULT_ADMIN_SESSION_TTL_SECONDS),
            log: config.log,
        }
    }

    #[must_use]
    pub fn enabled(&self) -> bool {
        self.secret.is_some() && self.owner_id.is_some() && self.client_id.is_some()
    }

    pub async fn login(&self, discord_token: Option<&str>) -> Option<AdminLogin> {
        if !self.enabled() {
            return None;
        }
        let token = discord_token?;
        let auth = self.resolver.resolve_authorization(token).await?;
        if Some(auth.user_id.as_str()) != self.owner_id.as_deref()
            || Some(auth.application_id.as_str()) != self.client_id.as_deref()
        {
            return None;
        }
        let now = (self.now)();
        let ttl = self.ttl_seconds;
        let signed = sign_admin_session(&auth.user_id, self.secret.as_deref()?, now, ttl);
        Some(AdminLogin {
            token: signed,
            expires_at: (now.div_euclid(1_000) + ttl) * 1_000,
        })
    }

    #[must_use]
    pub fn authorize(&self, session_token: Option<&str>) -> Option<String> {
        if !self.enabled() {
            return None;
        }
        let user_id = verify_admin_session(session_token, self.secret.as_deref()?, (self.now)())?;
        (Some(user_id.as_str()) == self.owner_id.as_deref()).then_some(user_id)
    }

    pub fn list_passes(&self) -> Result<AdminPasses, AdminGrantError> {
        let now = (self.now)();
        let store = self.store.lock().map_err(|_| AdminGrantError::Store)?;
        let AdminPassesView { plus, passes } = store
            .list_active_premium(now)
            .map_err(|_| AdminGrantError::Store)?;
        let pending = store
            .all_unclaimed_kofi_pending(500)
            .map_err(|_| AdminGrantError::Store)?;
        Ok(AdminPasses {
            plus: plus.into_iter().map(Into::into).collect(),
            passes: passes.into_iter().map(Into::into).collect(),
            pending: pending.into_iter().map(Into::into).collect(),
        })
    }

    pub fn grant(&self, grant: AdminGrant) -> Result<i64, AdminGrantError> {
        let now = (self.now)();
        let (kind, id, days, seats) = match grant {
            AdminGrant::Plus { id, days } => ("plus", id, days, None),
            AdminGrant::Premium { id, days, seats } => ("premium", id, days, Some(seats)),
        };
        if !valid_snowflake(&id) {
            return Err(AdminGrantError::BadId);
        }
        if !(1..=MAX_DAYS).contains(&days) {
            return Err(AdminGrantError::BadDays);
        }
        if seats.is_some_and(|seats| !(1..=MAX_SEATS).contains(&seats)) {
            return Err(AdminGrantError::BadSeats);
        }
        let store = self.store.lock().map_err(|_| AdminGrantError::Store)?;
        let expires_at = if kind == "plus" {
            store
                .grant_user_premium(&id, days, "manual", now)
                .map_err(|_| AdminGrantError::Store)?
        } else {
            store
                .grant_guild_pass(
                    &id,
                    seats.expect("validated premium seats"),
                    days,
                    "manual",
                    now,
                )
                .map_err(|_| AdminGrantError::Store)?
        };
        (self.log)(&format!("[admin] grant {kind} {id} {days}d"));
        Ok(expires_at)
    }

    pub fn revoke(&self, revoke: AdminRevoke) -> Result<bool, AdminGrantError> {
        let (kind, id) = match revoke {
            AdminRevoke::Plus { id } => ("plus", id),
            AdminRevoke::Premium { id } => ("premium", id),
        };
        if !valid_snowflake(&id) {
            return Ok(false);
        }
        let store = self.store.lock().map_err(|_| AdminGrantError::Store)?;
        let ok = if kind == "plus" {
            store.revoke_user_premium(&id)
        } else {
            store.revoke_guild_pass(&id)
        }
        .map_err(|_| AdminGrantError::Store)?;
        (self.log)(&format!("[admin] revoke {kind} {id} -> {ok}"));
        Ok(ok)
    }
}

fn valid_snowflake(value: &str) -> bool {
    !value.is_empty() && value.len() <= 20 && value.bytes().all(|byte| byte.is_ascii_digit())
}

impl From<AdminPlusRow> for AdminPlus {
    fn from(value: AdminPlusRow) -> Self {
        Self {
            user_id: value.user_id,
            expires_at: value.expires_at,
            source: value.source,
        }
    }
}

impl From<AdminPassRow> for AdminPass {
    fn from(value: AdminPassRow) -> Self {
        Self {
            user_id: value.user_id,
            seats: value.seats,
            used: value.used,
            expires_at: value.expires_at,
            source: value.source,
        }
    }
}

impl From<KofiPendingGrant> for AdminPending {
    fn from(value: KofiPendingGrant) -> Self {
        Self {
            transaction_id: value.input.transaction_id,
            email_hash: value.input.email_hash,
            plan: value.input.plan.as_str().to_owned(),
            days: value.input.days,
            seats: value.input.seats,
            created_at: value.created_at,
            claimed_at: value.claimed_at,
            is_subscription: value.input.is_subscription,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    const OWNER: &str = "1523489275155583056";
    const CLIENT: &str = "1526211106081734666";
    const SECRET: &str = "sess-secret-abcdefghijklmnopqrstuvwxyz";
    const NOW: i64 = 1_700_000_000_000;

    struct Resolver;
    #[async_trait]
    impl AdminAuthorizationResolver for Resolver {
        async fn resolve_authorization(&self, bearer: &str) -> Option<AdminAuthorization> {
            match bearer {
                "owner-token" => Some(AdminAuthorization {
                    user_id: OWNER.into(),
                    application_id: CLIENT.into(),
                }),
                "wrong-user" => Some(AdminAuthorization {
                    user_id: "999999999999999999".into(),
                    application_id: CLIENT.into(),
                }),
                "wrong-app" => Some(AdminAuthorization {
                    user_id: OWNER.into(),
                    application_id: "999000999000999000".into(),
                }),
                _ => None,
            }
        }
    }

    fn api() -> AdminApi {
        AdminApi::new(AdminApiConfig {
            store: Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store"))),
            resolver: Arc::new(Resolver),
            now: Arc::new(|| NOW),
            admin_session_secret: Some(SECRET.into()),
            owner_id: Some(OWNER.into()),
            admin_client_id: Some(CLIENT.into()),
            session_ttl_seconds: None,
            log: Arc::new(|_| {}),
        })
    }

    #[tokio::test]
    async fn login_binds_owner_and_oauth_application_and_authorize_is_session_only() {
        let api = api();
        let login = api.login(Some("owner-token")).await.expect("login");
        assert_eq!(api.authorize(Some(&login.token)).as_deref(), Some(OWNER));
        assert!(api.login(Some("wrong-user")).await.is_none());
        assert!(api.login(Some("wrong-app")).await.is_none());
        assert!(api.authorize(Some("owner-token")).is_none());
    }

    #[test]
    fn grants_reject_bad_ids_and_lists_active_rows() {
        let api = api();
        assert_eq!(
            api.grant(AdminGrant::Plus {
                id: "not-id".into(),
                days: 30
            }),
            Err(AdminGrantError::BadId)
        );
        assert_eq!(
            api.grant(AdminGrant::Plus {
                id: "111".into(),
                days: 30
            })
            .expect("grant"),
            NOW + 30 * 86_400_000
        );
        assert!(
            api.list_passes()
                .expect("list")
                .plus
                .iter()
                .any(|row| row.user_id == "111")
        );
        assert!(
            api.revoke(AdminRevoke::Plus { id: "111".into() })
                .expect("revoke")
        );
        assert!(
            !api.revoke(AdminRevoke::Plus {
                id: "111\nforged".into()
            })
            .expect("invalid")
        );
    }
}
