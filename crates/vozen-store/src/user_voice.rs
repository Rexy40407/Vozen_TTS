use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

pub const MAX_RECENT_VOICES: usize = 10;

/// User-selected synthesis engine. Unknown historical database values deliberately follow the
/// operator-configured default (`Google`) instead of making a message unspeakable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UserEngine {
    Google,
    Piper,
    Kokoro,
    Gcloud,
}

impl UserEngine {
    pub(crate) fn from_database(value: &str) -> Self {
        match value {
            "piper" => Self::Piper,
            "kokoro" => Self::Kokoro,
            "gcloud" => Self::Gcloud,
            _ => Self::Google,
        }
    }

    pub(crate) fn as_database(self) -> &'static str {
        match self {
            Self::Google => "google",
            Self::Piper => "piper",
            Self::Kokoro => "kokoro",
            Self::Gcloud => "gcloud",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct UserVoice {
    pub model: String,
    pub speed: f64,
    pub engine: UserEngine,
}

impl SqliteStore {
    pub fn get_user_voice(
        &self,
        guild_id: &str,
        user_id: &str,
    ) -> Result<Option<UserVoice>, StoreError> {
        self.connection()
            .query_row(
                "SELECT voice_model, speed, engine FROM user_voice WHERE guild_id = ?1 AND user_id = ?2",
                params![guild_id, user_id],
                |row| {
                    let engine: String = row.get(2)?;
                    Ok(UserVoice {
                        model: row.get(0)?,
                        speed: row.get(1)?,
                        engine: UserEngine::from_database(&engine),
                    })
                },
            )
            .optional()
            .map_err(StoreError::from)
    }

    pub fn set_user_voice(
        &self,
        guild_id: &str,
        user_id: &str,
        voice: &UserVoice,
    ) -> Result<(), StoreError> {
        self.connection().execute(
            "INSERT INTO user_voice (guild_id, user_id, voice_model, speed, engine)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(guild_id, user_id) DO UPDATE SET
               voice_model = excluded.voice_model, speed = excluded.speed, engine = excluded.engine",
            params![guild_id, user_id, voice.model, voice.speed, voice.engine.as_database()],
        )?;
        Ok(())
    }

    pub fn reset_user_voice(&self, guild_id: &str, user_id: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM user_voice WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
        )?;
        Ok(())
    }

    /// Mirrors Node's `recordRecentVoice`: updating an existing model refreshes its position,
    /// and the per-user library never grows beyond the ten most recently selected voices.
    /// Invalid historical/operator values are ignored just as they are by the Node helper; they
    /// must not undo a valid `/voice set` write.
    pub fn record_recent_voice(
        &self,
        user_id: &str,
        model: &str,
        used_at: i64,
    ) -> Result<(), StoreError> {
        if !valid_voice_library_value(user_id) || !valid_voice_library_value(model) {
            return Ok(());
        }
        let transaction = self.connection().unchecked_transaction()?;
        transaction.execute(
            "INSERT INTO user_voice_recent (user_id, voice_model, used_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(user_id, voice_model) DO UPDATE SET used_at = excluded.used_at",
            params![user_id, model, used_at],
        )?;
        transaction.execute(
            "DELETE FROM user_voice_recent WHERE user_id = ?1 AND voice_model NOT IN (
                 SELECT voice_model FROM user_voice_recent WHERE user_id = ?1
                 ORDER BY used_at DESC, voice_model ASC LIMIT ?2
             )",
            params![user_id, MAX_RECENT_VOICES as i64],
        )?;
        transaction.commit()?;
        Ok(())
    }

    /// Returns the same bounded, deterministic recent-voice list used by the Node voice library.
    /// Reading it through the store keeps Discord services independent of the SQLite connection.
    pub fn list_recent_voices(&self, user_id: &str) -> Result<Vec<String>, StoreError> {
        let mut statement = self.connection().prepare(
            "SELECT voice_model FROM user_voice_recent WHERE user_id = ?1
             ORDER BY used_at DESC, voice_model ASC LIMIT ?2",
        )?;
        let models = statement
            .query_map(params![user_id, MAX_RECENT_VOICES as i64], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(models)
    }
}

fn valid_voice_library_value(value: &str) -> bool {
    !value.trim().is_empty() && value.len() <= 100
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persists_upserts_and_resets_a_user_voice() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(store.get_user_voice("guild", "user").expect("read"), None);

        let first = UserVoice {
            model: "pt_PT-google-medium".to_owned(),
            speed: 1.15,
            engine: UserEngine::Piper,
        };
        store
            .set_user_voice("guild", "user", &first)
            .expect("insert");
        assert_eq!(
            store.get_user_voice("guild", "user").expect("read"),
            Some(first)
        );

        let replacement = UserVoice {
            model: "en_US-amy-medium".to_owned(),
            speed: 0.9,
            engine: UserEngine::Kokoro,
        };
        store
            .set_user_voice("guild", "user", &replacement)
            .expect("upsert");
        assert_eq!(
            store.get_user_voice("guild", "user").expect("read"),
            Some(replacement)
        );
        store.reset_user_voice("guild", "user").expect("delete");
        assert_eq!(store.get_user_voice("guild", "user").expect("read"), None);
    }

    #[test]
    fn unknown_legacy_engine_uses_the_safe_default_route() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .connection()
            .execute(
                "INSERT INTO user_voice (guild_id, user_id, voice_model, speed, engine)
                 VALUES ('guild', 'user', 'en_US-amy-medium', 1.0, 'unknown')",
                [],
            )
            .expect("legacy row");
        assert_eq!(
            store
                .get_user_voice("guild", "user")
                .expect("read")
                .expect("voice")
                .engine,
            UserEngine::Google
        );
    }

    #[test]
    fn recent_voice_library_is_bounded_and_refreshes_existing_models() {
        let store = SqliteStore::open_in_memory().expect("store");
        for index in 0..=MAX_RECENT_VOICES {
            store
                .record_recent_voice("user", &format!("en_US-voice{index}-medium"), index as i64)
                .expect("recent voice");
        }
        let count: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM user_voice_recent WHERE user_id = 'user'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(count, MAX_RECENT_VOICES as i64);
        assert!(store
            .connection()
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM user_voice_recent WHERE user_id = 'user' AND voice_model = 'en_US-voice0-medium')",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("oldest")
            == 0);

        store
            .record_recent_voice("user", "en_US-voice1-medium", 100)
            .expect("refresh voice");
        assert_eq!(
            store.list_recent_voices("user").expect("recent voices")[0],
            "en_US-voice1-medium"
        );
    }
}
