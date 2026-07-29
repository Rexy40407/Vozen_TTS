//! Explicit SQLite-to-Postgres importer used only for staging verification.
//!
//! It never runs by default. The operator must opt in through a staging-only environment flag;
//! each contract table is inserted in chunks and then reconciled by row count.

use std::path::Path;

use sqlx::PgPool;
use thiserror::Error;
use vozen_store::SqliteStore;

const CHUNK_SIZE: usize = 250;

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("SQLite import source failed: {0}")]
    Store(#[from] vozen_store::StoreError),
    #[error("Postgres import failed")]
    Postgres(#[source] sqlx::Error),
    #[error(
        "row-count reconciliation failed for table {table}: SQLite={sqlite_rows}, Postgres={postgres_rows}"
    )]
    CountMismatch {
        table: String,
        sqlite_rows: i64,
        postgres_rows: i64,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportTableReport {
    pub table: String,
    pub sqlite_rows: i64,
    pub postgres_rows: i64,
}

pub async fn import_and_reconcile(
    pool: &PgPool,
    sqlite_path: &Path,
) -> Result<Vec<ImportTableReport>, ImportError> {
    let store = SqliteStore::open(sqlite_path)?;
    let tables = store.durable_table_names()?;
    let mut reports = Vec::with_capacity(tables.len());
    for table in tables {
        let rows = store.export_table_rows(&table)?;
        for chunk in rows.chunks(CHUNK_SIZE) {
            let payload = serde_json::to_string(chunk).map_err(|_| ImportError::CountMismatch {
                table: table.clone(),
                sqlite_rows: -1,
                postgres_rows: -1,
            })?;
            let query = format!(
                "INSERT INTO vozen.\"{table}\" SELECT * FROM jsonb_populate_recordset(NULL::vozen.\"{table}\", $1::jsonb) ON CONFLICT DO NOTHING"
            );
            sqlx::query(&query)
                .bind(payload)
                .execute(pool)
                .await
                .map_err(ImportError::Postgres)?;
        }
        let sqlite_rows = store.durable_table_row_count(&table)?;
        let query = format!("SELECT COUNT(*)::bigint FROM vozen.\"{table}\"");
        let postgres_rows: i64 = sqlx::query_scalar(&query)
            .fetch_one(pool)
            .await
            .map_err(ImportError::Postgres)?;
        if sqlite_rows != postgres_rows {
            return Err(ImportError::CountMismatch {
                table,
                sqlite_rows,
                postgres_rows,
            });
        }
        reports.push(ImportTableReport {
            table,
            sqlite_rows,
            postgres_rows,
        });
    }
    Ok(reports)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn importer_reports_count_mismatches_without_hiding_table_name() {
        let error = ImportError::CountMismatch {
            table: "guild_config".into(),
            sqlite_rows: 2,
            postgres_rows: 1,
        };
        assert!(error.to_string().contains("guild_config"));
    }
}
