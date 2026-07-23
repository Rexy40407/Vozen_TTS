use rusqlite::{OptionalExtension, params};
use time::{Date, Duration, format_description::well_known::Iso8601};

use crate::{SqliteStore, StoreError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationMapping {
    pub guild_id: String,
    pub source_channel_id: String,
    pub destination_channel_id: String,
    pub target_locale: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationPreference {
    pub guild_id: String,
    pub user_id: String,
    pub opted_out: bool,
    pub locale: Option<String>,
    pub speak_locale: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct TranslationPreferencePatch {
    pub opted_out: Option<bool>,
    pub locale: Option<Option<String>>,
    pub speak_locale: Option<Option<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TranslationReservation {
    Reserved { chars: i64, day: String },
    Denied(TranslationReservationDenial),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TranslationReservationDenial {
    GuildQuota,
    UserQuota,
}

impl SqliteStore {
    pub fn clear_translation_config(&self, guild_id: &str) -> Result<(), StoreError> {
        let transaction = self.connection().unchecked_transaction()?;
        transaction.execute(
            "DELETE FROM translation_mapping WHERE guild_id = ?1",
            [guild_id],
        )?;
        transaction.execute(
            "DELETE FROM translation_preference WHERE guild_id = ?1",
            [guild_id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn translation_mappings(
        &self,
        guild_id: &str,
    ) -> Result<Vec<TranslationMapping>, StoreError> {
        let mut statement = self.connection().prepare(
            "SELECT guild_id, source_channel_id, destination_channel_id, target_locale\n             FROM translation_mapping WHERE guild_id = ?1 ORDER BY source_channel_id",
        )?;
        let rows = statement.query_map([guild_id], |row| {
            Ok(TranslationMapping {
                guild_id: row.get(0)?,
                source_channel_id: row.get(1)?,
                destination_channel_id: row.get(2)?,
                target_locale: row.get(3)?,
            })
        })?;
        rows.collect::<Result<_, _>>().map_err(StoreError::from)
    }

    pub fn upsert_translation_mapping(
        &self,
        mapping: &TranslationMapping,
    ) -> Result<(), StoreError> {
        if mapping.guild_id.trim().is_empty()
            || mapping.source_channel_id.trim().is_empty()
            || mapping.destination_channel_id.trim().is_empty()
            || mapping.target_locale.trim().is_empty()
            || mapping.source_channel_id == mapping.destination_channel_id
        {
            return Err(StoreError::InvalidTranslationMapping);
        }
        let cycle = self.connection().query_row(
            "SELECT 1 FROM translation_mapping\n             WHERE guild_id = ?1 AND source_channel_id = ?2 AND destination_channel_id = ?3",
            params![mapping.guild_id, mapping.destination_channel_id, mapping.source_channel_id],
            |_| Ok(()),
        ).optional()?.is_some();
        if cycle {
            return Err(StoreError::TranslationCycle);
        }
        self.connection().execute(
            "INSERT INTO translation_mapping (guild_id, source_channel_id, destination_channel_id, target_locale)\n             VALUES (?1, ?2, ?3, ?4)\n             ON CONFLICT(guild_id, source_channel_id) DO UPDATE SET\n               destination_channel_id = excluded.destination_channel_id,\n               target_locale = excluded.target_locale",
            params![mapping.guild_id, mapping.source_channel_id, mapping.destination_channel_id, mapping.target_locale],
        )?;
        Ok(())
    }

    pub fn remove_translation_mapping(
        &self,
        guild_id: &str,
        source_channel_id: &str,
    ) -> Result<bool, StoreError> {
        Ok(self.connection().execute(
            "DELETE FROM translation_mapping WHERE guild_id = ?1 AND source_channel_id = ?2",
            params![guild_id, source_channel_id],
        )? > 0)
    }

    pub fn translation_preference(
        &self,
        guild_id: &str,
        user_id: &str,
    ) -> Result<TranslationPreference, StoreError> {
        let row = self.connection().query_row(
            "SELECT opted_out, locale, speak_locale FROM translation_preference WHERE guild_id = ?1 AND user_id = ?2",
            params![guild_id, user_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get(1)?, row.get(2)?)),
        ).optional()?;
        Ok(match row {
            Some((opted_out, locale, speak_locale)) => TranslationPreference {
                guild_id: guild_id.into(),
                user_id: user_id.into(),
                opted_out: opted_out == 1,
                locale,
                speak_locale,
            },
            None => TranslationPreference {
                guild_id: guild_id.into(),
                user_id: user_id.into(),
                opted_out: false,
                locale: None,
                speak_locale: None,
            },
        })
    }

    pub fn update_translation_preference(
        &self,
        guild_id: &str,
        user_id: &str,
        patch: TranslationPreferencePatch,
    ) -> Result<TranslationPreference, StoreError> {
        let mut preference = self.translation_preference(guild_id, user_id)?;
        if let Some(opted_out) = patch.opted_out {
            preference.opted_out = opted_out;
        }
        if let Some(locale) = patch.locale {
            preference.locale = locale;
        }
        if let Some(speak_locale) = patch.speak_locale {
            preference.speak_locale = speak_locale;
        }
        self.connection().execute(
            "INSERT INTO translation_preference (guild_id, user_id, locale, speak_locale, opted_out)\n             VALUES (?1, ?2, ?3, ?4, ?5)\n             ON CONFLICT(guild_id, user_id) DO UPDATE SET\n               locale = excluded.locale, speak_locale = excluded.speak_locale, opted_out = excluded.opted_out",
            params![guild_id, user_id, preference.locale, preference.speak_locale, i64::from(preference.opted_out)],
        )?;
        Ok(preference)
    }

    pub fn reserve_translation_chars(
        &self,
        guild_id: &str,
        user_id: &str,
        chars: i64,
        guild_limit: i64,
        user_limit: i64,
        day: &str,
    ) -> Result<TranslationReservation, StoreError> {
        if chars <= 0 {
            return Err(StoreError::InvalidTranslationChars);
        }
        if guild_limit < 0 || user_limit < 0 {
            return Err(StoreError::InvalidTranslationLimit);
        }
        let window_start = rolling_window_start(day)?;
        let transaction = self.connection().unchecked_transaction()?;
        let guild_used: i64 = transaction.query_row(
            "SELECT COALESCE(SUM(chars), 0) FROM translation_daily_usage WHERE guild_id = ?1 AND day BETWEEN ?2 AND ?3",
            params![guild_id, window_start, day], |row| row.get(0),
        )?;
        if guild_used.saturating_add(chars) > guild_limit {
            return Ok(TranslationReservation::Denied(
                TranslationReservationDenial::GuildQuota,
            ));
        }
        let user_used: i64 = transaction.query_row(
            "SELECT COALESCE(SUM(chars), 0) FROM translation_user_daily_usage WHERE guild_id = ?1 AND user_id = ?2 AND day BETWEEN ?3 AND ?4",
            params![guild_id, user_id, window_start, day], |row| row.get(0),
        )?;
        if user_used.saturating_add(chars) > user_limit {
            return Ok(TranslationReservation::Denied(
                TranslationReservationDenial::UserQuota,
            ));
        }
        transaction.execute(
            "INSERT INTO translation_daily_usage (day, guild_id, chars) VALUES (?1, ?2, ?3) ON CONFLICT(day, guild_id) DO UPDATE SET chars = chars + excluded.chars",
            params![day, guild_id, chars],
        )?;
        transaction.execute(
            "INSERT INTO translation_user_daily_usage (day, guild_id, user_id, chars) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(day, guild_id, user_id) DO UPDATE SET chars = chars + excluded.chars",
            params![day, guild_id, user_id, chars],
        )?;
        transaction.commit()?;
        Ok(TranslationReservation::Reserved {
            chars,
            day: day.into(),
        })
    }

    pub fn refund_translation_chars(
        &self,
        guild_id: &str,
        user_id: &str,
        reservation: &TranslationReservation,
    ) -> Result<(), StoreError> {
        let TranslationReservation::Reserved { chars, day } = reservation else {
            return Ok(());
        };
        let transaction = self.connection().unchecked_transaction()?;
        transaction.execute("UPDATE translation_daily_usage SET chars = MAX(0, chars - ?1) WHERE day = ?2 AND guild_id = ?3", params![chars, day, guild_id])?;
        transaction.execute("UPDATE translation_user_daily_usage SET chars = MAX(0, chars - ?1) WHERE day = ?2 AND guild_id = ?3 AND user_id = ?4", params![chars, day, guild_id, user_id])?;
        transaction.commit()?;
        Ok(())
    }
}

fn rolling_window_start(day: &str) -> Result<String, StoreError> {
    let date = Date::parse(day, &Iso8601::DATE).map_err(|_| StoreError::InvalidTranslationDay)?;
    (date - Duration::days(29))
        .format(&Iso8601::DATE)
        .map_err(|_| StoreError::InvalidTranslationDay)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mapping_cycle_and_partial_preference_updates_match_node() {
        let store = SqliteStore::open_in_memory().expect("store");
        let first = TranslationMapping {
            guild_id: "guild".into(),
            source_channel_id: "source".into(),
            destination_channel_id: "destination".into(),
            target_locale: "pt".into(),
        };
        store.upsert_translation_mapping(&first).expect("mapping");
        assert!(matches!(
            store.upsert_translation_mapping(&TranslationMapping {
                guild_id: "guild".into(),
                source_channel_id: "destination".into(),
                destination_channel_id: "source".into(),
                target_locale: "en".into()
            }),
            Err(StoreError::TranslationCycle)
        ));
        assert_eq!(
            store.translation_mappings("guild").expect("mappings"),
            vec![first]
        );
        let preference = store
            .update_translation_preference(
                "guild",
                "user",
                TranslationPreferencePatch {
                    locale: Some(Some("fr".into())),
                    ..TranslationPreferencePatch::default()
                },
            )
            .expect("locale");
        assert_eq!(preference.locale.as_deref(), Some("fr"));
        let preference = store
            .update_translation_preference(
                "guild",
                "user",
                TranslationPreferencePatch {
                    opted_out: Some(true),
                    speak_locale: Some(Some("es".into())),
                    ..TranslationPreferencePatch::default()
                },
            )
            .expect("partial");
        assert!(preference.opted_out);
        assert_eq!(preference.locale.as_deref(), Some("fr"));
        assert_eq!(preference.speak_locale.as_deref(), Some("es"));
    }

    #[test]
    fn rolling_quota_reserves_atomically_and_refunds_safely() {
        let store = SqliteStore::open_in_memory().expect("store");
        let reservation = store
            .reserve_translation_chars("guild", "user", 8, 10, 8, "2026-03-01")
            .expect("reserve");
        assert!(matches!(
            reservation,
            TranslationReservation::Reserved { .. }
        ));
        assert_eq!(
            store
                .reserve_translation_chars("guild", "user", 1, 10, 8, "2026-03-01")
                .expect("user cap"),
            TranslationReservation::Denied(TranslationReservationDenial::UserQuota)
        );
        store
            .refund_translation_chars("guild", "user", &reservation)
            .expect("refund");
        assert!(matches!(
            store.reserve_translation_chars("guild", "user", 8, 10, 8, "2026-03-01"),
            Ok(TranslationReservation::Reserved { .. })
        ));
        assert!(matches!(
            store.reserve_translation_chars("guild", "other", 3, 10, 8, "2026-03-01"),
            Ok(TranslationReservation::Denied(
                TranslationReservationDenial::GuildQuota
            ))
        ));
        assert!(matches!(
            store.reserve_translation_chars("guild", "user", 1, 10, 8, "invalid"),
            Err(StoreError::InvalidTranslationDay)
        ));
    }
}
