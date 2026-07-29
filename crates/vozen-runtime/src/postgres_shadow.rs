//! Safe, staging-only Supabase/Postgres connectivity boundary.
//!
//! This module intentionally does not move any Discord request onto Postgres. Its pool is a
//! preflight gate for the private `vozen` schema, while SQLite remains the durable compatibility
//! store and local fallback. That separation lets us validate network, TLS and credentials in a
//! disposable environment before introducing asynchronous store adapters.

use std::{env, time::Duration};

use sqlx::{PgPool, Row, postgres::PgPoolOptions};
use thiserror::Error;

use crate::runtime_mode::RuntimeMode;

const DEFAULT_POOL_MAX: u32 = 5;
const MAX_POOL_MAX: u32 = 20;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostgresShadowConfig {
    database_url: String,
    max_connections: u32,
}

#[derive(Debug, Error)]
pub enum PostgresShadowError {
    #[error("RUST_POSTGRES_MODE must be `off` or `shadow`")]
    InvalidMode,
    #[error("RUST_POSTGRES_MODE=shadow is staging-only and cannot run with RUST_RUNTIME_MODE=full")]
    FullRuntimeForbidden,
    #[error("RUST_POSTGRES_MODE=shadow requires SUPABASE_DATABASE_URL")]
    MissingDatabaseUrl,
    #[error("SUPABASE_DATABASE_URL must use the postgres:// or postgresql:// scheme")]
    InvalidDatabaseUrl,
    #[error("RUST_POSTGRES_POOL_MAX must be an integer from 1 to {MAX_POOL_MAX}")]
    InvalidPoolSize,
    #[error("Postgres staging connection failed")]
    Connect(#[source] sqlx::Error),
    #[error("Postgres staging schema preflight failed")]
    Preflight(#[source] sqlx::Error),
    #[error("Postgres staging schema is missing the private vozen.guild_config table")]
    MissingSchema,
}

impl PostgresShadowConfig {
    pub fn from_environment(
        runtime_mode: RuntimeMode,
    ) -> Result<Option<Self>, PostgresShadowError> {
        Self::parse(
            env::var("RUST_POSTGRES_MODE").ok().as_deref(),
            env::var("SUPABASE_DATABASE_URL").ok().as_deref(),
            env::var("RUST_POSTGRES_POOL_MAX").ok().as_deref(),
            runtime_mode,
        )
    }

    fn parse(
        mode: Option<&str>,
        database_url: Option<&str>,
        max_connections: Option<&str>,
        runtime_mode: RuntimeMode,
    ) -> Result<Option<Self>, PostgresShadowError> {
        match mode.map(str::trim).filter(|value| !value.is_empty()) {
            None | Some("off") => Ok(None),
            Some(value) if value.eq_ignore_ascii_case("shadow") => {
                if runtime_mode.is_full() {
                    return Err(PostgresShadowError::FullRuntimeForbidden);
                }
                let database_url = database_url
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or(PostgresShadowError::MissingDatabaseUrl)?;
                if !(database_url.starts_with("postgres://")
                    || database_url.starts_with("postgresql://"))
                {
                    return Err(PostgresShadowError::InvalidDatabaseUrl);
                }
                let max_connections = match max_connections
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    None => DEFAULT_POOL_MAX,
                    Some(raw) => raw
                        .parse::<u32>()
                        .ok()
                        .filter(|value| (1..=MAX_POOL_MAX).contains(value))
                        .ok_or(PostgresShadowError::InvalidPoolSize)?,
                };
                Ok(Some(Self {
                    database_url: database_url.to_owned(),
                    max_connections,
                }))
            }
            Some(_) => Err(PostgresShadowError::InvalidMode),
        }
    }
}

/// Keeps the pool alive for the whole staging process. It deliberately exposes no application
/// queries yet: introducing one requires an explicit asynchronous adapter and cache contract.
pub struct PostgresShadowRuntime {
    _pool: PgPool,
}

impl PostgresShadowRuntime {
    pub async fn connect(config: &PostgresShadowConfig) -> Result<Self, PostgresShadowError> {
        let pool = PgPoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(0)
            .acquire_timeout(CONNECT_TIMEOUT)
            .connect(&config.database_url)
            .await
            .map_err(PostgresShadowError::Connect)?;

        let row = sqlx::query(
            "SELECT to_regclass('vozen.guild_config') IS NOT NULL AS schema_ready, \
             has_schema_privilege(current_user, 'vozen', 'USAGE') AS schema_usable",
        )
        .fetch_one(&pool)
        .await
        .map_err(PostgresShadowError::Preflight)?;
        let schema_ready: bool = row
            .try_get("schema_ready")
            .map_err(PostgresShadowError::Preflight)?;
        let schema_usable: bool = row
            .try_get("schema_usable")
            .map_err(PostgresShadowError::Preflight)?;
        if !schema_ready || !schema_usable {
            return Err(PostgresShadowError::MissingSchema);
        }
        Ok(Self { _pool: pool })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_postgres_needs_no_secret() {
        assert!(matches!(
            PostgresShadowConfig::parse(Some("off"), None, None, RuntimeMode::Shadow),
            Ok(None)
        ));
    }

    #[test]
    fn shadow_requires_a_postgres_url_and_validates_pool_size() {
        assert!(matches!(
            PostgresShadowConfig::parse(Some("shadow"), None, None, RuntimeMode::Shadow),
            Err(PostgresShadowError::MissingDatabaseUrl)
        ));
        assert!(matches!(
            PostgresShadowConfig::parse(
                Some("shadow"),
                Some("https://example.com"),
                None,
                RuntimeMode::Shadow
            ),
            Err(PostgresShadowError::InvalidDatabaseUrl)
        ));
        assert!(matches!(
            PostgresShadowConfig::parse(
                Some("shadow"),
                Some("postgresql://user:password@host/database"),
                Some("21"),
                RuntimeMode::Shadow
            ),
            Err(PostgresShadowError::InvalidPoolSize)
        ));
    }

    #[test]
    fn shadow_cannot_be_promoted_to_production_mode() {
        assert!(matches!(
            PostgresShadowConfig::parse(
                Some("shadow"),
                Some("postgresql://user:password@host/database"),
                None,
                RuntimeMode::Full
            ),
            Err(PostgresShadowError::FullRuntimeForbidden)
        ));
    }

    /// This is deliberately opt-in so normal unit tests never need a network connection or a
    /// secret. Operators can pass the URL through a short-lived process environment variable.
    #[tokio::test]
    async fn staging_connection_preflight_when_explicitly_requested() {
        let Ok(database_url) = env::var("VOZEN_POSTGRES_INTEGRATION_URL") else {
            return;
        };
        let config = PostgresShadowConfig::parse(
            Some("shadow"),
            Some(&database_url),
            Some("5"),
            RuntimeMode::Shadow,
        )
        .expect("explicit staging URL must be valid")
        .expect("shadow mode must create a Postgres config");
        PostgresShadowRuntime::connect(&config)
            .await
            .expect("staging schema and pool must be reachable");
    }
}
