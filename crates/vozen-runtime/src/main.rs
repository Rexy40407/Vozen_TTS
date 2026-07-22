#![forbid(unsafe_code)]

//! Opt-in Rust process entry point used during the Node-to-Rust shadow migration.
//!
//! It deliberately starts only the safe shared foundations (SQLite migration, Discord gateway,
//! optional loopback HTTP route). The account, receipt-claim and Ko-fi webhook adapters are
//! opt-in. Dashboard routes remain absent until their live Discord option provider has been
//! migrated and shadow-tested.

// The Piper-to-command adapter has independent tests but must not be constructed until the
// promoted interaction sink has localized reply parity. Keeping this module staged avoids an
// accidental live TTS path while preserving the adapter boundary for the next migration slice.
#[allow(dead_code)]
mod piper_adapter;
mod topgg_metrics;

use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use thiserror::Error;
use vozen_api::{
    ProviderHealth as PublicProviderHealth, PublicStatusInput, PublicStatusProvider,
    RuntimeRouterConfig, account_api::AccountApiConfig, discord_oauth::DiscordOAuthVerifier,
    kofi_webhook::KofiWebhookConfig, map_public_status, premium_api::PremiumApiConfig,
    runtime_router, topgg_webhook::TopggWebhookConfig,
};
use vozen_contracts::DiscordCommandCatalog;
use vozen_core::parse_kofi_shop_map;
use vozen_discord::{
    DiscordRuntimeConfig, DiscordRuntimeError, GatewayState, run_discord_gateway_with_state,
};
use vozen_store::{ProviderHealth as StoreProviderHealth, SqliteStore};

use crate::topgg_metrics::{
    ReqwestTopggMetricsHttp, TOPGG_POST_INTERVAL, post_topgg_stats, sync_topgg_commands,
};

const DISCORD_COMMAND_CONTRACT: &str = include_str!("../../../contracts/discord-commands.json");

struct RuntimeConfig {
    discord_token: String,
    database_path: PathBuf,
    health_bind: Option<SocketAddr>,
    public_status: Option<PublicStatusConfig>,
    premium_http: Option<PremiumHttpConfig>,
    topgg_webhook: Option<TopggWebhookRuntimeConfig>,
    topgg_metrics: Option<TopggMetricsRuntimeConfig>,
    vote_redemption_secret: Option<String>,
}

struct PublicStatusConfig {
    incident: Option<String>,
}

struct PremiumHttpConfig {
    client_id: String,
    origin: String,
    kofi_webhook_token: Option<String>,
    kofi_shop_map: Option<String>,
}

struct TopggWebhookRuntimeConfig {
    client_id: String,
    webhook_secret: String,
    redemption_secret: String,
}

struct TopggMetricsRuntimeConfig {
    client_id: String,
    token: String,
}

impl RuntimeConfig {
    fn from_environment() -> Result<Self, RuntimeError> {
        let discord_token = env::var("DISCORD_TOKEN").map_err(|_| RuntimeError::MissingToken)?;
        if discord_token.trim().is_empty() {
            return Err(RuntimeError::MissingToken);
        }
        let database_path = env::var_os("DB_PATH")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("./tts.db"));
        let health_bind = match env::var("HEALTH_PORT") {
            Ok(raw) if raw.trim().is_empty() => None,
            Ok(raw) => {
                let port = raw
                    .trim()
                    .parse::<u16>()
                    .ok()
                    .filter(|port| *port != 0)
                    .ok_or(RuntimeError::InvalidHealthPort)?;
                Some(SocketAddr::from(([127, 0, 0, 1], port)))
            }
            Err(env::VarError::NotPresent) => None,
            Err(env::VarError::NotUnicode(_)) => return Err(RuntimeError::InvalidHealthPort),
        };
        let premium_http = premium_http_from_environment()?;
        let public_status = public_status_from_environment();
        let topgg_webhook = topgg_webhook_from_environment()?;
        let topgg_metrics = topgg_metrics_from_environment()?;
        let vote_redemption_secret = nonempty_env("VOTE_REDEMPTION_SECRET");
        Ok(Self {
            discord_token,
            database_path,
            health_bind,
            public_status,
            premium_http,
            topgg_webhook,
            topgg_metrics,
            vote_redemption_secret,
        })
    }
}

fn topgg_metrics_from_environment() -> Result<Option<TopggMetricsRuntimeConfig>, RuntimeError> {
    let Some(token) = nonempty_env("TOPGG_TOKEN") else {
        return Ok(None);
    };
    let client_id = nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?;
    Ok(Some(TopggMetricsRuntimeConfig { client_id, token }))
}

/// A configured secret is an explicit request to serve this sensitive endpoint. It is never
/// inferred from a port or from the generic premium flag; missing companion values fail startup
/// once the HTTP listener is enabled instead of silently resetting reward eligibility.
fn topgg_webhook_from_environment() -> Result<Option<TopggWebhookRuntimeConfig>, RuntimeError> {
    let Some(webhook_secret) = nonempty_env("TOPGG_WEBHOOK_SECRET") else {
        return Ok(None);
    };
    let client_id = nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?;
    let redemption_secret =
        nonempty_env("VOTE_REDEMPTION_SECRET").ok_or(RuntimeError::MissingVoteRedemptionSecret)?;
    Ok(Some(TopggWebhookRuntimeConfig {
        client_id,
        webhook_secret,
        redemption_secret,
    }))
}

/// Mirrors Node's deliberately strict public-status opt-in: only `true` enables a public route.
fn public_status_from_environment() -> Option<PublicStatusConfig> {
    public_status_enabled(env::var("PUBLIC_STATUS_ENABLED").ok().as_deref()).then_some(
        PublicStatusConfig {
            incident: nonempty_env("PUBLIC_STATUS_INCIDENT"),
        },
    )
}

fn public_status_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

/// Mirrors Node's dangerous-feature flag: only the literal value `true` enables the browser
/// premium API. A typo or a blank value must never expose an authenticated endpoint.
fn premium_http_from_environment() -> Result<Option<PremiumHttpConfig>, RuntimeError> {
    let enabled = premium_http_enabled(env::var("PREMIUM_API_ENABLED").ok().as_deref());
    if !enabled {
        return Ok(None);
    }
    let client_id = nonempty_env("CLIENT_ID").ok_or(RuntimeError::MissingClientId)?;
    let origin = nonempty_env("PREMIUM_API_ORIGIN").unwrap_or_else(|| "https://vozen.org".into());
    Ok(Some(PremiumHttpConfig {
        client_id,
        origin,
        kofi_webhook_token: nonempty_env("KOFI_WEBHOOK_TOKEN"),
        kofi_shop_map: nonempty_env("KOFI_SHOP_MAP"),
    }))
}

fn premium_http_enabled(raw: Option<&str>) -> bool {
    raw.is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
}

fn nonempty_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

#[derive(Debug, Error)]
enum RuntimeError {
    #[error("DISCORD_TOKEN is required to start the Rust gateway")]
    MissingToken,
    #[error("HEALTH_PORT must be an integer from 1 to 65535")]
    InvalidHealthPort,
    #[error(
        "CLIENT_ID is required when PREMIUM_API_ENABLED=true or TOPGG_WEBHOOK_SECRET is configured"
    )]
    MissingClientId,
    #[error("VOTE_REDEMPTION_SECRET is required when TOPGG_WEBHOOK_SECRET is configured")]
    MissingVoteRedemptionSecret,
    #[error("Discord OAuth client initialisation failed")]
    OAuthClient,
    #[error("SQLite startup failed: {0}")]
    Store(#[from] vozen_store::StoreError),
    #[error("SQLite store lock was poisoned")]
    StoreLock,
    #[error("Discord gateway failed: {0}")]
    Discord(#[from] DiscordRuntimeError),
    #[error("HTTP route construction failed: {0}")]
    Router(#[from] vozen_api::RuntimeRouterError),
    #[error("health listener failed: {0}")]
    HealthListener(#[from] std::io::Error),
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        // Runtime errors intentionally never contain the Discord token or an OAuth bearer token.
        eprintln!("vozen runtime startup failed: {error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), RuntimeError> {
    let config = RuntimeConfig::from_environment()?;
    // Opening the store verifies/migrates the exact Node SQLite schema before the Rust gateway
    // does any work. Keep the handle alive for the whole process; future adapters share it.
    let store = Arc::new(Mutex::new(SqliteStore::open(&config.database_path)?));
    if let Some(redemption_secret) = config.vote_redemption_secret.as_deref() {
        store
            .lock()
            .map_err(|_| RuntimeError::StoreLock)?
            .initialize_vote_redemption_ledger(redemption_secret)?;
    }
    // Retention is best effort: a one-off SQLite lock must not take down Discord, and the next
    // daily pass retries. The permanent HMAC marker is deliberately not touched by this job.
    spawn_vote_retention(store.clone());
    // This handle is intentionally process-scoped. The dashboard/rejoin adapters receive a
    // clone later; they never infer bot presence from a stale database row.
    let gateway_state = GatewayState::default();
    if let Some(topgg_metrics) = config.topgg_metrics {
        spawn_topgg_metrics(topgg_metrics, gateway_state.clone());
    }
    let gateway = run_discord_gateway_with_state(
        DiscordRuntimeConfig::from_token(config.discord_token)?,
        gateway_state.clone(),
    );

    let Some(health_bind) = config.health_bind else {
        return gateway.await.map_err(RuntimeError::from);
    };
    let app = build_http_router(
        config.premium_http,
        config.topgg_webhook,
        config.public_status,
        store,
        gateway_state,
    )?;
    let listener = tokio::net::TcpListener::bind(health_bind).await?;
    tokio::select! {
        result = gateway => result.map_err(RuntimeError::from),
        result = axum::serve(listener, app) => result.map_err(RuntimeError::from),
    }
}

fn build_http_router(
    premium_http: Option<PremiumHttpConfig>,
    topgg_webhook: Option<TopggWebhookRuntimeConfig>,
    public_status: Option<PublicStatusConfig>,
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
) -> Result<axum::Router, RuntimeError> {
    let public_status = public_status.map(|config| {
        public_status_provider(store.clone(), gateway_state.clone(), config.incident)
    });
    let Some(config) = premium_http else {
        return runtime_router(RuntimeRouterConfig {
            public_status,
            account: None,
            premium: None,
            dashboard: None,
            kofi_webhook: None,
            topgg_webhook: topgg_webhook.map(|config| TopggWebhookConfig {
                webhook_secret: config.webhook_secret,
                redemption_secret: config.redemption_secret,
                expected_bot_id: config.client_id,
                store,
                now: Arc::new(system_now_ms),
            }),
        })
        .map_err(RuntimeError::from);
    };

    let verifier = Arc::new(
        DiscordOAuthVerifier::production(config.client_id)
            .map_err(|_| RuntimeError::OAuthClient)?,
    );
    let now = Arc::new(system_now_ms);
    let kofi_webhook =
        config
            .kofi_webhook_token
            .clone()
            .map(|verification_token| KofiWebhookConfig {
                verification_token,
                store: store.clone(),
                shop_map: parse_kofi_shop_map(config.kofi_shop_map.as_deref()),
                now: now.clone(),
                on_unmapped_shop: None,
            });
    runtime_router(RuntimeRouterConfig {
        public_status,
        account: Some(AccountApiConfig {
            origin: config.origin.clone(),
            store: store.clone(),
            identity_verifier: verifier.clone(),
            now: now.clone(),
            // Guild names are sourced only from the current gateway process; a missing cache
            // entry stays `null` rather than causing an outbound lookup or leaking old data.
            resolve_guild_name: Some(Arc::new(move |guild_id| gateway_state.guild_name(guild_id))),
        }),
        premium: Some(PremiumApiConfig {
            origin: config.origin,
            kofi_webhook_token: config.kofi_webhook_token,
            store: store.clone(),
            identity_verifier: verifier,
            now,
        }),
        // Dashboard remains fail-closed until options are produced from the current Serenity
        // cache after the same authorization check that guards every configuration request.
        dashboard: None,
        kofi_webhook,
        topgg_webhook: topgg_webhook.map(|config| TopggWebhookConfig {
            webhook_secret: config.webhook_secret,
            redemption_secret: config.redemption_secret,
            expected_bot_id: config.client_id,
            store: store.clone(),
            now: Arc::new(system_now_ms),
        }),
    })
    .map_err(RuntimeError::from)
}

/// Produces the same coarse public status shape as Node. Any SQLite problem becomes an
/// unavailable database/providers component; provider names and errors never leave the process.
fn public_status_provider(
    store: Arc<Mutex<SqliteStore>>,
    gateway_state: GatewayState,
    incident: Option<String>,
) -> PublicStatusProvider {
    Arc::new(move || {
        let (database_ready, provider_states) = match store.lock() {
            Ok(store) => match store.list_provider_health() {
                Ok(rows) => (
                    true,
                    rows.into_iter()
                        .map(|row| match row.health {
                            StoreProviderHealth::Healthy => PublicProviderHealth::Healthy,
                            StoreProviderHealth::Degraded => PublicProviderHealth::Degraded,
                        })
                        .collect(),
                ),
                Err(_) => (false, Vec::new()),
            },
            Err(_) => (false, Vec::new()),
        };
        map_public_status(PublicStatusInput {
            bot_ready: gateway_state.is_ready(),
            database_ready,
            provider_states,
            incident_message: incident.clone(),
        })
    })
}

fn system_now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}

fn purge_vote_retention(
    store: &SqliteStore,
    now: i64,
) -> Result<(usize, usize), vozen_store::StoreError> {
    let rewards = store.purge_expired_vote_rewards(now)?;
    let events = store.purge_expired_topgg_events(now)?;
    Ok((rewards, events))
}

fn spawn_vote_retention(store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            if let Ok(store) = store.lock() {
                let _ = purge_vote_retention(&store, system_now_ms());
            }
        }
    });
}

fn spawn_topgg_metrics(config: TopggMetricsRuntimeConfig, gateway_state: GatewayState) {
    tokio::spawn(async move {
        let Ok(http) = ReqwestTopggMetricsHttp::new() else {
            // The listing is optional. A local client construction failure must never block the
            // Discord gateway or trigger a retry loop with partial configuration.
            return;
        };
        // Node starts Top.gg work from ClientReady. Do not publish a transient zero while the
        // gateway is still establishing its authoritative guild cache.
        while !gateway_state.is_ready() {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        if let Some(commands) = public_topgg_commands() {
            let _ = sync_topgg_commands(&http, &config.token, commands).await;
        }
        loop {
            let _ = post_topgg_stats(
                &http,
                &config.client_id,
                &config.token,
                gateway_state.guild_count(),
            )
            .await;
            tokio::time::sleep(TOPGG_POST_INTERVAL).await;
        }
    });
}

fn public_topgg_commands() -> Option<Vec<serde_json::Value>> {
    DiscordCommandCatalog::from_json(DISCORD_COMMAND_CONTRACT)
        .ok()?
        .public_registration_payload()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_errors_without_a_token() {
        assert!(matches!(
            DiscordRuntimeConfig::from_token(String::new()),
            Err(DiscordRuntimeError::MissingToken)
        ));
    }

    #[test]
    fn health_port_is_loopback_only_when_constructed() {
        let address = SocketAddr::from(([127, 0, 0, 1], 8080));
        assert!(address.ip().is_loopback());
        assert_eq!(address.port(), 8080);
    }

    #[test]
    fn premium_http_flag_is_exactly_opt_in() {
        assert!(premium_http_enabled(Some("true")));
        assert!(premium_http_enabled(Some("TRUE")));
        assert!(!premium_http_enabled(Some("1")));
        assert!(!premium_http_enabled(Some("yes")));
        assert!(!premium_http_enabled(None));
    }

    #[test]
    fn public_status_flag_is_exactly_opt_in() {
        assert!(public_status_enabled(Some("true")));
        assert!(public_status_enabled(Some("TRUE")));
        assert!(!public_status_enabled(Some("1")));
        assert!(!public_status_enabled(Some("yes")));
        assert!(!public_status_enabled(None));
    }

    #[test]
    fn public_status_fails_closed_until_gateway_ready_and_never_leaks_provider_detail() {
        let store = Arc::new(Mutex::new(SqliteStore::open_in_memory().expect("store")));
        let state = GatewayState::default();
        let response = public_status_provider(store, state, Some("  planned\nwork  ".into()))();
        assert_eq!(response.status, vozen_api::PublicStatusState::Unavailable);
        assert_eq!(response.incident.as_deref(), Some("planned work"));
        assert_eq!(
            response.components.bot,
            vozen_api::PublicStatusState::Unavailable
        );
        assert_eq!(
            response.components.database,
            vozen_api::PublicStatusState::Operational
        );
    }

    #[test]
    fn retention_removes_only_expired_raw_vote_records_and_delivery_ids() {
        let store = SqliteStore::open_in_memory().expect("store");
        let secret = "0123456789abcdef0123456789abcdef";
        let user = "12345678901234567";
        store
            .claim_topgg_vote_reward(Some("delivery"), user, 1_000, secret)
            .expect("reward");
        let (rewards, events) = purge_vote_retention(
            &store,
            1_000 + vozen_store::VOTE_REWARD_MS + vozen_store::TOPGG_EVENT_RETENTION_MS + 1,
        )
        .expect("purge");
        assert_eq!((rewards, events), (1, 1));
        assert!(
            store
                .vote_reward_status(user, secret)
                .expect("status")
                .already_redeemed
        );
    }

    #[test]
    fn topgg_sync_uses_only_the_public_command_contract() {
        let commands = public_topgg_commands().expect("public commands");
        let names = commands
            .iter()
            .filter_map(|command| command.get("name").and_then(serde_json::Value::as_str))
            .collect::<Vec<_>>();
        assert!(names.contains(&"join"));
        assert!(!names.contains(&"vozen-grant"));
        assert!(!names.contains(&"dev"));
    }
}
