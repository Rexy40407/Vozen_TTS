//! Background-only Supabase usage telemetry for the owner console.
//!
//! The query runs on a timer and its cached result is read synchronously by the admin metrics
//! endpoint. No Discord or speech request waits for PostgreSQL.

use std::{
    env,
    sync::{Arc, RwLock},
    time::Duration,
};

use sqlx::{PgPool, Row};
use vozen_api::admin_api::AdminSupabaseMetrics;

const DEFAULT_DATABASE_CAPACITY_BYTES: u64 = 500 * 1024 * 1024;
const REFRESH_INTERVAL: Duration = Duration::from_secs(30);

pub type SharedSupabaseMetrics = Arc<RwLock<Option<AdminSupabaseMetrics>>>;

#[must_use]
pub fn new_cache() -> SharedSupabaseMetrics {
    Arc::new(RwLock::new(None))
}

#[must_use]
pub fn database_capacity_from_environment() -> u64 {
    env::var("SUPABASE_DATABASE_CAPACITY_BYTES")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_DATABASE_CAPACITY_BYTES)
}

pub fn spawn(pool: PgPool, cache: SharedSupabaseMetrics, capacity_bytes: u64) {
    tokio::spawn(async move {
        loop {
            let reading = read_database_size(&pool, capacity_bytes).await;
            if let Ok(mut current) = cache.write() {
                *current = reading;
            }
            tokio::time::sleep(REFRESH_INTERVAL).await;
        }
    });
}

async fn read_database_size(pool: &PgPool, capacity_bytes: u64) -> Option<AdminSupabaseMetrics> {
    let row = sqlx::query("SELECT pg_database_size(current_database()) AS database_bytes")
        .fetch_one(pool)
        .await
        .ok()?;
    let database_bytes = u64::try_from(row.try_get::<i64, _>("database_bytes").ok()?).ok()?;
    Some(AdminSupabaseMetrics {
        database_bytes,
        capacity_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_a_free_plan_sized_default_quota() {
        assert_eq!(DEFAULT_DATABASE_CAPACITY_BYTES, 500 * 1024 * 1024);
    }
}
