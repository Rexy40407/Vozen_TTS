//! Privacy-aware growth lifecycle for Discord servers.
//!
//! The per-server row is only retained while the bot is installed (plus the existing departure
//! grace period). The dashboard reads aggregate daily counters and coarse conversion/retention
//! rates; it never receives a guild ID from this module.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError, utc_day_key_from_unix_millis};

const PRODUCT: &str = "tts";
const UNKNOWN_SOURCE: &str = "unknown";
const BASELINE_SOURCE: &str = "baseline";
const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GrowthEvent {
    Joined,
    Left,
    SetupCompleted,
    FirstValue,
    Active,
    Vote,
    RetainedW7,
    RetainedW30,
}

impl GrowthEvent {
    const fn as_database(self) -> &'static str {
        match self {
            Self::Joined => "joined",
            Self::Left => "left",
            Self::SetupCompleted => "setup_completed",
            Self::FirstValue => "first_value",
            Self::Active => "active",
            Self::Vote => "vote",
            Self::RetainedW7 => "retained_w7",
            Self::RetainedW30 => "retained_w30",
        }
    }
}

/// Aggregated lifetime-to-date lifecycle information. All counters are server counts, never
/// message counts or Discord identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GrowthOverview {
    pub current_guilds: i64,
    pub baseline_guilds: i64,
    pub configured_guilds: i64,
    pub used_guilds: i64,
    pub joins: i64,
    pub leaves: i64,
    pub setup_completed: i64,
    pub first_value: i64,
    pub retained_w7: i64,
    pub eligible_w7: i64,
    pub retained_w30: i64,
    pub eligible_w30: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GrowthDailyMetric {
    pub day: String,
    pub source: String,
    pub joins: i64,
    pub leaves: i64,
    pub setup_completed: i64,
    pub first_value: i64,
    pub active: i64,
    pub votes: i64,
}

impl SqliteStore {
    /// Records a Guild Create event. A re-invite clears the departure timestamp while preserving
    /// the first observed installation, which keeps cohort metrics stable across reconnects.
    pub fn record_guild_join(
        &self,
        guild_id: &str,
        source: Option<&str>,
        now: i64,
    ) -> Result<bool, StoreError> {
        validate_guild_id(guild_id)?;
        let source = normalize_source(source)?;
        let transaction = self.connection().unchecked_transaction()?;
        let existing_departure: Option<Option<i64>> = transaction
            .query_row(
                "SELECT departed_at FROM guild_growth_lifecycle WHERE guild_id = ?1",
                [guild_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()?;
        let counted = match existing_departure {
            None => {
                transaction.execute(
                    "INSERT INTO guild_growth_lifecycle
                       (guild_id, product, first_joined_at, last_joined_at, install_source)
                     VALUES (?1, ?2, ?3, ?3, ?4)",
                    params![guild_id, PRODUCT, now, source],
                )?;
                add_daily(&transaction, now, &source, GrowthEvent::Joined)?;
                true
            }
            Some(Some(_)) => {
                let current_source: String = transaction.query_row(
                    "SELECT install_source FROM guild_growth_lifecycle WHERE guild_id = ?1",
                    [guild_id],
                    |row| row.get(0),
                )?;
                transaction.execute(
                    "UPDATE guild_growth_lifecycle
                     SET last_joined_at = ?2,
                         departed_at = NULL,
                         install_source = CASE
                           WHEN install_source IN ('unknown', 'baseline') THEN ?3
                           ELSE install_source
                         END
                     WHERE guild_id = ?1",
                    params![guild_id, now, source],
                )?;
                // A re-invite is still a genuine acquisition event. Attribute it to the original
                // known source when possible rather than overwriting campaign attribution.
                add_daily(
                    &transaction,
                    now,
                    if current_source == UNKNOWN_SOURCE || current_source == BASELINE_SOURCE {
                        &source
                    } else {
                        &current_source
                    },
                    GrowthEvent::Joined,
                )?;
                true
            }
            Some(None) => {
                // Discord emits Guild Create during every gateway resume. An already-active row
                // is therefore not a new acquisition and must not inflate the join series.
                transaction.execute(
                    "UPDATE guild_growth_lifecycle SET last_joined_at = ?2 WHERE guild_id = ?1",
                    params![guild_id, now],
                )?;
                false
            }
        };
        transaction.commit()?;
        Ok(counted)
    }

    /// Saves a validated OAuth attribution before Guild Create arrives. The server ID remains
    /// private and the untrusted public source is reduced to a small allowlisted token.
    pub fn set_guild_install_source(
        &self,
        guild_id: &str,
        source: &str,
        now: i64,
    ) -> Result<(), StoreError> {
        validate_guild_id(guild_id)?;
        let source = normalize_source(Some(source))?;
        self.connection().execute(
            "INSERT INTO guild_growth_lifecycle
               (guild_id, product, first_joined_at, last_joined_at, install_source)
             VALUES (?1, ?2, ?3, ?3, ?4)
             ON CONFLICT(guild_id) DO UPDATE SET
               install_source = CASE
                 WHEN guild_growth_lifecycle.install_source = 'unknown'
                   OR (guild_growth_lifecycle.install_source = 'baseline'
                       AND guild_growth_lifecycle.departed_at IS NOT NULL)
                   THEN excluded.install_source
                 ELSE guild_growth_lifecycle.install_source
               END",
            params![guild_id, PRODUCT, now, source],
        )?;
        Ok(())
    }

    /// Records a confirmed departure once. Transient Discord guild unavailability is filtered by
    /// the gateway before this method is called.
    pub fn record_guild_departure(&self, guild_id: &str, now: i64) -> Result<bool, StoreError> {
        validate_guild_id(guild_id)?;
        let transaction = self.connection().unchecked_transaction()?;
        transaction.execute(
            "INSERT INTO guild_growth_lifecycle
               (guild_id, product, first_joined_at, last_joined_at, install_source, departed_at)
             VALUES (?1, ?2, ?3, ?3, ?4, ?3)
             ON CONFLICT(guild_id) DO NOTHING",
            params![guild_id, PRODUCT, now, UNKNOWN_SOURCE],
        )?;
        let changed = transaction.execute(
            "UPDATE guild_growth_lifecycle
             SET departed_at = ?2 WHERE guild_id = ?1 AND departed_at IS NULL",
            params![guild_id, now],
        )?;
        if changed != 0 {
            let source = lifecycle_source(&transaction, guild_id)?;
            add_daily(&transaction, now, &source, GrowthEvent::Left)?;
        }
        transaction.commit()?;
        Ok(changed != 0)
    }

    /// Marks the first completed guided setup. Repeated settings updates do not inflate the
    /// funnel.
    pub fn record_guild_setup_completed(&self, guild_id: &str, now: i64) -> Result<(), StoreError> {
        self.record_once(
            guild_id,
            now,
            "setup_completed_at",
            GrowthEvent::SetupCompleted,
        )
    }

    /// Marks the first successful user-facing value (a queued/reproduced TTS item) and records
    /// one active-server observation per UTC day.
    pub fn record_guild_first_value(&self, guild_id: &str, now: i64) -> Result<(), StoreError> {
        self.record_once(guild_id, now, "first_value_at", GrowthEvent::FirstValue)?;
        self.record_guild_activity(guild_id, now)
    }

    /// Records activity at most once per server per UTC day.
    pub fn record_guild_activity(&self, guild_id: &str, now: i64) -> Result<(), StoreError> {
        validate_guild_id(guild_id)?;
        let transaction = self.connection().unchecked_transaction()?;
        ensure_lifecycle(&transaction, guild_id, now)?;
        transaction.execute(
            "UPDATE guild_growth_lifecycle SET last_active_at = ?2 WHERE guild_id = ?1",
            params![guild_id, now],
        )?;
        let day = utc_day_key_from_unix_millis(now);
        let inserted = transaction.execute(
            "INSERT OR IGNORE INTO guild_growth_activity_day (guild_id, day) VALUES (?1, ?2)",
            params![guild_id, day],
        )?;
        if inserted != 0 {
            let source = lifecycle_source(&transaction, guild_id)?;
            add_daily(&transaction, now, &source, GrowthEvent::Active)?;
        }
        record_due_retention(&transaction, guild_id, now)?;
        transaction.commit()?;
        Ok(())
    }

    /// Produces owner-only aggregate lifecycle counters. A server is retained when it was active
    /// at or after the seven/thirty-day milestone; newer cohorts are excluded from the matching
    /// denominator.
    pub fn growth_overview(&self, now: i64) -> Result<GrowthOverview, StoreError> {
        let connection = self.connection();
        let sum = |event: GrowthEvent| -> Result<i64, StoreError> {
            let include_baseline = event == GrowthEvent::Left;
            connection
                .query_row(
                    "SELECT COALESCE(SUM(value), 0) FROM growth_daily_metric
                     WHERE product = ?1 AND event = ?2 AND (?3 OR source <> ?4)",
                    params![
                        PRODUCT,
                        event.as_database(),
                        include_baseline,
                        BASELINE_SOURCE
                    ],
                    |row| row.get(0),
                )
                .map_err(StoreError::from)
        };
        let current_guilds = connection.query_row(
            "SELECT COUNT(*) FROM guild_growth_lifecycle WHERE departed_at IS NULL",
            [],
            |row| row.get(0),
        )?;
        let configured_guilds = connection.query_row(
            "SELECT COUNT(*)
             FROM guild_growth_lifecycle lifecycle
             INNER JOIN guild_config config ON config.guild_id = lifecycle.guild_id
             WHERE lifecycle.departed_at IS NULL
               AND config.tts_channel_id IS NOT NULL
               AND config.autoread = 1
               AND config.enabled = 1",
            [],
            |row| row.get(0),
        )?;
        let baseline_guilds = connection.query_row(
            "SELECT COALESCE(SUM(value), 0) FROM growth_daily_metric
             WHERE product = ?1 AND source = ?2 AND event = 'joined'",
            params![PRODUCT, BASELINE_SOURCE],
            |row| row.get(0),
        )?;
        let used_guilds = connection.query_row(
            "SELECT COUNT(DISTINCT stats.guild_id)
             FROM talk_stats stats
             INNER JOIN guild_growth_lifecycle lifecycle ON lifecycle.guild_id = stats.guild_id
             WHERE lifecycle.departed_at IS NULL AND stats.spoken_count > 0",
            [],
            |row| row.get(0),
        )?;
        let eligible_w7 = count_eligible(connection, now, 7)?;
        let retained_w7 = sum(GrowthEvent::RetainedW7)?;
        let eligible_w30 = count_eligible(connection, now, 30)?;
        let retained_w30 = sum(GrowthEvent::RetainedW30)?;
        Ok(GrowthOverview {
            current_guilds,
            baseline_guilds,
            configured_guilds,
            used_guilds,
            joins: sum(GrowthEvent::Joined)?,
            leaves: sum(GrowthEvent::Left)?,
            setup_completed: sum(GrowthEvent::SetupCompleted)?,
            first_value: sum(GrowthEvent::FirstValue)?,
            retained_w7,
            eligible_w7,
            retained_w30,
            eligible_w30,
        })
    }

    /// The first day with telemetry is coverage metadata, not the bot's launch date.
    /// It is intentionally independent of the requested dashboard date range.
    pub fn growth_measurement_started_on(&self) -> Result<Option<String>, StoreError> {
        self.connection()
            .query_row(
                "SELECT MIN(day) FROM growth_daily_metric WHERE product = ?1",
                [PRODUCT],
                |row| row.get(0),
            )
            .map_err(StoreError::from)
    }

    pub fn list_growth_daily_metrics(
        &self,
        from_day: &str,
        to_day: &str,
    ) -> Result<Vec<GrowthDailyMetric>, StoreError> {
        validate_day(from_day)?;
        validate_day(to_day)?;
        if from_day > to_day {
            return Err(StoreError::InvalidOperationalMetricDay(from_day.to_owned()));
        }
        let mut statement = self.connection().prepare(
            "SELECT day, source,
               COALESCE(SUM(CASE WHEN source <> ?4 AND event = 'joined' THEN value END), 0),
               COALESCE(SUM(CASE WHEN event = 'left' THEN value END), 0),
               COALESCE(SUM(CASE WHEN source <> ?4 AND event = 'setup_completed' THEN value END), 0),
               COALESCE(SUM(CASE WHEN source <> ?4 AND event = 'first_value' THEN value END), 0),
               COALESCE(SUM(CASE WHEN event = 'active' THEN value END), 0),
               COALESCE(SUM(CASE WHEN event = 'vote' THEN value END), 0)
             FROM growth_daily_metric
             WHERE product = ?1 AND day >= ?2 AND day <= ?3
             GROUP BY day, source ORDER BY day ASC, source ASC",
        )?;
        statement
            .query_map(params![PRODUCT, from_day, to_day, BASELINE_SOURCE], |row| {
                Ok(GrowthDailyMetric {
                    day: row.get(0)?,
                    source: row.get(1)?,
                    joins: row.get(2)?,
                    leaves: row.get(3)?,
                    setup_completed: row.get(4)?,
                    first_value: row.get(5)?,
                    active: row.get(6)?,
                    votes: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(StoreError::from)
    }

    fn record_once(
        &self,
        guild_id: &str,
        now: i64,
        column: &str,
        event: GrowthEvent,
    ) -> Result<(), StoreError> {
        validate_guild_id(guild_id)?;
        let transaction = self.connection().unchecked_transaction()?;
        ensure_lifecycle(&transaction, guild_id, now)?;
        let changed = transaction.execute(
            &format!(
                "UPDATE guild_growth_lifecycle SET {column} = ?2
                 WHERE guild_id = ?1 AND {column} IS NULL"
            ),
            params![guild_id, now],
        )?;
        if changed != 0 {
            let source = lifecycle_source(&transaction, guild_id)?;
            add_daily(&transaction, now, &source, event)?;
        }
        transaction.commit()?;
        Ok(())
    }
}

/// Records an authenticated, provider-idempotent Top.gg delivery without retaining a user or
/// server identifier in the long-lived growth series. The caller keeps this write in the same
/// transaction as the provider event claim so retries can never inflate the aggregate.
pub(crate) fn add_topgg_vote_daily(
    transaction: &rusqlite::Transaction<'_>,
    now: i64,
) -> Result<(), StoreError> {
    add_daily(transaction, now, "topgg", GrowthEvent::Vote)
}

fn ensure_lifecycle(
    transaction: &rusqlite::Transaction<'_>,
    guild_id: &str,
    now: i64,
) -> Result<(), StoreError> {
    transaction.execute(
        "INSERT OR IGNORE INTO guild_growth_lifecycle
           (guild_id, product, first_joined_at, last_joined_at, install_source)
         VALUES (?1, ?2, ?3, ?3, ?4)",
        params![guild_id, PRODUCT, now, UNKNOWN_SOURCE],
    )?;
    Ok(())
}

fn lifecycle_source(
    transaction: &rusqlite::Transaction<'_>,
    guild_id: &str,
) -> Result<String, StoreError> {
    transaction
        .query_row(
            "SELECT install_source FROM guild_growth_lifecycle WHERE guild_id = ?1",
            [guild_id],
            |row| row.get(0),
        )
        .map_err(StoreError::from)
}

fn add_daily(
    connection: &rusqlite::Connection,
    now: i64,
    source: &str,
    event: GrowthEvent,
) -> Result<(), StoreError> {
    connection.execute(
        "INSERT INTO growth_daily_metric (day, product, source, event, value)
         VALUES (?1, ?2, ?3, ?4, 1)
         ON CONFLICT(day, product, source, event) DO UPDATE SET value = value + 1",
        params![
            utc_day_key_from_unix_millis(now),
            PRODUCT,
            source,
            event.as_database(),
        ],
    )?;
    Ok(())
}

fn record_due_retention(
    transaction: &rusqlite::Transaction<'_>,
    guild_id: &str,
    now: i64,
) -> Result<(), StoreError> {
    let (first_value_at, source): (Option<i64>, String) = transaction.query_row(
        "SELECT first_value_at, install_source
         FROM guild_growth_lifecycle WHERE guild_id = ?1",
        [guild_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let Some(first_value_at) = first_value_at else {
        return Ok(());
    };
    if source == BASELINE_SOURCE {
        return Ok(());
    }

    for (window_days, event) in [
        (7_i64, GrowthEvent::RetainedW7),
        (30_i64, GrowthEvent::RetainedW30),
    ] {
        let threshold = first_value_at.saturating_add(window_days.saturating_mul(DAY_MS));
        if now < threshold {
            continue;
        }
        let inserted = transaction.execute(
            "INSERT OR IGNORE INTO guild_growth_retention_record (guild_id, window_days)
             VALUES (?1, ?2)",
            params![guild_id, window_days],
        )?;
        if inserted != 0 {
            add_daily(transaction, now, &source, event)?;
        }
    }
    Ok(())
}

fn count_eligible(
    connection: &rusqlite::Connection,
    now: i64,
    days: i64,
) -> Result<i64, StoreError> {
    connection
        .query_row(
            "SELECT COALESCE(SUM(value), 0) FROM growth_daily_metric
             WHERE product = ?1 AND event = 'first_value' AND source <> ?2 AND day <= ?3",
            params![
                PRODUCT,
                BASELINE_SOURCE,
                utc_day_key_from_unix_millis(now.saturating_sub(days.saturating_mul(DAY_MS)))
            ],
            |row| row.get(0),
        )
        .map_err(StoreError::from)
}

fn validate_guild_id(guild_id: &str) -> Result<(), StoreError> {
    if guild_id.trim().is_empty() {
        Err(StoreError::InvalidGuildId)
    } else {
        Ok(())
    }
}

fn normalize_source(source: Option<&str>) -> Result<String, StoreError> {
    let source = source.unwrap_or(UNKNOWN_SOURCE).trim();
    let valid = !source.is_empty()
        && source.len() <= 48
        && source
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    if valid {
        Ok(source.to_owned())
    } else {
        Err(StoreError::InvalidGrowthSource)
    }
}

fn validate_day(day: &str) -> Result<(), StoreError> {
    let valid = day.len() == 10
        && day.as_bytes().get(4) == Some(&b'-')
        && day.as_bytes().get(7) == Some(&b'-')
        && day
            .bytes()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit());
    if valid {
        Ok(())
    } else {
        Err(StoreError::InvalidOperationalMetricDay(day.to_owned()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 86_400_000;
    const NOW: i64 = 60 * DAY;

    #[test]
    fn records_one_funnel_event_and_one_active_server_per_day() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .record_guild_join("guild", Some("tts-hero"), DAY)
            .expect("join");
        store
            .record_guild_setup_completed("guild", DAY + 1)
            .expect("setup");
        store
            .record_guild_setup_completed("guild", DAY + 2)
            .expect("duplicate setup");
        store
            .record_guild_first_value("guild", DAY + 3)
            .expect("first value");
        store
            .record_guild_activity("guild", DAY + 4)
            .expect("same active day");

        let metrics = store
            .list_growth_daily_metrics("1970-01-02", "1970-01-02")
            .expect("daily metrics");
        assert_eq!(metrics.len(), 1);
        assert_eq!(metrics[0].source, "tts-hero");
        assert_eq!(metrics[0].joins, 1);
        assert_eq!(metrics[0].setup_completed, 1);
        assert_eq!(metrics[0].first_value, 1);
        assert_eq!(metrics[0].active, 1);
    }

    #[test]
    fn departure_is_idempotent_and_rejoin_restores_current_guild_count() {
        let store = SqliteStore::open_in_memory().expect("store");
        store.record_guild_join("guild", None, DAY).expect("join");
        store
            .record_guild_departure("guild", DAY + 1)
            .expect("departure");
        store
            .record_guild_departure("guild", DAY + 2)
            .expect("duplicate departure");
        assert_eq!(store.growth_overview(NOW).expect("overview").leaves, 1);

        store
            .record_guild_join("guild", Some("topgg"), DAY + 3)
            .expect("rejoin");
        let overview = store.growth_overview(NOW).expect("overview");
        assert_eq!(overview.current_guilds, 1);
        assert_eq!(overview.joins, 2);
    }

    #[test]
    fn retention_excludes_immature_cohorts_and_rejects_invalid_sources() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(
            store
                .record_guild_join("guild", Some("Top GG"), DAY)
                .is_err()
        );
        store.record_guild_join("guild", None, DAY).expect("join");
        store
            .record_guild_first_value("guild", DAY)
            .expect("first value");
        store
            .record_guild_activity("guild", DAY + 8 * DAY)
            .expect("week activity");
        let overview = store.growth_overview(NOW).expect("overview");
        assert_eq!(overview.eligible_w7, 1);
        assert_eq!(overview.retained_w7, 1);
        assert_eq!(overview.eligible_w30, 1);
        assert_eq!(overview.retained_w30, 0);
    }

    #[test]
    fn retention_outcomes_survive_the_required_guild_identity_purge() {
        let store = SqliteStore::open_in_memory().expect("store");
        let start = 1_800_000_000_000_i64;
        for guild_id in ["week", "month"] {
            store
                .record_guild_join(guild_id, Some("home"), start)
                .expect("join");
            store
                .record_guild_first_value(guild_id, start)
                .expect("activate");
        }
        store
            .record_guild_activity("week", start + 8 * DAY_MS)
            .expect("week return");
        store
            .record_guild_activity("month", start + 31 * DAY_MS)
            .expect("month return");

        let before = store
            .growth_overview(start + 40 * DAY_MS)
            .expect("overview before purge");
        assert_eq!((before.eligible_w7, before.retained_w7), (2, 2));
        assert_eq!((before.eligible_w30, before.retained_w30), (2, 1));

        store.purge_guild_data("week").expect("purge week");
        store.purge_guild_data("month").expect("purge month");
        let after = store
            .growth_overview(start + 40 * DAY_MS)
            .expect("overview after purge");
        assert_eq!((after.eligible_w7, after.retained_w7), (2, 2));
        assert_eq!((after.eligible_w30, after.retained_w30), (2, 1));
        assert_eq!(
            store
                .connection()
                .query_row(
                    "SELECT COUNT(*) FROM guild_growth_retention_record",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("retention identities"),
            0
        );
    }

    #[test]
    fn overview_counts_current_ready_tts_configurations_separately_from_funnel_events() {
        let store = SqliteStore::open_in_memory().expect("store");
        store.record_guild_join("ready", None, DAY).expect("join");
        store
            .update_guild_config(
                "ready",
                crate::GuildConfigPatch {
                    tts_channel_id: Some(Some("channel".into())),
                    autoread: Some(true),
                    ..Default::default()
                },
            )
            .expect("ready config");
        store
            .record_guild_join("not-ready", None, DAY)
            .expect("join");
        store
            .update_guild_config(
                "not-ready",
                crate::GuildConfigPatch {
                    tts_channel_id: Some(Some("channel".into())),
                    ..Default::default()
                },
            )
            .expect("incomplete config");

        let overview = store.growth_overview(NOW).expect("overview");
        assert_eq!(overview.current_guilds, 2);
        assert_eq!(overview.configured_guilds, 1);
    }

    #[test]
    fn baseline_rows_do_not_inflate_acquisition_or_retention() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .record_guild_join("existing", Some(BASELINE_SOURCE), DAY)
            .expect("baseline join");
        store
            .record_guild_setup_completed("existing", DAY + 1)
            .expect("baseline setup");
        store
            .record_guild_first_value("existing", DAY + 2)
            .expect("baseline value");
        store
            .record_guild_activity("existing", DAY + 8 * DAY)
            .expect("baseline activity");

        let overview = store.growth_overview(NOW).expect("overview");
        assert_eq!(overview.current_guilds, 1);
        assert_eq!(overview.baseline_guilds, 1);
        assert_eq!(overview.joins, 0);
        assert_eq!(overview.setup_completed, 0);
        assert_eq!(overview.first_value, 0);
        assert_eq!(overview.eligible_w7, 0);
        assert_eq!(overview.retained_w7, 0);

        let metrics = store
            .list_growth_daily_metrics("1970-01-02", "1970-01-10")
            .expect("daily metrics");
        assert_eq!(metrics.iter().map(|point| point.joins).sum::<i64>(), 0);
        assert_eq!(metrics.iter().map(|point| point.active).sum::<i64>(), 2);
    }

    #[test]
    fn measurement_coverage_preserves_initial_inventory_across_rejoins() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store.growth_measurement_started_on().expect("coverage"),
            None
        );
        store
            .record_guild_join("existing", Some(BASELINE_SOURCE), DAY)
            .expect("baseline join");
        store
            .record_guild_join("new", Some("tts-hero"), 2 * DAY)
            .expect("new join");
        store
            .record_guild_departure("existing", 3 * DAY)
            .expect("departure");
        store
            .record_guild_join("existing", Some("topgg"), 4 * DAY)
            .expect("rejoin");

        let overview = store.growth_overview(NOW).expect("overview");
        assert_eq!(overview.baseline_guilds, 1);
        assert_eq!(overview.joins, 2);
        assert_eq!(overview.leaves, 1);
        assert_eq!(overview.current_guilds, 2);
        assert_eq!(
            store.growth_measurement_started_on().expect("coverage"),
            Some("1970-01-02".into())
        );
        let recent = store
            .list_growth_daily_metrics("1970-01-05", "1970-01-05")
            .expect("recent window");
        assert_eq!(recent.iter().map(|point| point.joins).sum::<i64>(), 1);
        assert_eq!(
            store
                .growth_overview(NOW)
                .expect("overview")
                .baseline_guilds,
            1
        );
    }

    #[test]
    fn historical_talk_stats_count_current_servers_with_real_use() {
        let store = SqliteStore::open_in_memory().expect("store");
        store.record_guild_join("used", None, DAY).expect("join");
        store
            .connection()
            .execute(
                "INSERT INTO talk_stats (guild_id, user_id, spoken_count) VALUES (?1, ?2, ?3)",
                params!["used", "user", 2],
            )
            .expect("talk stats");
        store.record_guild_join("unused", None, DAY).expect("join");

        let overview = store.growth_overview(NOW).expect("overview");
        assert_eq!(overview.used_guilds, 1);
    }

    #[test]
    fn reauthorising_an_active_baseline_server_does_not_turn_it_into_new_acquisition() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .record_guild_join("existing", Some(BASELINE_SOURCE), DAY)
            .expect("baseline join");
        store
            .set_guild_install_source("existing", "tts-hero", DAY + 1)
            .expect("reauthorise");

        let source: String = store
            .connection()
            .query_row(
                "SELECT install_source FROM guild_growth_lifecycle WHERE guild_id='existing'",
                [],
                |row| row.get(0),
            )
            .expect("source");
        assert_eq!(source, BASELINE_SOURCE);
    }
}
