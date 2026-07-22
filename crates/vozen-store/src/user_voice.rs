use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

/// User-selected synthesis engine. Unknown historical database values deliberately follow the
/// operator-configured default (`Google`) instead of making a message unspeakable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserEngine {
    Google,
    Piper,
    Kokoro,
    Gcloud,
}

impl UserEngine {
    fn from_database(value: &str) -> Self {
        match value {
            "piper" => Self::Piper,
            "kokoro" => Self::Kokoro,
            "gcloud" => Self::Gcloud,
            _ => Self::Google,
        }
    }

    fn as_database(self) -> &'static str {
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
}
