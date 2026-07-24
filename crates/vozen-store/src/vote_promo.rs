//! Durable rotation state for activity-driven community reminders.
//!
//! The Node runtime uses this table to coordinate the vote/support slot across restarts and
//! workers. Rust keeps the same atomic update semantics so a migration cannot send duplicate
//! notices when two gateway paths observe the same eligible message.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

/// The shared slot is limited to one notice in any rolling 24-hour window.
pub const PROMO_SLOT_COOLDOWN_MS: i64 = 24 * 60 * 60 * 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommunityPromoKind {
    Vote,
    Support,
}

impl CommunityPromoKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Vote => "vote",
            Self::Support => "support",
        }
    }

    fn from_db(value: String) -> Option<Self> {
        match value.as_str() {
            "vote" => Some(Self::Vote),
            "support" => Some(Self::Support),
            _ => None,
        }
    }
}

impl SqliteStore {
    /// Returns the last durable post time, or zero for a guild with no reminder yet.
    pub fn vote_promo_last_post_at(&self, guild_id: &str) -> Result<i64, StoreError> {
        self.connection()
            .query_row(
                "SELECT last_post_at FROM vote_promo_state WHERE guild_id = ?1",
                [guild_id],
                |row| row.get(0),
            )
            .optional()
            .map(|value| value.unwrap_or(0))
            .map_err(StoreError::from)
    }

    /// Atomically reserves the next rotating notice.
    ///
    /// The first reservation is `Vote`; subsequent reservations alternate, matching the Node
    /// implementation. `None` means another worker owns the slot or the cooldown is active.
    pub fn reserve_vote_promo(
        &self,
        guild_id: &str,
        now_ms: i64,
    ) -> Result<Option<CommunityPromoKind>, StoreError> {
        let transaction = self.connection().unchecked_transaction()?;
        let existing = transaction
            .query_row(
                "UPDATE vote_promo_state
                 SET last_post_at = ?1,
                     last_kind = CASE last_kind WHEN 'vote' THEN 'support' ELSE 'vote' END
                 WHERE guild_id = ?2 AND last_post_at <= ?3
                 RETURNING last_kind",
                params![
                    now_ms,
                    guild_id,
                    now_ms.saturating_sub(PROMO_SLOT_COOLDOWN_MS)
                ],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        let kind = if let Some(raw) = existing {
            CommunityPromoKind::from_db(raw)
        } else {
            let inserted = transaction.execute(
                "INSERT OR IGNORE INTO vote_promo_state (guild_id, last_post_at, last_kind)
                 VALUES (?1, ?2, ?3)",
                params![guild_id, now_ms, CommunityPromoKind::Vote.as_str()],
            )?;
            (inserted == 1).then_some(CommunityPromoKind::Vote)
        };
        transaction.commit()?;
        Ok(kind)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_reservation_is_vote_and_next_one_alternates() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store
                .reserve_vote_promo("guild", PROMO_SLOT_COOLDOWN_MS + 1)
                .expect("reserve"),
            Some(CommunityPromoKind::Vote)
        );
        assert_eq!(
            store
                .reserve_vote_promo("guild", PROMO_SLOT_COOLDOWN_MS + 2)
                .expect("cooldown"),
            None
        );
        assert_eq!(
            store
                .reserve_vote_promo("guild", PROMO_SLOT_COOLDOWN_MS * 2 + 1)
                .expect("reserve"),
            Some(CommunityPromoKind::Support)
        );
    }

    #[test]
    fn reservation_is_idempotent_when_two_paths_try_same_slot() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store.reserve_vote_promo("guild", 1).expect("reserve"),
            Some(CommunityPromoKind::Vote)
        );
        assert_eq!(store.vote_promo_last_post_at("guild").expect("read"), 1);
        assert_eq!(store.reserve_vote_promo("guild", 2).expect("reserve"), None);
    }
}
