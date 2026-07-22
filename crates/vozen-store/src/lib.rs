#![forbid(unsafe_code)]

//! SQLite compatibility boundary for the Rust runtime.
//!
//! The Node implementation remains authoritative while the migration is in progress. This crate
//! deliberately consumes its generated schema contract rather than maintaining a hand-copied DDL
//! list. Existing-database data migrations are added before cutover; this first boundary proves
//! that a newly created Rust database has the same durable objects as today's Node runtime.

use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;
use serde::Deserialize;
use thiserror::Error;

mod guild_config;

pub use guild_config::{GuildConfig, GuildConfigPatch};

pub const SQLITE_SCHEMA_CONTRACT_VERSION: u16 = 1;
const SQLITE_SCHEMA: &str = include_str!("../../../contracts/sqlite-schema.json");

#[derive(Debug, Deserialize)]
struct SqliteSchemaContract {
    schema_version: u16,
    generated_from: String,
    objects: Vec<SqliteSchemaObject>,
}

#[derive(Debug, Deserialize)]
struct SqliteSchemaObject {
    #[serde(rename = "type")]
    kind: String,
    name: String,
    sql: String,
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("invalid SQLite schema contract: {0}")]
    InvalidContract(#[from] serde_json::Error),
    #[error("unsupported SQLite schema contract version {0}")]
    UnsupportedContractVersion(u16),
    #[error("schema object is invalid: {0}")]
    InvalidSchemaObject(String),
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// A Rust-owned SQLite connection configured with the same durable schema as the live bot.
pub struct SqliteStore {
    connection: Connection,
}

impl SqliteStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StoreError> {
        let connection = Connection::open(path)?;
        Self::from_connection(connection)
    }

    pub fn open_in_memory() -> Result<Self, StoreError> {
        let connection = Connection::open_in_memory()?;
        Self::from_connection(connection)
    }

    fn from_connection(connection: Connection) -> Result<Self, StoreError> {
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.execute_batch(
            "PRAGMA foreign_keys = ON;\nPRAGMA journal_mode = WAL;\nPRAGMA synchronous = NORMAL;",
        )?;
        install_current_schema(&connection)?;
        Ok(Self { connection })
    }

    pub fn has_schema_object(&self, name: &str) -> Result<bool, StoreError> {
        let found = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = ?1)",
            [name],
            |row| row.get::<_, i64>(0),
        )?;
        Ok(found != 0)
    }

    pub(crate) fn connection(&self) -> &Connection {
        &self.connection
    }
}

fn install_current_schema(connection: &Connection) -> Result<(), StoreError> {
    let contract: SqliteSchemaContract = serde_json::from_str(SQLITE_SCHEMA)?;
    if contract.schema_version != SQLITE_SCHEMA_CONTRACT_VERSION {
        return Err(StoreError::UnsupportedContractVersion(
            contract.schema_version,
        ));
    }
    if contract.generated_from != "src/store/db.ts" {
        return Err(StoreError::InvalidSchemaObject(
            "schema contract source is not the Node database migrator".into(),
        ));
    }

    for object in contract.objects {
        if !matches!(object.kind.as_str(), "table" | "index")
            || object.name.trim().is_empty()
            || !object.sql.trim_start().starts_with("CREATE ")
        {
            return Err(StoreError::InvalidSchemaObject(object.name));
        }
        connection.execute_batch(&object.sql)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_rust_database_contains_the_node_schema_contract() {
        let store = SqliteStore::open_in_memory().expect("create in-memory store");
        assert!(
            store
                .has_schema_object("guild_config")
                .expect("query guild config")
        );
        assert!(
            store
                .has_schema_object("premium_user")
                .expect("query premium user")
        );
        assert!(
            store
                .has_schema_object("kofi_pending")
                .expect("query Ko-fi pending")
        );
        assert!(
            store
                .has_schema_object("tts_lang_detect_on")
                .expect("query detection opt-in")
        );
        assert!(
            store
                .has_schema_object("idx_pass_activation_guild")
                .expect("query index")
        );
    }
}
