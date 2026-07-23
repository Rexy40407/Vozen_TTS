//! Per-user, per-guild consent for live speech transcription.
//!
//! A row exists only after an explicit user action. The timestamp is evidence of that first
//! grant and is deliberately preserved across repeated button presses.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SttConsent {
    pub user_id: String,
    pub guild_id: String,
    pub consent_at: i64,
}

impl SqliteStore {
    pub fn has_stt_consent(&self, user_id: &str, guild_id: &str) -> Result<bool, StoreError> {
        validate_identity(user_id, guild_id)?;
        self.connection()
            .query_row(
                "SELECT EXISTS(
                    SELECT 1 FROM stt_consent WHERE user_id = ?1 AND guild_id = ?2
                )",
                params![user_id, guild_id],
                |row| row.get(0),
            )
            .map_err(StoreError::from)
    }

    pub fn stt_consent(
        &self,
        user_id: &str,
        guild_id: &str,
    ) -> Result<Option<SttConsent>, StoreError> {
        validate_identity(user_id, guild_id)?;
        self.connection()
            .query_row(
                "SELECT user_id, guild_id, consent_at
                   FROM stt_consent
                  WHERE user_id = ?1 AND guild_id = ?2",
                params![user_id, guild_id],
                |row| {
                    Ok(SttConsent {
                        user_id: row.get(0)?,
                        guild_id: row.get(1)?,
                        consent_at: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(StoreError::from)
    }

    /// Records consent once. Repeated grants preserve the original consent timestamp.
    pub fn grant_stt_consent(
        &self,
        user_id: &str,
        guild_id: &str,
        consent_at: i64,
    ) -> Result<bool, StoreError> {
        validate_identity(user_id, guild_id)?;
        let inserted = self.connection().execute(
            "INSERT INTO stt_consent (user_id, guild_id, consent_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(user_id, guild_id) DO NOTHING",
            params![user_id, guild_id, consent_at],
        )?;
        Ok(inserted == 1)
    }

    pub fn revoke_stt_consent(&self, user_id: &str, guild_id: &str) -> Result<bool, StoreError> {
        validate_identity(user_id, guild_id)?;
        Ok(self.connection().execute(
            "DELETE FROM stt_consent WHERE user_id = ?1 AND guild_id = ?2",
            params![user_id, guild_id],
        )? == 1)
    }
}

fn validate_identity(user_id: &str, guild_id: &str) -> Result<(), StoreError> {
    if user_id.trim().is_empty() || guild_id.trim().is_empty() {
        return Err(StoreError::InvalidSttIdentity);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grant_is_explicit_idempotent_and_preserves_the_first_timestamp() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(!store.has_stt_consent("user", "guild").expect("missing"));
        assert!(store.grant_stt_consent("user", "guild", 10).expect("grant"));
        assert!(
            !store
                .grant_stt_consent("user", "guild", 20)
                .expect("repeat")
        );
        assert_eq!(
            store.stt_consent("user", "guild").expect("read"),
            Some(SttConsent {
                user_id: "user".into(),
                guild_id: "guild".into(),
                consent_at: 10,
            })
        );
    }

    #[test]
    fn revoke_is_idempotent_and_scoped_to_the_guild() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .grant_stt_consent("user", "guild-a", 10)
            .expect("grant a");
        store
            .grant_stt_consent("user", "guild-b", 10)
            .expect("grant b");
        assert!(store.revoke_stt_consent("user", "guild-a").expect("revoke"));
        assert!(!store.revoke_stt_consent("user", "guild-a").expect("repeat"));
        assert!(!store.has_stt_consent("user", "guild-a").expect("a"));
        assert!(store.has_stt_consent("user", "guild-b").expect("b"));
    }
}
