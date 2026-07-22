use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

/// Month/day only. Birth year is deliberately never persisted because Vozen only needs the date
/// to choose a greeting when someone joins a call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Birthday {
    pub month: u8,
    pub day: u8,
}

/// February 29 remains valid: a birthday must not disappear merely because the current year is
/// not a leap year.
pub fn is_valid_birthday(month: u8, day: u8) -> bool {
    const MAX_DAY: [u8; 13] = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    (1..=12).contains(&month) && day >= 1 && day <= MAX_DAY[usize::from(month)]
}

impl SqliteStore {
    pub fn nickname(&self, guild_id: &str, user_id: &str) -> Result<Option<String>, StoreError> {
        self.connection()
            .query_row(
                "SELECT nickname FROM user_nickname WHERE guild_id = ?1 AND user_id = ?2",
                params![guild_id, user_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(StoreError::from)
    }

    pub fn set_nickname(
        &self,
        guild_id: &str,
        user_id: &str,
        nickname: &str,
    ) -> Result<(), StoreError> {
        self.connection().execute(
            "INSERT INTO user_nickname (guild_id, user_id, nickname) VALUES (?1, ?2, ?3)\n             ON CONFLICT(guild_id, user_id) DO UPDATE SET nickname = excluded.nickname",
            params![guild_id, user_id, nickname],
        )?;
        Ok(())
    }

    pub fn clear_nickname(&self, guild_id: &str, user_id: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM user_nickname WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
        )?;
        Ok(())
    }

    pub fn birthday(&self, guild_id: &str, user_id: &str) -> Result<Option<Birthday>, StoreError> {
        let row = self
            .connection()
            .query_row(
                "SELECT month, day FROM user_birthday WHERE guild_id = ?1 AND user_id = ?2",
                params![guild_id, user_id],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()?;
        Ok(row.and_then(|(month, day)| {
            let month = u8::try_from(month).ok()?;
            let day = u8::try_from(day).ok()?;
            is_valid_birthday(month, day).then_some(Birthday { month, day })
        }))
    }

    pub fn set_birthday(
        &self,
        guild_id: &str,
        user_id: &str,
        birthday: Birthday,
    ) -> Result<(), StoreError> {
        if !is_valid_birthday(birthday.month, birthday.day) {
            return Err(StoreError::InvalidBirthday);
        }
        self.connection().execute(
            "INSERT INTO user_birthday (guild_id, user_id, month, day) VALUES (?1, ?2, ?3, ?4)\n             ON CONFLICT(guild_id, user_id) DO UPDATE SET\n               month = excluded.month, day = excluded.day",
            params![guild_id, user_id, birthday.month, birthday.day],
        )?;
        Ok(())
    }

    pub fn clear_birthday(&self, guild_id: &str, user_id: &str) -> Result<(), StoreError> {
        self.connection().execute(
            "DELETE FROM user_birthday WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nickname_and_birthday_keep_the_node_scopes_and_upsert_rules() {
        let store = SqliteStore::open_in_memory().expect("open store");
        store
            .set_nickname("guild", "user", "Rexy")
            .expect("set nickname");
        assert_eq!(
            store.nickname("guild", "user").expect("nickname"),
            Some("Rexy".into())
        );
        assert_eq!(
            store.nickname("other", "user").expect("scoped nickname"),
            None
        );
        store
            .clear_nickname("guild", "user")
            .expect("clear nickname");
        assert_eq!(store.nickname("guild", "user").expect("nickname"), None);

        let leap_day = Birthday { month: 2, day: 29 };
        store
            .set_birthday("guild", "user", leap_day)
            .expect("set birthday");
        assert_eq!(
            store.birthday("guild", "user").expect("birthday"),
            Some(leap_day)
        );
        assert!(matches!(
            store.set_birthday("guild", "user", Birthday { month: 2, day: 30 }),
            Err(StoreError::InvalidBirthday)
        ));
        store
            .clear_birthday("guild", "user")
            .expect("clear birthday");
        assert_eq!(store.birthday("guild", "user").expect("birthday"), None);
    }
}
