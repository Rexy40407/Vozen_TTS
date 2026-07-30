//! Server-authoritative daily speech-to-text usage.
//!
//! The public reservation method deliberately does not accept a day or timestamp. It derives the
//! UTC day from the machine running Vozen, so changing a user's Discord/PC clock cannot create a
//! second reset. The private day-aware helper exists only for deterministic store tests.

use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::params;

use crate::{SqliteStore, StoreError, utc_day_key_from_unix_millis};

pub const PLUS_STT_DAILY_LIMIT_MS: i64 = 60 * 60 * 1_000;
pub const PREMIUM_STT_DAILY_LIMIT_MS: i64 = 30 * 60 * 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SttUsageReservation {
    pub allowed: bool,
    pub used_ms: i64,
    pub remaining_ms: i64,
}

impl SqliteStore {
    /// Resolves the per-user transcription entitlement at the server's current decision time.
    /// Direct Plus always wins over a guild Premium entitlement because the quota is per person.
    pub fn stt_daily_limit_ms(
        &self,
        user_id: &str,
        guild_id: &str,
        now_ms: i64,
    ) -> Result<Option<i64>, StoreError> {
        if user_id.trim().is_empty() || guild_id.trim().is_empty() {
            return Err(StoreError::InvalidSttUsageInput);
        }
        if self.is_user_premium(user_id, now_ms)? {
            return Ok(Some(PLUS_STT_DAILY_LIMIT_MS));
        }
        if self.is_guild_premium(guild_id, now_ms)? {
            return Ok(Some(PREMIUM_STT_DAILY_LIMIT_MS));
        }
        Ok(None)
    }

    /// Atomically reserves actual audio milliseconds for the server's current UTC day.
    ///
    /// The caller must invoke this immediately before sending audio to Whisper. The operation is
    /// all-or-nothing and safe when multiple runtime tasks reserve the same user concurrently.
    pub fn reserve_stt_audio_ms(
        &self,
        user_id: &str,
        requested_ms: i64,
        limit_ms: i64,
    ) -> Result<SttUsageReservation, StoreError> {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
            .unwrap_or_default();
        let day = utc_day_key_from_unix_millis(now_ms);
        self.reserve_stt_audio_ms_on_day(&day, user_id, requested_ms, limit_ms)
    }

    fn reserve_stt_audio_ms_on_day(
        &self,
        day: &str,
        user_id: &str,
        requested_ms: i64,
        limit_ms: i64,
    ) -> Result<SttUsageReservation, StoreError> {
        if !is_valid_day(day) || user_id.trim().is_empty() || requested_ms <= 0 || limit_ms <= 0 {
            return Err(StoreError::InvalidSttUsageInput);
        }

        // SQLite evaluates the conflict update atomically. A failed WHERE clause changes nothing,
        // which prevents two concurrent utterances from crossing the cap.
        let changed = self.connection().execute(
            "INSERT INTO stt_daily_usage (day, user_id, audio_ms)
             SELECT ?1, ?2, ?3
             WHERE ?3 <= ?4
             ON CONFLICT(day, user_id) DO UPDATE SET audio_ms = audio_ms + excluded.audio_ms
             WHERE stt_daily_usage.audio_ms + excluded.audio_ms <= ?4",
            params![day, user_id, requested_ms, limit_ms],
        )?;
        let used_ms: i64 = self
            .connection()
            .query_row(
                "SELECT audio_ms FROM stt_daily_usage WHERE day = ?1 AND user_id = ?2",
                params![day, user_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(SttUsageReservation {
            allowed: changed != 0,
            used_ms,
            remaining_ms: (limit_ms - used_ms).max(0),
        })
    }
}

fn is_valid_day(day: &str) -> bool {
    day.len() == 10
        && day.as_bytes()[4] == b'-'
        && day.as_bytes()[7] == b'-'
        && day
            .bytes()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};
    use std::thread;

    use super::*;

    fn reserve(
        store: &SqliteStore,
        day: &str,
        user: &str,
        ms: i64,
        limit: i64,
    ) -> SttUsageReservation {
        store
            .reserve_stt_audio_ms_on_day(day, user, ms, limit)
            .expect("reservation")
    }

    #[test]
    fn reserves_actual_audio_and_rejects_the_overflow_atomically() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            reserve(&store, "2026-07-30", "user", 1_000, 3_000),
            SttUsageReservation {
                allowed: true,
                used_ms: 1_000,
                remaining_ms: 2_000
            }
        );
        assert_eq!(
            reserve(&store, "2026-07-30", "user", 2_001, 3_000),
            SttUsageReservation {
                allowed: false,
                used_ms: 1_000,
                remaining_ms: 2_000
            }
        );
        assert_eq!(
            reserve(&store, "2026-07-30", "user", 2_000, 3_000),
            SttUsageReservation {
                allowed: true,
                used_ms: 3_000,
                remaining_ms: 0
            }
        );
    }

    #[test]
    fn usage_is_global_per_user_across_guilds_and_resets_only_on_a_new_server_day() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(reserve(&store, "2026-07-30", "user", 2_000, 3_000).allowed);
        assert!(!reserve(&store, "2026-07-30", "user", 2_000, 3_000).allowed);
        assert!(reserve(&store, "2026-07-31", "user", 2_000, 3_000).allowed);
        assert!(reserve(&store, "2026-07-30", "other", 2_000, 3_000).allowed);
    }

    #[test]
    fn concurrent_reservations_never_cross_the_limit() {
        let path =
            std::env::temp_dir().join(format!("vozen-stt-usage-{}.sqlite", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let store = Arc::new(Mutex::new(SqliteStore::open(&path).expect("store")));
        let threads = (0..8)
            .map(|_| {
                let store = Arc::clone(&store);
                thread::spawn(move || {
                    store
                        .lock()
                        .expect("lock")
                        .reserve_stt_audio_ms_on_day("2026-07-30", "user", 1_000, 3_000)
                        .expect("reserve")
                })
            })
            .collect::<Vec<_>>();
        let allowed = threads
            .into_iter()
            .filter_map(|thread| thread.join().ok())
            .filter(|reservation| reservation.allowed)
            .count();
        assert_eq!(allowed, 3);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn public_api_uses_server_utc_day_without_a_client_timestamp_argument() {
        let store = SqliteStore::open_in_memory().expect("store");
        let result = store
            .reserve_stt_audio_ms("user", 1_000, 2_000)
            .expect("reserve");
        assert!(result.allowed);
        assert_eq!(result.used_ms, 1_000);
    }

    #[test]
    fn plus_has_sixty_minutes_and_premium_server_has_thirty_minutes_per_person() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .connection()
            .execute(
                "INSERT INTO premium_user (user_id, expires_at) VALUES ('plus', 10_000)",
                [],
            )
            .expect("plus");
        store
            .connection()
            .execute(
                "INSERT INTO premium_guild (guild_id, expires_at) VALUES ('premium-guild', 10_000)",
                [],
            )
            .expect("guild premium");
        assert_eq!(
            store
                .stt_daily_limit_ms("plus", "free-guild", 1)
                .expect("plus limit"),
            Some(PLUS_STT_DAILY_LIMIT_MS)
        );
        assert_eq!(
            store
                .stt_daily_limit_ms("member", "premium-guild", 1)
                .expect("premium limit"),
            Some(PREMIUM_STT_DAILY_LIMIT_MS)
        );
        assert_eq!(
            store
                .stt_daily_limit_ms("member", "free-guild", 1)
                .expect("no limit"),
            None
        );
    }
}
