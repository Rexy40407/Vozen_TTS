//! Per-text-channel overrides. `None` means inherit the guild setting.

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError, UserEngine};

pub const MAX_CHANNEL_PROFILES_PER_GUILD: i64 = 25;

#[derive(Debug, Clone, PartialEq)]
pub struct ChannelProfile {
    pub guild_id: String,
    pub channel_id: String,
    pub auto_read: Option<bool>,
    pub translation_enabled: Option<bool>,
    pub default_voice: Option<String>,
    pub engine: Option<UserEngine>,
    pub speed: Option<f64>,
    pub max_chars: Option<i64>,
    pub read_bots: Option<bool>,
    pub voice_channel_id: Option<String>,
    pub locale: Option<String>,
    pub effect: Option<String>,
}

/// The complete nullable state stored for one channel profile.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ChannelProfilePatch {
    pub auto_read: Option<bool>,
    pub translation_enabled: Option<bool>,
    pub default_voice: Option<String>,
    pub engine: Option<UserEngine>,
    pub speed: Option<f64>,
    pub max_chars: Option<i64>,
    pub read_bots: Option<bool>,
    pub voice_channel_id: Option<String>,
    pub locale: Option<String>,
    pub effect: Option<String>,
}

impl From<&ChannelProfile> for ChannelProfilePatch {
    fn from(profile: &ChannelProfile) -> Self {
        Self {
            auto_read: profile.auto_read,
            translation_enabled: profile.translation_enabled,
            default_voice: profile.default_voice.clone(),
            engine: profile.engine,
            speed: profile.speed,
            max_chars: profile.max_chars,
            read_bots: profile.read_bots,
            voice_channel_id: profile.voice_channel_id.clone(),
            locale: profile.locale.clone(),
            effect: profile.effect.clone(),
        }
    }
}

impl SqliteStore {
    pub fn list_channel_profiles(&self, guild_id: &str) -> Result<Vec<ChannelProfile>, StoreError> {
        let mut statement = self.connection().prepare(
            "SELECT guild_id, channel_id, auto_read, translation_enabled, default_voice,
                    engine, speed, max_chars, read_bots, voice_channel_id, locale, effect
             FROM channel_profile WHERE guild_id = ?1 ORDER BY channel_id",
        )?;
        let rows = statement.query_map([guild_id], row_to_profile)?;
        rows.collect::<Result<_, _>>().map_err(StoreError::from)
    }

    pub fn channel_profile(
        &self,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<Option<ChannelProfile>, StoreError> {
        self.connection()
            .query_row(
                "SELECT guild_id, channel_id, auto_read, translation_enabled, default_voice,
                        engine, speed, max_chars, read_bots, voice_channel_id, locale, effect
                 FROM channel_profile WHERE guild_id = ?1 AND channel_id = ?2",
                params![guild_id, channel_id],
                row_to_profile,
            )
            .optional()
            .map_err(StoreError::from)
    }

    /// Returns false at the profile cap rather than silently creating unbounded state.
    pub fn save_channel_profile(
        &self,
        guild_id: &str,
        channel_id: &str,
        patch: &ChannelProfilePatch,
    ) -> Result<bool, StoreError> {
        let exists: bool = self.channel_profile(guild_id, channel_id)?.is_some();
        if !exists {
            let count: i64 = self.connection().query_row(
                "SELECT COUNT(*) FROM channel_profile WHERE guild_id = ?1",
                [guild_id],
                |row| row.get(0),
            )?;
            if count >= MAX_CHANNEL_PROFILES_PER_GUILD {
                return Ok(false);
            }
        }
        self.connection().execute(
            "INSERT INTO channel_profile (
               guild_id, channel_id, auto_read, translation_enabled, default_voice,
               engine, speed, max_chars, read_bots, voice_channel_id, locale, effect
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(guild_id, channel_id) DO UPDATE SET
               auto_read = excluded.auto_read,
               translation_enabled = excluded.translation_enabled,
               default_voice = excluded.default_voice,
               engine = excluded.engine,
               speed = excluded.speed,
               max_chars = excluded.max_chars,
               read_bots = excluded.read_bots,
               voice_channel_id = excluded.voice_channel_id,
               locale = excluded.locale,
               effect = excluded.effect",
            params![
                guild_id,
                channel_id,
                patch.auto_read.map(i64::from),
                patch.translation_enabled.map(i64::from),
                empty_to_null(&patch.default_voice),
                patch.engine.map(UserEngine::as_database),
                patch.speed,
                patch.max_chars,
                patch.read_bots.map(i64::from),
                empty_to_null(&patch.voice_channel_id),
                empty_to_null(&patch.locale),
                empty_to_null(&patch.effect),
            ],
        )?;
        Ok(true)
    }

    pub fn delete_channel_profile(
        &self,
        guild_id: &str,
        channel_id: &str,
    ) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM channel_profile WHERE guild_id = ?1 AND channel_id = ?2",
            params![guild_id, channel_id],
        )?;
        Ok(())
    }
}

fn row_to_profile(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChannelProfile> {
    let engine: Option<String> = row.get(5)?;
    Ok(ChannelProfile {
        guild_id: row.get(0)?,
        channel_id: row.get(1)?,
        auto_read: nullable_bool(row.get(2)?),
        translation_enabled: nullable_bool(row.get(3)?),
        default_voice: nullable_non_empty(row.get(4)?),
        engine: engine.and_then(known_engine),
        speed: row.get(6)?,
        max_chars: row.get(7)?,
        read_bots: nullable_bool(row.get(8)?),
        voice_channel_id: nullable_non_empty(row.get(9)?),
        locale: nullable_non_empty(row.get(10)?),
        effect: nullable_non_empty(row.get(11)?),
    })
}

fn nullable_bool(value: Option<i64>) -> Option<bool> {
    value.map(|value| value == 1)
}

fn nullable_non_empty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.is_empty())
}

fn empty_to_null(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|value| !value.is_empty())
}

fn known_engine(value: String) -> Option<UserEngine> {
    match value.as_str() {
        "google" | "piper" | "kokoro" | "gcloud" => Some(UserEngine::from_database(&value)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_are_scoped_nullable_and_replaceable() {
        let store = SqliteStore::open_in_memory().expect("store");
        let first = ChannelProfilePatch {
            auto_read: Some(true),
            default_voice: Some("pt_PT-google-medium".into()),
            engine: Some(UserEngine::Piper),
            speed: Some(1.2),
            ..ChannelProfilePatch::default()
        };
        assert!(
            store
                .save_channel_profile("guild", "channel", &first)
                .expect("save")
        );
        let saved = store
            .channel_profile("guild", "channel")
            .expect("get")
            .expect("row");
        assert_eq!(saved.auto_read, Some(true));
        assert_eq!(saved.engine, Some(UserEngine::Piper));
        assert!(
            store
                .list_channel_profiles("other")
                .expect("other")
                .is_empty()
        );

        let inherited = ChannelProfilePatch::default();
        assert!(
            store
                .save_channel_profile("guild", "channel", &inherited)
                .expect("replace")
        );
        let saved = store
            .channel_profile("guild", "channel")
            .expect("get")
            .expect("row");
        assert_eq!(ChannelProfilePatch::from(&saved), inherited);
        store
            .delete_channel_profile("guild", "channel")
            .expect("delete");
        assert!(
            store
                .channel_profile("guild", "channel")
                .expect("get")
                .is_none()
        );
    }

    #[test]
    fn cap_and_unknown_historical_engines_fail_safe() {
        let store = SqliteStore::open_in_memory().expect("store");
        for index in 0..MAX_CHANNEL_PROFILES_PER_GUILD {
            assert!(
                store
                    .save_channel_profile(
                        "guild",
                        &format!("c{index}"),
                        &ChannelProfilePatch::default()
                    )
                    .expect("save")
            );
        }
        assert!(
            !store
                .save_channel_profile("guild", "excess", &ChannelProfilePatch::default())
                .expect("capped")
        );
        store.connection().execute(
            "UPDATE channel_profile SET engine = 'retired' WHERE guild_id = 'guild' AND channel_id = 'c0'",
            [],
        ).expect("legacy value");
        assert_eq!(
            store
                .channel_profile("guild", "c0")
                .expect("get")
                .expect("row")
                .engine,
            None
        );
    }
}
