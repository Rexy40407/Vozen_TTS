//! Persistent Google HD character budgets.
//!
//! The Node implementation keeps monthly pools in `gcloud_usage` and one service-wide daily
//! backstop in `gcloud_daily_usage`. This module preserves those scopes and makes a reservation
//! all-or-nothing: a failed daily check rolls the monthly increment back.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

const DAY_MS: i64 = 86_400_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GcloudUsageScope {
    User,
    Pass,
    Guild,
    Global,
}

impl GcloudUsageScope {
    fn as_database(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Pass => "pass",
            Self::Guild => "guild",
            Self::Global => "global",
        }
    }
}

#[must_use]
pub fn month_key_utc(unix_millis: i64) -> String {
    utc_day_key(unix_millis)[..7].to_owned()
}

#[must_use]
pub fn day_key_utc(unix_millis: i64) -> String {
    utc_day_key(unix_millis)
}

impl SqliteStore {
    pub fn gcloud_monthly_chars(
        &self,
        scope: GcloudUsageScope,
        key: &str,
        month: &str,
    ) -> Result<i64, StoreError> {
        validate_pool(scope, key, month)?;
        self.connection()
            .query_row(
                "SELECT chars FROM gcloud_usage WHERE scope = ?1 AND key = ?2 AND month = ?3",
                params![scope.as_database(), key, month],
                |row| row.get(0),
            )
            .optional()
            .map(|value| value.unwrap_or(0))
            .map_err(StoreError::from)
    }

    /// Adds to a pool without applying a limit. Paid synthesis should use the reservation API.
    pub fn add_gcloud_monthly_chars(
        &self,
        scope: GcloudUsageScope,
        key: &str,
        month: &str,
        chars: i64,
    ) -> Result<(), StoreError> {
        validate_pool(scope, key, month)?;
        if chars < 0 {
            return Err(StoreError::InvalidGcloudChars);
        }
        self.connection().execute(
            "INSERT INTO gcloud_usage (scope, key, month, chars)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(scope, key, month)
             DO UPDATE SET chars = chars + excluded.chars",
            params![scope.as_database(), key, month, chars],
        )?;
        Ok(())
    }

    /// Reserves a paid Google HD call from its monthly pool and, when non-zero, the service-wide
    /// daily pool. No counter is changed when either budget would be exceeded.
    #[allow(clippy::too_many_arguments)]
    pub fn reserve_gcloud_chars(
        &self,
        scope: GcloudUsageScope,
        key: &str,
        month: &str,
        monthly_limit: i64,
        day: &str,
        daily_limit: i64,
        chars: i64,
    ) -> Result<bool, StoreError> {
        validate_pool(scope, key, month)?;
        validate_day(day)?;
        validate_non_negative_limit(monthly_limit)?;
        validate_non_negative_limit(daily_limit)?;
        if chars <= 0 {
            return Err(StoreError::InvalidGcloudChars);
        }

        let transaction = self.connection().unchecked_transaction()?;
        let changed = transaction.execute(
            "UPDATE gcloud_usage
                SET chars = chars + ?4
              WHERE scope = ?1 AND key = ?2 AND month = ?3
                AND chars + ?4 <= ?5",
            params![scope.as_database(), key, month, chars, monthly_limit],
        )?;
        if changed == 0 {
            let exists: bool = transaction.query_row(
                "SELECT EXISTS(SELECT 1 FROM gcloud_usage
                 WHERE scope = ?1 AND key = ?2 AND month = ?3)",
                params![scope.as_database(), key, month],
                |row| row.get(0),
            )?;
            if exists {
                transaction.rollback()?;
                return Ok(false);
            }
            // The INSERT path needs its own guard: an ON CONFLICT WHERE clause only guards
            // existing rows and would otherwise admit a first reservation over the limit.
            let inserted = transaction.execute(
                "INSERT INTO gcloud_usage (scope, key, month, chars)
                 SELECT ?1, ?2, ?3, ?4 WHERE ?4 <= ?5",
                params![scope.as_database(), key, month, chars, monthly_limit],
            )?;
            if inserted == 0 {
                transaction.rollback()?;
                return Ok(false);
            }
        }

        if daily_limit > 0 {
            let changed = transaction.execute(
                "UPDATE gcloud_daily_usage
                    SET chars = chars + ?1
                  WHERE day = ?2 AND chars + ?1 <= ?3",
                params![chars, day, daily_limit],
            )?;
            if changed == 0 {
                let exists: bool = transaction.query_row(
                    "SELECT EXISTS(SELECT 1 FROM gcloud_daily_usage WHERE day = ?1)",
                    [day],
                    |row| row.get(0),
                )?;
                if exists {
                    transaction.rollback()?;
                    return Ok(false);
                }
                let inserted = transaction.execute(
                    "INSERT INTO gcloud_daily_usage (day, chars)
                     SELECT ?1, ?2 WHERE ?2 <= ?3",
                    params![day, chars, daily_limit],
                )?;
                if inserted == 0 {
                    transaction.rollback()?;
                    return Ok(false);
                }
            }
        }
        transaction.commit()?;
        Ok(true)
    }

    pub fn refund_gcloud_chars(
        &self,
        scope: GcloudUsageScope,
        key: &str,
        month: &str,
        day: &str,
        daily_limit: i64,
        chars: i64,
    ) -> Result<(), StoreError> {
        validate_pool(scope, key, month)?;
        validate_day(day)?;
        validate_non_negative_limit(daily_limit)?;
        if chars <= 0 {
            return Err(StoreError::InvalidGcloudChars);
        }
        let transaction = self.connection().unchecked_transaction()?;
        transaction.execute(
            "UPDATE gcloud_usage SET chars = MAX(0, chars - ?1)
             WHERE scope = ?2 AND key = ?3 AND month = ?4",
            params![chars, scope.as_database(), key, month],
        )?;
        if daily_limit > 0 {
            transaction.execute(
                "UPDATE gcloud_daily_usage SET chars = MAX(0, chars - ?1) WHERE day = ?2",
                params![chars, day],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn delete_user_gcloud_usage(&self, user_id: &str) -> Result<(), StoreError> {
        if user_id.trim().is_empty() {
            return Err(StoreError::InvalidGcloudKey);
        }
        self.connection().execute(
            "DELETE FROM gcloud_usage WHERE key = ?1 AND scope IN ('user', 'pass')",
            [user_id],
        )?;
        Ok(())
    }

    pub fn purge_old_gcloud_usage(&self, cutoff_month: &str) -> Result<usize, StoreError> {
        validate_month(cutoff_month)?;
        Ok(self
            .connection()
            .execute("DELETE FROM gcloud_usage WHERE month < ?1", [cutoff_month])?)
    }
}

fn validate_pool(_scope: GcloudUsageScope, key: &str, month: &str) -> Result<(), StoreError> {
    if key.trim().is_empty() {
        return Err(StoreError::InvalidGcloudKey);
    }
    validate_month(month)
}

fn validate_month(month: &str) -> Result<(), StoreError> {
    let bytes = month.as_bytes();
    if bytes.len() != 7
        || bytes[4] != b'-'
        || !bytes[..4].iter().all(u8::is_ascii_digit)
        || !bytes[5..].iter().all(u8::is_ascii_digit)
        || !(1..=12).contains(&month[5..].parse::<u8>().unwrap_or_default())
    {
        return Err(StoreError::InvalidGcloudMonth);
    }
    Ok(())
}

fn validate_day(day: &str) -> Result<(), StoreError> {
    let bytes = day.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes[..4].iter().all(u8::is_ascii_digit)
        || !bytes[5..7].iter().all(u8::is_ascii_digit)
        || !bytes[8..].iter().all(u8::is_ascii_digit)
    {
        return Err(StoreError::InvalidGcloudDay);
    }
    let year = day[..4].parse::<i32>().unwrap_or_default();
    let month = day[5..7].parse::<u8>().unwrap_or_default();
    let date = day[8..].parse::<u8>().unwrap_or_default();
    if year < 1 || !(1..=12).contains(&month) || !(1..=31).contains(&date) {
        return Err(StoreError::InvalidGcloudDay);
    }
    let max_day = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][usize::from(month - 1)];
    if date > max_day {
        return Err(StoreError::InvalidGcloudDay);
    }
    Ok(())
}

fn validate_non_negative_limit(value: i64) -> Result<(), StoreError> {
    if value < 0 {
        return Err(StoreError::InvalidGcloudLimit);
    }
    Ok(())
}

fn utc_day_key(unix_millis: i64) -> String {
    let days = unix_millis.div_euclid(DAY_MS);
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}")
}

// Howard Hinnant's proleptic Gregorian conversion, matching the telemetry module.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 }.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096).div_euclid(365);
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2).div_euclid(153);
    let d = doy - (153 * mp + 2).div_euclid(5) + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let y = y + i64::from(m <= 2);
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utc_keys_match_node_boundaries() {
        assert_eq!(month_key_utc(1_767_225_600_000), "2026-01");
        assert_eq!(day_key_utc(1_767_225_600_000), "2026-01-01");
        assert_eq!(month_key_utc(1_798_761_600_000), "2027-01");
    }

    #[test]
    fn monthly_pool_accumulates_by_scope_key_and_month() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store
                .gcloud_monthly_chars(GcloudUsageScope::User, "u1", "2026-07")
                .expect("empty"),
            0
        );
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::User, "u1", "2026-07", 100)
            .expect("first");
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::User, "u1", "2026-07", 250)
            .expect("second");
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::Pass, "u1", "2026-07", 50)
            .expect("scope");
        assert_eq!(
            store
                .gcloud_monthly_chars(GcloudUsageScope::User, "u1", "2026-07")
                .expect("sum"),
            350
        );
        assert_eq!(
            store
                .gcloud_monthly_chars(GcloudUsageScope::Pass, "u1", "2026-07")
                .expect("separate"),
            50
        );
    }

    #[test]
    fn reservation_is_all_or_nothing_across_month_and_day_limits() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(
            store
                .reserve_gcloud_chars(
                    GcloudUsageScope::User,
                    "u",
                    "2026-07",
                    5,
                    "2026-07-15",
                    3,
                    3
                )
                .expect("reserve")
        );
        assert!(
            !store
                .reserve_gcloud_chars(
                    GcloudUsageScope::User,
                    "u",
                    "2026-07",
                    5,
                    "2026-07-15",
                    3,
                    3
                )
                .expect("monthly denial")
        );
        assert_eq!(
            store
                .gcloud_monthly_chars(GcloudUsageScope::User, "u", "2026-07")
                .expect("monthly"),
            3
        );
        assert_eq!(
            store
                .connection()
                .query_row(
                    "SELECT chars FROM gcloud_daily_usage WHERE day = '2026-07-15'",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .expect("daily"),
            3
        );
        let denied = store
            .reserve_gcloud_chars(
                GcloudUsageScope::Pass,
                "owner",
                "2026-07",
                100,
                "2026-07-15",
                3,
                1,
            )
            .expect("daily denial");
        assert!(!denied);
        assert_eq!(
            store
                .gcloud_monthly_chars(GcloudUsageScope::Pass, "owner", "2026-07")
                .expect("rollback"),
            0
        );
    }

    #[test]
    fn personal_delete_and_retention_do_not_touch_current_guild_pool() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::User, "u", "2026-06", 1)
            .expect("user");
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::Pass, "u", "2026-06", 2)
            .expect("pass");
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::Guild, "g", "2026-06", 3)
            .expect("guild");
        store
            .add_gcloud_monthly_chars(GcloudUsageScope::Guild, "g", "2026-07", 4)
            .expect("current");
        store.delete_user_gcloud_usage("u").expect("erase");
        assert_eq!(store.purge_old_gcloud_usage("2026-07").expect("purge"), 1);
        assert_eq!(
            store
                .gcloud_monthly_chars(GcloudUsageScope::Guild, "g", "2026-07")
                .expect("current"),
            4
        );
    }
}
