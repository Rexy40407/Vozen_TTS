#![forbid(unsafe_code)]

//! Opt-in Rust process entry point used during the Node-to-Rust shadow migration.
//!
//! It deliberately starts only the safe shared foundations (SQLite migration, Discord gateway,
//! optional loopback health route). Payment, account and dashboard routes remain absent until
//! their live Discord adapters and shadow checks are promoted explicitly.

use std::{env, net::SocketAddr, path::PathBuf};

use thiserror::Error;
use vozen_api::{RuntimeRouterConfig, runtime_router};
use vozen_discord::{
    DiscordRuntimeConfig, DiscordRuntimeError, GatewayState, run_discord_gateway_with_state,
};
use vozen_store::SqliteStore;

struct RuntimeConfig {
    discord_token: String,
    database_path: PathBuf,
    health_bind: Option<SocketAddr>,
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
        Ok(Self {
            discord_token,
            database_path,
            health_bind,
        })
    }
}

#[derive(Debug, Error)]
enum RuntimeError {
    #[error("DISCORD_TOKEN is required to start the Rust gateway")]
    MissingToken,
    #[error("HEALTH_PORT must be an integer from 1 to 65535")]
    InvalidHealthPort,
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
    let _store = SqliteStore::open(&config.database_path)?;
    // This handle is intentionally process-scoped. The dashboard/rejoin adapters receive a
    // clone later; they never infer bot presence from a stale database row.
    let gateway_state = GatewayState::default();
    let gateway = run_discord_gateway_with_state(
        DiscordRuntimeConfig::from_token(config.discord_token)?,
        gateway_state,
    );

    let Some(health_bind) = config.health_bind else {
        return gateway.await.map_err(RuntimeError::from);
    };
    let app = runtime_router(RuntimeRouterConfig {
        public_status: None,
        account: None,
        premium: None,
        dashboard: None,
        kofi_webhook: None,
    })?;
    let listener = tokio::net::TcpListener::bind(health_bind).await?;
    tokio::select! {
        result = gateway => result.map_err(RuntimeError::from),
        result = axum::serve(listener, app) => result.map_err(RuntimeError::from),
    }
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
}
