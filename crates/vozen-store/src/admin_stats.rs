//! Read-only aggregate queries used by the owner console.

use rusqlite::params;

use crate::{SqliteStore, StoreError, TalkRow};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminGuildStats {
    pub messages: i64,
    pub speakers: i64,
    pub top_speakers: Vec<TalkRow>,
    pub streak: i64,
    pub best_streak: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminTopTalkerRow {
    pub user_id: String,
    pub total: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuildGameStats {
    pub points: i64,
    pub wins: i64,
    pub players: i64,
    pub top_players: Vec<GuildGamePlayerRow>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuildGamePlayerRow {
    pub user_id: String,
    pub points: i64,
    pub wins: i64,
}

impl SqliteStore {
    /// Returns only existing aggregate counters; no message content is read or collected.
    pub fn admin_guild_stats(
        &self,
        guild_id: &str,
        local_day: &str,
        limit: usize,
    ) -> Result<AdminGuildStats, StoreError> {
        let (messages, speakers) = self.connection().query_row(
            "SELECT COALESCE(SUM(spoken_count), 0), COUNT(*) FROM talk_stats WHERE guild_id = ?1",
            [guild_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let top_speakers = self.top_speakers(guild_id, local_day, limit)?;
        let streak = self.guild_talk_streak(guild_id, local_day)?;
        Ok(AdminGuildStats {
            messages,
            speakers,
            top_speakers,
            streak: streak.streak,
            best_streak: streak.best_streak,
        })
    }

    pub fn admin_top_talkers(&self, limit: usize) -> Result<Vec<AdminTopTalkerRow>, StoreError> {
        let mut statement = self.connection().prepare(
            "SELECT user_id, SUM(spoken_count) AS total FROM talk_stats
             GROUP BY user_id ORDER BY total DESC, user_id ASC LIMIT ?1",
        )?;
        statement
            .query_map(params![limit as i64], |row| {
                Ok(AdminTopTalkerRow {
                    user_id: row.get(0)?,
                    total: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(StoreError::from)
    }

    /// Returns only the existing game score aggregates for a guild. No game content is read.
    pub fn guild_game_stats(
        &self,
        guild_id: &str,
        limit: usize,
    ) -> Result<GuildGameStats, StoreError> {
        let (points, wins, players) = self.connection().query_row(
            "SELECT COALESCE(SUM(points), 0), COALESCE(SUM(wins), 0), COUNT(*)
             FROM game_score WHERE guild_id = ?1",
            [guild_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        let mut statement = self.connection().prepare(
            "SELECT user_id, points, wins FROM game_score
             WHERE guild_id = ?1 ORDER BY points DESC, wins DESC, user_id ASC LIMIT ?2",
        )?;
        let top_players = statement
            .query_map(params![guild_id, limit as i64], |row| {
                Ok(GuildGamePlayerRow {
                    user_id: row.get(0)?,
                    points: row.get(1)?,
                    wins: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(GuildGameStats {
            points,
            wins,
            players,
            top_players,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregates_guild_and_global_talkers_without_content() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .bump_talk("guild-a", "u1", "2026-07-23")
            .expect("talk");
        store
            .bump_talk("guild-a", "u1", "2026-07-23")
            .expect("talk");
        store
            .bump_talk("guild-a", "u2", "2026-07-23")
            .expect("talk");
        store
            .bump_talk("guild-b", "u2", "2026-07-23")
            .expect("talk");
        let stats = store
            .admin_guild_stats("guild-a", "2026-07-23", 5)
            .expect("stats");
        assert_eq!(stats.messages, 3);
        assert_eq!(stats.speakers, 2);
        assert_eq!(stats.top_speakers[0].user_id, "u1");
        assert_eq!(store.admin_top_talkers(2).expect("top")[0].user_id, "u1");
    }

    #[test]
    fn aggregates_game_scores_only_inside_the_requested_guild() {
        let store = SqliteStore::open_in_memory().expect("store");
        store.connection().execute(
            "INSERT INTO game_score (guild_id, user_id, points, wins) VALUES ('guild-a', 'u1', 10, 2), ('guild-a', 'u2', 5, 1), ('guild-b', 'u3', 99, 9)",
            [],
        ).expect("scores");
        let stats = store.guild_game_stats("guild-a", 5).expect("game stats");
        assert_eq!((stats.points, stats.wins, stats.players), (15, 3, 2));
        assert_eq!(stats.top_players[0].user_id, "u1");
    }
}
