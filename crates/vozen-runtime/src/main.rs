#![forbid(unsafe_code)]

//! Opt-in Rust process entry point used during the Node-to-Rust shadow migration.
//!
//! It deliberately starts only the safe shared foundations (SQLite migration, Discord gateway,
//! optional loopback HTTP route). The account, receipt-claim and Ko-fi webhook adapters are
//! opt-in. Dashboard routes remain absent until their live Discord option provider has been
//! migrated and shadow-tested.

use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use thiserror::Error;
use vozen_api::{
    ProviderHealth as PublicProviderHealth, PublicStatusInput, PublicStatusProvider,
    RuntimeRouterConfig, account_api::AccountApiConfig, discord_oauth::DiscordOAuthVerifier,
    kofi_webhook::KofiWebhookConfig, map_public_status, premium_api::PremiumApiConfig,
    runtime_router,
};
use vozen_core::parse_kofi_shop_map;
use vozen_discord::{
    DiscordRuntimeConfig, DiscordRuntimeError, GatewayState, run_discord_gateway_with_state,
};
use vozen_store::{ProviderHealth as StoreProviderHealth, SqliteStore};

struct RuntimeConfig {
    discord_token: String,
    database_path: PathBuf,
    health_bind: Option<SocketAddr>,
    public_status: Option<PublicStatusConfig>,
    premium_http: Option<PremiumHttpConfig>,
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
        Ok(Self {
            discord_token,
            database_path,
            health_bind,
            public_status,
            premium_http,
        })
    }
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
    #[error("CLIENT_ID is required when PREMIUM_API_ENABLED=true")]
    MissingClientId,
    #[error("Discord OAuth client initialisation failed")]
    OAuthClient,
    #[error("SQLite startup failed: {0}")]
    Store(#[from] vozen_store::StoreError),
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
    // This handle is intentionally process-scoped. The dashboard/rejoin adapters receive a
    // clone later; they never infer bot presence from a stale database row.
    let gateway_state = GatewayState::default();
    let gateway = run_discord_gateway_with_state(
        DiscordRuntimeConfig::from_token(config.discord_token)?,
        gateway_state.clone(),
    );

    let Some(health_bind) = config.health_bind else {
        return gateway.await.map_err(RuntimeError::from);
    };
    let app = build_http_router(
        config.premium_http,
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
            store,
            identity_verifier: verifier,
            now,
        }),
        // Dashboard remains fail-closed until options are produced from the current Serenity
        // cache after the same authorization check that guards every configuration request.
        dashboard: None,
        kofi_webhook,
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
}
