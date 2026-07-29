//! Durable local fallback for asynchronous Postgres batches.
//!
//! The table is intentionally Rust-owned and additive: old Node/SQLite deployments neither
//! read nor write it, while a Rust staging runtime can preserve batches if Supabase is down.

use rusqlite::{Connection, params};

use crate::{SqliteStore, StoreError};

const MAX_BATCH_ID_LEN: usize = 128;
const MAX_PAYLOAD_BYTES: usize = 256 * 1024;
// These values feed the in-memory voice cache and are changed comparatively rarely. Hot counters
// deliberately stay out of trigger capture: they are aggregated by `RuntimeBatchBuffer` and sent
// in five-second batches instead of adding one durable outbox row per spoken message.
const POSTGRES_REPLICA_TABLES: &[&str] = &[
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

/// Enables durable change capture only for an explicitly configured Postgres mirror.
///
/// The Node-compatible store stays synchronous and local. These triggers simply append a compact
/// row image to the Rust-owned outbox in the same SQLite transaction, so a later background
/// worker can mirror it without ever making a Discord handler wait for the network.
pub(crate) fn install_replica_triggers(
    connection: &Connection,
    tables: &[String],
) -> Result<(), StoreError> {
    for table in tables {
        if !POSTGRES_REPLICA_TABLES.contains(&table.as_str()) {
            for suffix in ["ai", "au", "ad"] {
                connection.execute_batch(&format!(
                    "DROP TRIGGER IF EXISTS {}",
                    quote_identifier(&format!("runtime_replica_{table}_{suffix}")),
                ))?;
            }
            continue;
        }
        let mut statement =
            connection.prepare(&format!("PRAGMA table_info({})", quote_identifier(table)))?;
        let columns = statement
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        if columns.is_empty() {
            return Err(StoreError::InvalidSchemaObject(table.clone()));
        }
        let trigger_prefix = format!("runtime_replica_{table}");
        for (suffix, timing, row_ref, operation) in [
            ("ai", "AFTER INSERT", "NEW", "upsert"),
            ("au", "AFTER UPDATE", "NEW", "upsert"),
            ("ad", "AFTER DELETE", "OLD", "delete"),
        ] {
            let payload = replica_payload(table, &columns, row_ref, operation);
            connection.execute_batch(&format!(
                "CREATE TRIGGER IF NOT EXISTS {trigger}
                   {timing} ON {table_name}
                   BEGIN
                     INSERT INTO runtime_outbox_batch (batch_id, created_at, payload)
                     VALUES ('replica-' || lower(hex(randomblob(16))),
                             CAST(strftime('%s', 'now') AS INTEGER) * 1000,
                             {payload});
                   END",
                trigger = quote_identifier(&format!("{trigger_prefix}_{suffix}")),
                table_name = quote_identifier(table),
            ))?;
        }
    }
    Ok(())
}

fn replica_payload(table: &str, columns: &[String], row_ref: &str, operation: &str) -> String {
    let pairs = columns
        .iter()
        .flat_map(|column| {
            [
                quote_sql_literal(column),
                format!("{row_ref}.{}", quote_identifier(column)),
            ]
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "json_object('version', 1, 'replica', json_object('table', {}, 'operation', {}, 'row', json_object({pairs})))",
        quote_sql_literal(table),
        quote_sql_literal(operation),
    )
}

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn quote_sql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
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

    /// Reads pending batches in durable insertion order within the same timestamp. The SQLite
    /// `rowid` tie-breaker is essential for replica events: a fast upsert followed by delete
    /// must never be reordered merely because both changes happened in the same second.
    /// The worker removes a batch only after Postgres records its id, which makes retries safe
    /// across a process crash.
    pub fn list_runtime_outbox(&self, limit: usize) -> Result<Vec<RuntimeOutboxBatch>, StoreError> {
        let limit = i64::try_from(limit.clamp(1, 1_000)).unwrap_or(1_000);
        let mut statement = self.connection().prepare(
            "SELECT batch_id, created_at, payload FROM runtime_outbox_batch
             ORDER BY created_at ASC, rowid ASC LIMIT ?1",
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

    #[test]
    fn staging_replica_triggers_capture_insert_update_and_delete_locally() {
        let store = SqliteStore::open_in_memory().expect("store");
        let tables = store.durable_table_names().expect("contract tables");
        install_replica_triggers(store.connection(), &tables).expect("install triggers");

        store
            .connection()
            .execute(
                "INSERT INTO guild_config (guild_id, locale) VALUES ('replica-guild', 'pt')",
                [],
            )
            .expect("insert");
        store
            .connection()
            .execute(
                "UPDATE guild_config SET locale = 'en' WHERE guild_id = 'replica-guild'",
                [],
            )
            .expect("update");
        store
            .connection()
            .execute(
                "DELETE FROM guild_config WHERE guild_id = 'replica-guild'",
                [],
            )
            .expect("delete");

        let events = store.list_runtime_outbox(10).expect("outbox");
        assert_eq!(events.len(), 3);
        let operations = events
            .iter()
            .map(|event| {
                serde_json::from_str::<serde_json::Value>(&event.payload)
                    .expect("payload")
                    ["replica"]["operation"]
                    .as_str()
                    .expect("operation")
                    .to_owned()
            })
            .collect::<Vec<_>>();
        assert_eq!(operations, ["upsert", "upsert", "delete"]);

        store
            .connection()
            .execute(
                "INSERT INTO talk_stats (guild_id, user_id, spoken_count) VALUES ('replica-guild', 'user', 1)",
                [],
            )
            .expect("hot counter write");
        assert_eq!(store.list_runtime_outbox(10).expect("outbox").len(), 3);
    }
}
