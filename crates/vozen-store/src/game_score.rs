//! Durable game-score writes shared by the Rust game runtime.
//!
//! The Node manager persists one match as a single transaction: points are accumulated for every
//! player and exactly one win is awarded to the first player with the highest positive score.
//! Keeping that rule here prevents a future Rust game from partially writing a finished match.

use rusqlite::params;

use crate::{SqliteStore, StoreError};

impl SqliteStore {
    /// Persists one completed match atomically.
    ///
    /// `points` is ordered by insertion order. That order is used only to resolve an exact tie,
    /// matching the JavaScript `Map` traversal in `persistGameScores`. A zero-point match is a
    /// no-op and does not create leaderboard rows.
    pub fn persist_game_scores(
        &self,
        guild_id: &str,
        points: &[(String, i64)],
    ) -> Result<(), StoreError> {
        if points.is_empty() {
            return Ok(());
        }
        let transaction = self.connection().unchecked_transaction()?;
        let mut top_user: Option<&str> = None;
        let mut top_points = 0_i64;
        for (user_id, value) in points {
            if *value != 0 {
                transaction.execute(
                    "INSERT INTO game_score (guild_id, user_id, points, wins)
                     VALUES (?1, ?2, ?3, 0)
                     ON CONFLICT(guild_id, user_id)
                     DO UPDATE SET points = points + excluded.points",
                    params![guild_id, user_id, value],
                )?;
            }
            if *value > top_points {
                top_points = *value;
                top_user = Some(user_id);
            }
        }
        if let Some(user_id) = top_user {
            transaction.execute(
                "INSERT INTO game_score (guild_id, user_id, points, wins)
                 VALUES (?1, ?2, 0, 1)
                 ON CONFLICT(guild_id, user_id)
                 DO UPDATE SET wins = wins + 1",
                params![guild_id, user_id],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persists_points_and_awards_the_first_positive_highest_score() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .persist_game_scores(
                "guild",
                &[("first".into(), 3), ("winner".into(), 5), ("tie".into(), 5)],
            )
            .expect("scores");
        let rows = store.game_leaderboard("guild", 10).expect("leaderboard");
        assert_eq!(rows[0].user_id, "winner");
        assert_eq!(rows[0].points, 5);
        assert_eq!(rows[0].wins, 1);
        assert_eq!(rows[1].user_id, "tie");
        assert_eq!(rows[1].wins, 0);
    }

    #[test]
    fn zero_point_match_is_a_noop() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .persist_game_scores("guild", &[("player".into(), 0)])
            .expect("scores");
        assert!(
            store
                .game_leaderboard("guild", 10)
                .expect("leaderboard")
                .is_empty()
        );
    }
}
