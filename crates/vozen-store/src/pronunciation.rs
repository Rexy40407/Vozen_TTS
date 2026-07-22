use rusqlite::{OptionalExtension, params};
use vozen_core::PronunciationEntry;

use crate::{SqliteStore, StoreError};

pub const USER_PRON_LIMIT_FREE: usize = 3;
pub const USER_PRON_LIMIT_PREMIUM: usize = 50;
pub const SERVER_PRON_LIMIT: usize = 3;
pub const SERVER_PRON_LIMIT_PREMIUM: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddPronunciationResult {
    Ok,
    Limit,
}

impl SqliteStore {
    pub fn get_server_pronunciations(
        &self,
        guild_id: &str,
    ) -> Result<Vec<PronunciationEntry>, StoreError> {
        query_pronunciations(self, "pronunciation", "guild_id", guild_id)
    }

    pub fn get_user_pronunciations(
        &self,
        user_id: &str,
    ) -> Result<Vec<PronunciationEntry>, StoreError> {
        query_pronunciations(self, "pronunciation_user", "user_id", user_id)
    }

    /// Adds or edits a server-wide pronunciation. Editing a term never consumes another slot.
    pub fn add_server_pronunciation(
        &self,
        guild_id: &str,
        term: &str,
        replacement: &str,
        limit: usize,
    ) -> Result<AddPronunciationResult, StoreError> {
        add_pronunciation(
            self,
            "pronunciation",
            "guild_id",
            guild_id,
            term,
            replacement,
            limit,
        )
    }

    /// Adds or edits a personal pronunciation. These entries are global to the Discord user.
    pub fn add_user_pronunciation(
        &self,
        user_id: &str,
        term: &str,
        replacement: &str,
        limit: usize,
    ) -> Result<AddPronunciationResult, StoreError> {
        add_pronunciation(
            self,
            "pronunciation_user",
            "user_id",
            user_id,
            term,
            replacement,
            limit,
        )
    }

    pub fn remove_server_pronunciation(
        &self,
        guild_id: &str,
        term: &str,
    ) -> Result<bool, StoreError> {
        remove_pronunciation(self, "pronunciation", "guild_id", guild_id, term)
    }

    pub fn remove_user_pronunciation(&self, user_id: &str, term: &str) -> Result<bool, StoreError> {
        remove_pronunciation(self, "pronunciation_user", "user_id", user_id, term)
    }
}

fn query_pronunciations(
    store: &SqliteStore,
    table: &str,
    owner_column: &str,
    owner_id: &str,
) -> Result<Vec<PronunciationEntry>, StoreError> {
    let sql = format!(
        "SELECT term, replacement FROM {table} WHERE {owner_column} = ?1 ORDER BY term ASC"
    );
    let mut statement = store.connection().prepare(&sql)?;
    let rows = statement.query_map([owner_id], |row| {
        Ok(PronunciationEntry {
            term: row.get(0)?,
            replacement: row.get(1)?,
        })
    })?;
    rows.collect::<Result<_, _>>().map_err(StoreError::from)
}

fn add_pronunciation(
    store: &SqliteStore,
    table: &str,
    owner_column: &str,
    owner_id: &str,
    term: &str,
    replacement: &str,
    limit: usize,
) -> Result<AddPronunciationResult, StoreError> {
    let exists_sql = format!("SELECT 1 FROM {table} WHERE {owner_column} = ?1 AND term = ?2");
    let exists = store
        .connection()
        .query_row(&exists_sql, params![owner_id, term], |_| Ok(()))
        .optional()?
        .is_some();
    if !exists {
        let count_sql = format!("SELECT COUNT(*) FROM {table} WHERE {owner_column} = ?1");
        let count: i64 = store
            .connection()
            .query_row(&count_sql, [owner_id], |row| row.get(0))?;
        if count >= i64::try_from(limit).expect("pronunciation limit fits SQLite integer") {
            return Ok(AddPronunciationResult::Limit);
        }
    }
    let upsert_sql = format!(
        "INSERT INTO {table} ({owner_column}, term, replacement) VALUES (?1, ?2, ?3)
         ON CONFLICT({owner_column}, term) DO UPDATE SET replacement = excluded.replacement"
    );
    store
        .connection()
        .execute(&upsert_sql, params![owner_id, term, replacement])?;
    Ok(AddPronunciationResult::Ok)
}

fn remove_pronunciation(
    store: &SqliteStore,
    table: &str,
    owner_column: &str,
    owner_id: &str,
    term: &str,
) -> Result<bool, StoreError> {
    let sql = format!("DELETE FROM {table} WHERE {owner_column} = ?1 AND term = ?2");
    Ok(store.connection().execute(&sql, params![owner_id, term])? > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_limit_blocks_only_new_terms_and_edits_remain_allowed() {
        let store = SqliteStore::open_in_memory().expect("store");
        for term in ["a", "b", "c"] {
            assert_eq!(
                store
                    .add_user_pronunciation("user", term, "say", USER_PRON_LIMIT_FREE)
                    .expect("add"),
                AddPronunciationResult::Ok
            );
        }
        assert_eq!(
            store
                .add_user_pronunciation("user", "d", "say", USER_PRON_LIMIT_FREE)
                .expect("limit"),
            AddPronunciationResult::Limit
        );
        assert_eq!(
            store
                .add_user_pronunciation("user", "a", "updated", USER_PRON_LIMIT_FREE)
                .expect("edit"),
            AddPronunciationResult::Ok
        );
        assert_eq!(
            store.get_user_pronunciations("user").expect("list"),
            vec![
                PronunciationEntry {
                    term: "a".into(),
                    replacement: "updated".into()
                },
                PronunciationEntry {
                    term: "b".into(),
                    replacement: "say".into()
                },
                PronunciationEntry {
                    term: "c".into(),
                    replacement: "say".into()
                },
            ]
        );
    }

    #[test]
    fn server_entries_are_scoped_and_removable() {
        let store = SqliteStore::open_in_memory().expect("store");
        assert_eq!(
            store
                .add_server_pronunciation("guild-a", "vozen", "voz en", SERVER_PRON_LIMIT)
                .expect("add"),
            AddPronunciationResult::Ok
        );
        assert!(
            store
                .get_server_pronunciations("guild-b")
                .expect("list")
                .is_empty()
        );
        assert!(
            store
                .remove_server_pronunciation("guild-a", "vozen")
                .expect("remove")
        );
        assert!(
            !store
                .remove_server_pronunciation("guild-a", "vozen")
                .expect("remove twice")
        );
    }
}
