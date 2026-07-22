use rusqlite::params;

use crate::{SqliteStore, StoreError};

/// Bounds per-message moderation work and unbounded guild database growth.
pub const MAX_BLOCKWORDS: i64 = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddBlockwordResult {
    Ok,
    Limit,
}

impl SqliteStore {
    pub fn get_blocklist(&self, guild_id: &str) -> Result<Vec<String>, StoreError> {
        let mut statement = self
            .connection()
            .prepare("SELECT word FROM blocklist WHERE guild_id = ?1 ORDER BY word ASC")?;
        let rows = statement.query_map([guild_id], |row| row.get(0))?;
        rows.collect::<Result<_, _>>().map_err(StoreError::from)
    }

    pub fn add_blockword(
        &self,
        guild_id: &str,
        word: &str,
    ) -> Result<AddBlockwordResult, StoreError> {
        let count: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM blocklist WHERE guild_id = ?1",
            [guild_id],
            |row| row.get(0),
        )?;
        if count >= MAX_BLOCKWORDS {
            return Ok(AddBlockwordResult::Limit);
        }
        self.connection().execute(
            "INSERT INTO blocklist (guild_id, word) VALUES (?1, ?2)
             ON CONFLICT(guild_id, word) DO NOTHING",
            params![guild_id, word],
        )?;
        Ok(AddBlockwordResult::Ok)
    }

    pub fn remove_blockword(&self, guild_id: &str, word: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM blocklist WHERE guild_id = ?1 AND word = ?2",
            params![guild_id, word],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocklist_is_sorted_scoped_and_duplicate_safe() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store.add_blockword("a", "zeta").expect("add"),
            AddBlockwordResult::Ok
        );
        assert_eq!(
            store.add_blockword("a", "alpha").expect("add"),
            AddBlockwordResult::Ok
        );
        assert_eq!(
            store.add_blockword("a", "alpha").expect("duplicate"),
            AddBlockwordResult::Ok
        );
        assert_eq!(
            store.get_blocklist("a").expect("list"),
            vec!["alpha", "zeta"]
        );
        assert!(store.get_blocklist("b").expect("other").is_empty());
        store.remove_blockword("a", "alpha").expect("remove");
        assert_eq!(store.get_blocklist("a").expect("list"), vec!["zeta"]);
    }
}
