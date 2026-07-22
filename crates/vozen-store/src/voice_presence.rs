use rusqlite::params;

use crate::{SqliteStore, StoreError};

/// The last live voice channel for a guild. This is deliberately only a recovery hint: the
/// gateway must still check the channel exists and that the bot can connect before using it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoicePresence {
    pub guild_id: String,
    pub channel_id: String,
    pub updated_at: i64,
}

impl SqliteStore {
    /// Records the live voice channel as soon as a session has joined it. Updating is atomic so
    /// a later join for the same guild cannot leave a stale channel behind.
    pub fn remember_voice_presence(
        &self,
        guild_id: &str,
        channel_id: &str,
        updated_at: i64,
    ) -> Result<(), StoreError> {
        self.connection().execute(
            "INSERT INTO voice_presence (guild_id, channel_id, updated_at) VALUES (?1, ?2, ?3)\n             ON CONFLICT(guild_id) DO UPDATE SET\n               channel_id = excluded.channel_id,\n               updated_at = excluded.updated_at",
            params![guild_id, channel_id, updated_at],
        )?;
        Ok(())
    }

    /// Removes the recovery hint when a session ends normally. It is deliberately idempotent.
    pub fn forget_voice_presence(&self, guild_id: &str) -> Result<(), StoreError> {
        self.connection()
            .execute("DELETE FROM voice_presence WHERE guild_id = ?1", [guild_id])?;
        Ok(())
    }

    /// Lists only the minimal identifiers required to decide a startup recovery plan.
    pub fn voice_presences(&self) -> Result<Vec<VoicePresence>, StoreError> {
        let mut statement = self.connection().prepare(
            "SELECT guild_id, channel_id, updated_at FROM voice_presence ORDER BY guild_id",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(VoicePresence {
                guild_id: row.get(0)?,
                channel_id: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(StoreError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remembers_replaces_and_forgets_voice_presence() {
        let store = SqliteStore::open_in_memory().expect("open store");
        store
            .remember_voice_presence("guild-b", "channel-old", 10)
            .expect("record first channel");
        store
            .remember_voice_presence("guild-b", "channel-new", 20)
            .expect("replace channel");
        store
            .remember_voice_presence("guild-a", "channel-a", 30)
            .expect("record another guild");

        assert_eq!(
            store.voice_presences().expect("list presences"),
            vec![
                VoicePresence {
                    guild_id: "guild-a".into(),
                    channel_id: "channel-a".into(),
                    updated_at: 30,
                },
                VoicePresence {
                    guild_id: "guild-b".into(),
                    channel_id: "channel-new".into(),
                    updated_at: 20,
                },
            ]
        );

        store
            .forget_voice_presence("guild-b")
            .expect("forget present guild");
        store
            .forget_voice_presence("guild-b")
            .expect("forget absent guild is safe");
        assert_eq!(store.voice_presences().expect("list after forget").len(), 1);
    }
}
