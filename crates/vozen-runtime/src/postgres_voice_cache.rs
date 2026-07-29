//! Staging-only Postgres-backed read cache for the automatic voice path.
//!
//! The Discord handler reads a local in-memory SQLite snapshot. A background task refreshes that
//! snapshot from the private Postgres schema; it never performs network I/O from a message task.

use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use sqlx::PgPool;
use thiserror::Error;
use vozen_store::SqliteStore;

const REFRESH_INTERVAL: Duration = Duration::from_secs(15);
const IMPORT_MARKER: &str = "sqlite_initial_import_v1";
const VOICE_CACHE_TABLES: &[&str] = &[
    "blocklist",
    "channel_profile",
    "discord_premium_entitlement",
    "guild_config",
    "premium_guild",
    "premium_pass",
    "premium_pass_activation",
    "premium_user",
    "pronunciation",
    "pronunciation_user",
    "tts_lang_detect_on",
    "tts_optout",
    "user_effect",
    "user_voice",
];

#[derive(Debug, Error)]
pub enum PostgresVoiceCacheError {
    #[error("Postgres initial import marker is missing")]
    MissingInitialImport,
    #[error("Postgres voice-cache query failed")]
    Postgres(#[source] sqlx::Error),
    #[error("Postgres voice-cache payload is invalid")]
    Payload(#[source] serde_json::Error),
    #[error("in-memory voice-cache store failed: {0}")]
    Store(#[from] vozen_store::StoreError),
    #[error("in-memory voice-cache lock was poisoned")]
    Lock,
}

/// Builds a fully populated, local-only cache. It fails closed unless the explicit staging import
/// marker exists, avoiding a silent switch to an empty remote snapshot.
pub async fn load(pool: &PgPool) -> Result<Arc<Mutex<SqliteStore>>, PostgresVoiceCacheError> {
    let imported: bool = sqlx::query_scalar(
        "SELECT EXISTS(
           SELECT 1 FROM vozen.runtime_migration_state
           WHERE marker = $1
         )",
    )
    .bind(IMPORT_MARKER)
    .fetch_one(pool)
    .await
    .map_err(PostgresVoiceCacheError::Postgres)?;
    if !imported {
        return Err(PostgresVoiceCacheError::MissingInitialImport);
    }
    let store = Arc::new(Mutex::new(SqliteStore::open_in_memory()?));
    refresh_once(pool, &store).await?;
    Ok(store)
}

/// Runs one consistent remote read, then replaces local tables while holding no network resource.
pub async fn refresh_once(
    pool: &PgPool,
    store: &Arc<Mutex<SqliteStore>>,
) -> Result<(), PostgresVoiceCacheError> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(PostgresVoiceCacheError::Postgres)?;
    let mut snapshots = Vec::with_capacity(VOICE_CACHE_TABLES.len());
    for table in VOICE_CACHE_TABLES {
        let query = format!(
            "SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::jsonb)::text
             FROM vozen.\"{table}\" AS row"
        );
        let payload: String = sqlx::query_scalar(&query)
            .fetch_one(&mut *transaction)
            .await
            .map_err(PostgresVoiceCacheError::Postgres)?;
        let rows = serde_json::from_str::<Vec<serde_json::Value>>(&payload)
            .map_err(PostgresVoiceCacheError::Payload)?;
        snapshots.push(((*table).to_owned(), rows));
    }
    transaction
        .commit()
        .await
        .map_err(PostgresVoiceCacheError::Postgres)?;

    let store = store.lock().map_err(|_| PostgresVoiceCacheError::Lock)?;
    for (table, rows) in snapshots {
        store.replace_contract_table_rows(&table, &rows)?;
    }
    Ok(())
}

pub fn spawn(pool: PgPool, store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(REFRESH_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(error) = refresh_once(&pool, &store).await {
                // Keep the last known-good local cache; a remote failure must never stall voice.
                eprintln!("[postgres] voice-cache refresh deferred: {error}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn staging_voice_cache_loads_only_after_explicit_import_when_requested() {
        let Ok(database_url) = std::env::var("VOZEN_POSTGRES_INTEGRATION_URL") else {
            return;
        };
        let pool = PgPool::connect(&database_url).await.expect("staging pool");
        let guild_id = format!("staging-cache-guild-{}", uuid::Uuid::new_v4());
        sqlx::query(
            "INSERT INTO vozen.guild_config (guild_id, locale, rate_per_min)
             VALUES ($1, 'pt', 11)",
        )
        .bind(&guild_id)
        .execute(&pool)
        .await
        .expect("stage cache fixture");
        sqlx::query(
            "INSERT INTO vozen.runtime_migration_state (marker, completed_at)
             VALUES ('sqlite_initial_import_v1', 1)
             ON CONFLICT (marker) DO UPDATE SET completed_at = EXCLUDED.completed_at",
        )
        .execute(&pool)
        .await
        .expect("stage marker");
        let verification = async {
            let cache = load(&pool).await.map_err(|error| error.to_string())?;
            {
                let cache = cache.lock().map_err(|_| "cache lock".to_owned())?;
                let config = cache
                    .guild_config(&guild_id)
                    .map_err(|error| error.to_string())?;
                if config.locale != "pt" || config.rate_per_min != 11 {
                    return Err("initial Postgres voice-cache value did not match".to_owned());
                }
                if !cache
                    .has_schema_object("premium_user")
                    .map_err(|error| error.to_string())?
                {
                    return Err("voice-cache schema missing premium_user".to_owned());
                }
            }
            sqlx::query("UPDATE vozen.guild_config SET rate_per_min = 12 WHERE guild_id = $1")
                .bind(&guild_id)
                .execute(&pool)
                .await
                .map_err(|error| error.to_string())?;
            refresh_once(&pool, &cache)
                .await
                .map_err(|error| error.to_string())?;
            let cache = cache.lock().map_err(|_| "cache lock".to_owned())?;
            if cache
                .guild_config(&guild_id)
                .map_err(|error| error.to_string())?
                .rate_per_min
                != 12
            {
                return Err("refreshed Postgres voice-cache value did not match".to_owned());
            }
            Ok::<(), String>(())
        }
        .await;
        sqlx::query("DELETE FROM vozen.guild_config WHERE guild_id = $1")
            .bind(&guild_id)
            .execute(&pool)
            .await
            .expect("remove cache fixture");
        sqlx::query(
            "DELETE FROM vozen.runtime_migration_state WHERE marker = 'sqlite_initial_import_v1'",
        )
        .execute(&pool)
        .await
        .expect("remove fixture marker");
        verification.expect("verify Postgres voice-cache refresh");
    }
}
