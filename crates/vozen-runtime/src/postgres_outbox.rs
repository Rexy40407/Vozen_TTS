//! Background-only delivery of durable SQLite outbox batches to Supabase.
//!
//! No Discord handler waits for this worker. A failed remote write leaves the local batch intact;
//! a successful idempotent insert is acknowledged by removing only that local batch.

use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use sqlx::PgPool;
use vozen_store::SqliteStore;

const FLUSH_INTERVAL: Duration = Duration::from_secs(5);
const MAX_BATCHES_PER_FLUSH: usize = 100;

pub fn spawn(pool: PgPool, store: Arc<Mutex<SqliteStore>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(FLUSH_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(error) = flush_once(&pool, store.clone()).await {
                // Do not include payloads or connection details: both may be sensitive. The
                // batch remains in SQLite and the next interval retries it.
                eprintln!("[postgres] outbox delivery deferred: {error}");
            }
        }
    });
}

async fn flush_once(pool: &PgPool, store: Arc<Mutex<SqliteStore>>) -> Result<(), String> {
    let reader = store.clone();
    let batches = tokio::task::spawn_blocking(move || {
        reader
            .lock()
            .map_err(|_| "SQLite outbox lock was poisoned".to_owned())?
            .list_runtime_outbox(MAX_BATCHES_PER_FLUSH)
            .map_err(|_| "SQLite outbox read failed".to_owned())
    })
    .await
    .map_err(|_| "SQLite outbox worker stopped".to_owned())??;

    for batch in batches {
        sqlx::query(
            "INSERT INTO vozen.runtime_outbox_batch (batch_id, created_at, payload)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (batch_id) DO NOTHING",
        )
        .bind(&batch.batch_id)
        .bind(batch.created_at)
        .bind(&batch.payload)
        .execute(pool)
        .await
        .map_err(|_| "Supabase outbox write failed".to_owned())?;

        let acknowledgement = store.clone();
        let batch_id = batch.batch_id;
        tokio::task::spawn_blocking(move || {
            acknowledgement
                .lock()
                .map_err(|_| "SQLite outbox lock was poisoned".to_owned())?
                .delete_runtime_outbox(&batch_id)
                .map_err(|_| "SQLite outbox acknowledgement failed".to_owned())
        })
        .await
        .map_err(|_| "SQLite outbox worker stopped".to_owned())??;
    }
    Ok(())
}
