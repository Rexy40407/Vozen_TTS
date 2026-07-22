use rusqlite::params;

use crate::{SqliteStore, StoreError};

impl SqliteStore {
    /// Automatic language detection is opt-in per guild/user. Missing row is deliberately OFF.
    pub fn is_detection_on(&self, guild_id: &str, user_id: &str) -> Result<bool, StoreError> {
        let count: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM tts_lang_detect_on WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn set_detection_on(
        &self,
        guild_id: &str,
        user_id: &str,
        enabled: bool,
    ) -> Result<(), StoreError> {
        if enabled {
            self.connection().execute(
                "INSERT INTO tts_lang_detect_on (guild_id, user_id) VALUES (?1, ?2)
                 ON CONFLICT(guild_id, user_id) DO NOTHING",
                params![guild_id, user_id],
            )?;
        } else {
            self.connection().execute(
                "DELETE FROM tts_lang_detect_on WHERE guild_id = ?1 AND user_id = ?2",
                params![guild_id, user_id],
            )?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::SqliteStore;

    #[test]
    fn detection_is_off_by_default_and_toggle_is_idempotent() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert!(!store.is_detection_on("guild", "user").expect("default"));
        store
            .set_detection_on("guild", "user", true)
            .expect("enable");
        store
            .set_detection_on("guild", "user", true)
            .expect("enable twice");
        assert!(store.is_detection_on("guild", "user").expect("enabled"));
        store
            .set_detection_on("guild", "user", false)
            .expect("disable");
        assert!(!store.is_detection_on("guild", "user").expect("disabled"));
    }
}
