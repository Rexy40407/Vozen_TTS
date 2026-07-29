//! Durable local fallback for asynchronous Postgres batches.
//!
//! The table is intentionally Rust-owned and additive: old Node/SQLite deployments neither
//! read nor write it, while a Rust staging runtime can preserve batches if Supabase is down.

use rusqlite::{Connection, params};

use crate::{SqliteStore, StoreError};

const MAX_BATCH_ID_LEN: usize = 128;
const MAX_PAYLOAD_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeOutboxEnqueue<'a> {
    pub batch_id: &'a str,
    pub created_at: i64,
    /// Serialized JSON payload. Keeping it opaque prevents the fallback from becoming a second
    /// query model; the Postgres worker owns interpretation and idempotency.
    pub payload: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeOutboxBatch {
    pub batch_id: String,
    pub created_at: i64,
    pub payload: String,
}

pub(crate) fn install_runtime_outbox_schema(connection: &Connection) -> Result<(), StoreError> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS runtime_outbox_batch (
           batch_id TEXT PRIMARY KEY,
           created_at INTEGER NOT NULL,
           payload TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_runtime_outbox_created_at
           ON runtime_outbox_batch (created_at, batch_id);",
    )?;
    Ok(())
}

impl SqliteStore {
    /// Enqueues a batch once. Repeating the same id is safe and preserves the first payload.
    pub fn enqueue_runtime_outbox(
        &self,
        batch: RuntimeOutboxEnqueue<'_>,
    ) -> Result<(), StoreError> {
        validate_batch(&batch)?;
        self.connection().execute(
            "INSERT OR IGNORE INTO runtime_outbox_batch (batch_id, created_at, payload)
             VALUES (?1, ?2, ?3)",
            params![batch.batch_id, batch.created_at, batch.payload],
        )?;
        Ok(())
    }

    /// Reads the oldest pending batches. The worker removes a batch only after Postgres records
    /// its id, which makes retries safe across a process crash.
    pub fn list_runtime_outbox(&self, limit: usize) -> Result<Vec<RuntimeOutboxBatch>, StoreError> {
        let limit = i64::try_from(limit.clamp(1, 1_000)).unwrap_or(1_000);
        let mut statement = self.connection().prepare(
            "SELECT batch_id, created_at, payload FROM runtime_outbox_batch
             ORDER BY created_at ASC, batch_id ASC LIMIT ?1",
        )?;
        statement
            .query_map([limit], |row| {
                Ok(RuntimeOutboxBatch {
                    batch_id: row.get(0)?,
                    created_at: row.get(1)?,
                    payload: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(StoreError::from)
    }

    pub fn delete_runtime_outbox(&self, batch_id: &str) -> Result<bool, StoreError> {
        validate_batch_id(batch_id)?;
        Ok(self.connection().execute(
            "DELETE FROM runtime_outbox_batch WHERE batch_id = ?1",
            [batch_id],
        )? != 0)
    }
}

fn validate_batch(batch: &RuntimeOutboxEnqueue<'_>) -> Result<(), StoreError> {
    validate_batch_id(batch.batch_id)?;
    if batch.payload.trim().is_empty() || batch.payload.len() > MAX_PAYLOAD_BYTES {
        return Err(StoreError::InvalidRuntimeOutboxPayload);
    }
    if serde_json::from_str::<serde_json::Value>(batch.payload).is_err() {
        return Err(StoreError::InvalidRuntimeOutboxPayload);
    }
    Ok(())
}

fn validate_batch_id(batch_id: &str) -> Result<(), StoreError> {
    if batch_id.trim().is_empty() || batch_id.len() > MAX_BATCH_ID_LEN {
        return Err(StoreError::InvalidRuntimeOutboxBatchId);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batches_are_idempotent_ordered_and_removed_after_acknowledgement() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .enqueue_runtime_outbox(RuntimeOutboxEnqueue {
                batch_id: "later",
                created_at: 20,
                payload: r#"{"kind":"telemetry"}"#,
            })
            .expect("later batch");
        store
            .enqueue_runtime_outbox(RuntimeOutboxEnqueue {
                batch_id: "first",
                created_at: 10,
                payload: r#"{"kind":"talk-stats"}"#,
            })
            .expect("first batch");
        store
            .enqueue_runtime_outbox(RuntimeOutboxEnqueue {
                batch_id: "first",
                created_at: 1,
                payload: r#"{"kind":"must-not-replace"}"#,
            })
            .expect("duplicate batch");

        let batches = store.list_runtime_outbox(10).expect("list batches");
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].batch_id, "first");
        assert_eq!(batches[0].created_at, 10);
        assert!(batches[0].payload.contains("talk-stats"));
        assert!(store.delete_runtime_outbox("first").expect("delete"));
        assert!(
            !store
                .delete_runtime_outbox("first")
                .expect("idempotent delete")
        );
        assert_eq!(
            store.list_runtime_outbox(1).expect("remaining")[0].batch_id,
            "later"
        );
    }

    #[test]
    fn invalid_batches_are_rejected_before_persistence() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(matches!(
            store.enqueue_runtime_outbox(RuntimeOutboxEnqueue {
                batch_id: "",
                created_at: 0,
                payload: "{}",
            }),
            Err(StoreError::InvalidRuntimeOutboxBatchId)
        ));
        assert!(matches!(
            store.enqueue_runtime_outbox(RuntimeOutboxEnqueue {
                batch_id: "valid",
                created_at: 0,
                payload: " ",
            }),
            Err(StoreError::InvalidRuntimeOutboxPayload)
        ));
        assert!(matches!(
            store.enqueue_runtime_outbox(RuntimeOutboxEnqueue {
                batch_id: "valid-json",
                created_at: 0,
                payload: "not json",
            }),
            Err(StoreError::InvalidRuntimeOutboxPayload)
        ));
    }
}
