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
    #[error("Postgres import failed: {0}")]
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
    sqlx::query(
        "INSERT INTO vozen.runtime_migration_state (marker, completed_at)
         VALUES ('sqlite_initial_import_v1', EXTRACT(EPOCH FROM NOW())::bigint * 1000)
         ON CONFLICT (marker) DO UPDATE SET completed_at = EXCLUDED.completed_at",
    )
    .execute(pool)
    .await
    .map_err(ImportError::Postgres)?;
    Ok(reports)
}

#[cfg(test)]
mod tests {
    use std::{
        fs::remove_file,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use vozen_store::{GuildConfigPatch, UserEngine, UserVoice};

    fn temporary_database_path() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("vozen-postgres-import-{nonce}.sqlite"))
    }

    fn remove_database_copy(path: &Path) {
        let _ = remove_file(path);
        let _ = remove_file(format!("{}-wal", path.display()));
        let _ = remove_file(format!("{}-shm", path.display()));
    }

    #[test]
    fn importer_reports_count_mismatches_without_hiding_table_name() {
        let error = ImportError::CountMismatch {
            table: "guild_config".into(),
            sqlite_rows: 2,
            postgres_rows: 1,
        };
        assert!(error.to_string().contains("guild_config"));
    }

    /// Opt-in staging integration test. It uses a fresh SQLite source and removes only its
    /// deterministic fixture rows from Postgres, so it cannot touch production data.
    #[tokio::test]
    async fn staging_imports_and_reconciles_a_sqlite_fixture_when_explicitly_requested() {
        let Ok(database_url) = std::env::var("VOZEN_POSTGRES_INTEGRATION_URL") else {
            return;
        };
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .expect("connect staging Postgres");
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let guild_id = format!("staging-import-guild-{nonce}");
        let user_id = format!("staging-import-user-{nonce}");
        let path = temporary_database_path();

        let store = SqliteStore::open(&path).expect("create SQLite fixture");
        store
            .update_guild_config(
                &guild_id,
                GuildConfigPatch {
                    autoread: Some(true),
                    locale: Some("pt".into()),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("seed guild configuration");
        store
            .set_user_voice(
                &guild_id,
                &user_id,
                &UserVoice {
                    model: "pt_PT-google-medium".into(),
                    speed: 1.05,
                    engine: UserEngine::Google,
                },
            )
            .expect("seed user voice");
        drop(store);

        let verification = async {
            let report = import_and_reconcile(&pool, &path)
                .await
                .map_err(|error| error.to_string())?;
            if !report
                .iter()
                .any(|row| row.table == "guild_config" && row.sqlite_rows == 1)
            {
                return Err("guild configuration was not reconciled".to_owned());
            }
            if !report
                .iter()
                .any(|row| row.table == "user_voice" && row.sqlite_rows == 1)
            {
                return Err("user voice was not reconciled".to_owned());
            }

            let locale: String =
                sqlx::query_scalar("SELECT locale FROM vozen.guild_config WHERE guild_id = $1")
                    .bind(&guild_id)
                    .fetch_one(&pool)
                    .await
                    .map_err(|error| error.to_string())?;
            if locale != "pt" {
                return Err(format!("unexpected imported locale: {locale}"));
            }
            let voice_model: String = sqlx::query_scalar(
                "SELECT voice_model FROM vozen.user_voice WHERE guild_id = $1 AND user_id = $2",
            )
            .bind(&guild_id)
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .map_err(|error| error.to_string())?;
            if voice_model != "pt_PT-google-medium" {
                return Err(format!("unexpected imported voice model: {voice_model}"));
            }
            Ok::<(), String>(())
        }
        .await;

        sqlx::query("DELETE FROM vozen.user_voice WHERE guild_id = $1")
            .bind(&guild_id)
            .execute(&pool)
            .await
            .expect("remove staged user voice fixture");
        sqlx::query("DELETE FROM vozen.guild_config WHERE guild_id = $1")
            .bind(&guild_id)
            .execute(&pool)
            .await
            .expect("remove staged guild configuration fixture");
        sqlx::query(
            "DELETE FROM vozen.runtime_migration_state WHERE marker = 'sqlite_initial_import_v1'",
        )
        .execute(&pool)
        .await
        .expect("remove fixture import marker");
        remove_database_copy(&path);
        verification.expect("verify staging import");
    }
}
