//! Durable, aggregate-only health state for Top.gg server-count publishing.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

pub const TOPGG_STALE_AFTER_MS: i64 = 90 * 60 * 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TopggSyncStatus {
    pub last_attempt_at: i64,
    pub last_success_at: Option<i64>,
    pub last_status: Option<u16>,
    pub last_server_count: Option<i64>,
    pub consecutive_failures: i64,
    pub stale: bool,
}

impl SqliteStore {
    /// Stores only bounded operational context, never an auth token or response body.
    pub fn record_topgg_sync_attempt(
        &self,
        now: i64,
        status: Option<u16>,
        server_count: usize,
        succeeded: bool,
    ) -> Result<(), StoreError> {
        let count = i64::try_from(server_count).map_err(|_| StoreError::InvalidTopggServerCount)?;
        self.connection().execute(
            "INSERT INTO topgg_sync_state
               (singleton, last_attempt_at, last_success_at, last_status, last_server_count, consecutive_failures)
             VALUES (1, ?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(singleton) DO UPDATE SET
               last_attempt_at = excluded.last_attempt_at,
               last_success_at = CASE WHEN ?6 THEN excluded.last_attempt_at ELSE topgg_sync_state.last_success_at END,
               last_status = excluded.last_status,
               last_server_count = excluded.last_server_count,
               consecutive_failures = CASE WHEN ?6 THEN 0 ELSE topgg_sync_state.consecutive_failures + 1 END",
            params![
                now,
                succeeded.then_some(now),
                status.map(i64::from),
                count,
                i64::from(!succeeded),
                succeeded,
            ],
        )?;
        Ok(())
    }

    pub fn topgg_sync_status(&self, now: i64) -> Result<Option<TopggSyncStatus>, StoreError> {
        self.connection()
            .query_row(
                "SELECT last_attempt_at, last_success_at, last_status, last_server_count, consecutive_failures
                 FROM topgg_sync_state WHERE singleton = 1",
                [],
                |row| {
                    let last_success_at: Option<i64> = row.get(1)?;
                    let status: Option<i64> = row.get(2)?;
                    let status = status.and_then(|value| u16::try_from(value).ok());
                    Ok(TopggSyncStatus {
                        last_attempt_at: row.get(0)?,
                        last_success_at,
                        last_status: status,
                        last_server_count: row.get(3)?,
                        consecutive_failures: row.get(4)?,
                        stale: last_success_at.is_none_or(|success| {
                            now.saturating_sub(success) > TOPGG_STALE_AFTER_MS
                        }),
                    })
                },
            )
            .optional()
            .map_err(StoreError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn successful_sync_resets_failures_and_failures_become_stale() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(store.topgg_sync_status(1).expect("empty"), None);
        store
            .record_topgg_sync_attempt(1_000, Some(204), 166, true)
            .expect("success");
        assert_eq!(
            store.topgg_sync_status(1_001).expect("status"),
            Some(TopggSyncStatus {
                last_attempt_at: 1_000,
                last_success_at: Some(1_000),
                last_status: Some(204),
                last_server_count: Some(166),
                consecutive_failures: 0,
                stale: false,
            })
        );
        store
            .record_topgg_sync_attempt(2_000, Some(401), 167, false)
            .expect("failure");
        let failed = store
            .topgg_sync_status(1_000 + TOPGG_STALE_AFTER_MS + 1)
            .expect("failed status")
            .expect("row");
        assert_eq!(failed.last_status, Some(401));
        assert_eq!(failed.consecutive_failures, 1);
        assert!(failed.stale);
    }
}
