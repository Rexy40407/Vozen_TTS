use rusqlite::params;

use crate::{SqliteStore, StoreError};

impl SqliteStore {
    /// Whether this user has withdrawn consent for automatic TTS in this guild.
    pub fn is_opted_out(&self, guild_id: &str, user_id: &str) -> Result<bool, StoreError> {
        let count: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM tts_optout WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn set_opt_out(&self, guild_id: &str, user_id: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "INSERT INTO tts_optout (guild_id, user_id) VALUES (?1, ?2)
             ON CONFLICT(guild_id, user_id) DO NOTHING",
            params![guild_id, user_id],
        )?;
        Ok(())
    }

    pub fn set_opt_in(&self, guild_id: &str, user_id: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM tts_optout WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::SqliteStore;

    #[test]
    fn opt_out_is_scoped_idempotent_and_reversible() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(!store.is_opted_out("guild", "user").expect("default"));
        store.set_opt_out("guild", "user").expect("out");
        store.set_opt_out("guild", "user").expect("out twice");
        assert!(store.is_opted_out("guild", "user").expect("out"));
        assert!(!store.is_opted_out("other", "user").expect("scoped"));
        store.set_opt_in("guild", "user").expect("in");
        assert!(!store.is_opted_out("guild", "user").expect("in"));
    }
}
