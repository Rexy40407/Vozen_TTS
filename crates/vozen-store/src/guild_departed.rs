//! Grace-period retention for guild-scoped data after a real Discord departure.
//!
//! The marker is intentionally separate from the purge job: a reconnect or re-invite can clear
//! it before the 30-day window expires, while a failed maintenance pass leaves it retryable.

use rusqlite::params;

use crate::{SqliteStore, StoreError};

pub const DEPARTURE_GRACE_MS: i64 = 30 * 24 * 60 * 60 * 1_000;

impl SqliteStore {
    pub fn mark_guild_departed(&self, guild_id: &str, left_at: i64) -> Result<(), StoreError> {
        validate_guild_id(guild_id)?;
        self.connection().execute(
            "INSERT INTO guild_departed (guild_id, left_at) VALUES (?1, ?2)
             ON CONFLICT(guild_id) DO UPDATE SET left_at = excluded.left_at",
            params![guild_id, left_at],
        )?;
        Ok(())
    }

    pub fn unmark_guild_departed(&self, guild_id: &str) -> Result<(), StoreError> {
        validate_guild_id(guild_id)?;
        self.connection()
            .execute("DELETE FROM guild_departed WHERE guild_id = ?1", [guild_id])?;
        Ok(())
    }

    pub fn purge_departed_guilds(
        &self,
        now: i64,
        grace_ms: i64,
    ) -> Result<Vec<String>, StoreError> {
        if grace_ms < 0 {
            return Err(StoreError::InvalidDepartureGrace);
        }
        let cutoff = now.saturating_sub(grace_ms);
        let mut statement = self
            .connection()
            .prepare("SELECT guild_id FROM guild_departed WHERE left_at <= ?1")?;
        let guild_ids = statement
            .query_map([cutoff], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        drop(statement);

        let mut purged = Vec::with_capacity(guild_ids.len());
        for guild_id in guild_ids {
            self.purge_guild_data(&guild_id)?;
            // `guild_departed` is part of the purge table set; keep this explicit as a safety net
            // if the set is ever narrowed for a compatibility reason.
            self.unmark_guild_departed(&guild_id)?;
            purged.push(guild_id);
        }
        Ok(purged)
    }
}

fn validate_guild_id(guild_id: &str) -> Result<(), StoreError> {
    if guild_id.trim().is_empty() {
        return Err(StoreError::InvalidGuildId);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejoining_clears_the_marker_before_the_grace_window() {
        let store = SqliteStore::open_in_memory().expect("store");
        store.mark_guild_departed("guild", 100).expect("mark");
        store.unmark_guild_departed("guild").expect("unmark");
        assert_eq!(
            store
                .purge_departed_guilds(100 + DEPARTURE_GRACE_MS + 1, DEPARTURE_GRACE_MS)
                .expect("purge"),
            Vec::<String>::new()
        );
    }

    #[test]
    fn expired_departure_purges_guild_data_but_keeps_paid_rights() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .set_nickname("guild", "user", "Rexy")
            .expect("nickname");
        store
            .connection()
            .execute(
                "INSERT INTO premium_guild (guild_id, expires_at) VALUES ('guild', 999)",
                [],
            )
            .expect("paid entitlement");
        store.mark_guild_departed("guild", 100).expect("mark");

        assert_eq!(
            store
                .purge_departed_guilds(100 + DEPARTURE_GRACE_MS, DEPARTURE_GRACE_MS)
                .expect("purge"),
            vec!["guild".to_owned()]
        );
        assert_eq!(store.nickname("guild", "user").expect("nickname"), None);
        let paid: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM premium_guild WHERE guild_id = 'guild'",
                [],
                |row| row.get(0),
            )
            .expect("paid count");
        assert_eq!(paid, 1);
    }
}
