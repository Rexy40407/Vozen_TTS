//! Explicit data-retention boundaries shared with the Node `dataLifecycle` contract.
//!
//! These arrays are deliberately hand-reviewed rather than inferred from column names: paid
//! entitlements and financial/idempotency evidence may carry a Discord identifier but are not
//! erased by a privacy request. Adding a new user/guild table requires an explicit decision.

use rusqlite::params;

use crate::{SqliteStore, StoreError};

pub const GUILD_PURGE_TABLES: &[&str] = &[
    "user_voice",
    "guild_config",
    "blocklist",
    "pronunciation",
    "tts_optout",
    "tts_lang_detect_on",
    "user_nickname",
    "game_score",
    "user_birthday",
    "talk_stats",
    "talk_usage",
    "guild_talk_streak",
    "vote_promo_state",
    "user_effect",
    "voice_presence",
    "stt_consent",
    "guild_departed",
    "guild_growth_activity_day",
    "guild_growth_retention_record",
    "guild_growth_lifecycle",
    "translation_mapping",
    "translation_preference",
    "translation_daily_usage",
    "translation_user_daily_usage",
    "channel_profile",
];

pub const USER_ERASE_TABLES: &[&str] = &[
    "user_voice",
    "user_voice_favorite",
    "user_voice_recent",
    "tts_optout",
    "tts_lang_detect_on",
    "user_nickname",
    "game_score",
    "user_birthday",
    "talk_stats",
    "talk_usage",
    "user_effect",
    "user_abbreviation",
    "pronunciation_user",
    "stt_consent",
    "stt_daily_usage",
    "vote_reward",
    "translation_preference",
    "translation_user_daily_usage",
];

/// Reviewed key semantics for the privacy tombstone shared by SQLite and the Postgres mirror.
///
/// Do not infer these from column names: some tables contain Discord identifiers which are
/// intentionally retained for accounting or abuse prevention. A new personal table must be
/// added here, with a matching local/mirror regression test, before it is considered erasable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivacyPurgeKey {
    UserId,
    DiscordId,
    GcloudPersonalKey,
    GuildId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrivacyPurgeSpec {
    pub table: &'static str,
    pub key: PrivacyPurgeKey,
}

macro_rules! purge_spec {
    ($table:literal, $key:expr) => {
        PrivacyPurgeSpec {
            table: $table,
            key: $key,
        }
    };
}

pub const USER_ERASE_SPECS: &[PrivacyPurgeSpec] = &[
    purge_spec!("user_voice", PrivacyPurgeKey::UserId),
    purge_spec!("user_voice_favorite", PrivacyPurgeKey::UserId),
    purge_spec!("user_voice_recent", PrivacyPurgeKey::UserId),
    purge_spec!("tts_optout", PrivacyPurgeKey::UserId),
    purge_spec!("tts_lang_detect_on", PrivacyPurgeKey::UserId),
    purge_spec!("user_nickname", PrivacyPurgeKey::UserId),
    purge_spec!("game_score", PrivacyPurgeKey::UserId),
    purge_spec!("user_birthday", PrivacyPurgeKey::UserId),
    purge_spec!("talk_stats", PrivacyPurgeKey::UserId),
    purge_spec!("talk_usage", PrivacyPurgeKey::UserId),
    purge_spec!("user_effect", PrivacyPurgeKey::UserId),
    purge_spec!("user_abbreviation", PrivacyPurgeKey::UserId),
    purge_spec!("pronunciation_user", PrivacyPurgeKey::UserId),
    purge_spec!("stt_consent", PrivacyPurgeKey::UserId),
    purge_spec!("stt_daily_usage", PrivacyPurgeKey::UserId),
    purge_spec!("vote_reward", PrivacyPurgeKey::UserId),
    purge_spec!("translation_preference", PrivacyPurgeKey::UserId),
    purge_spec!("translation_user_daily_usage", PrivacyPurgeKey::UserId),
    purge_spec!("kofi_supporter", PrivacyPurgeKey::DiscordId),
    purge_spec!("gcloud_usage", PrivacyPurgeKey::GcloudPersonalKey),
];

pub const GUILD_PURGE_SPECS: &[PrivacyPurgeSpec] = &[
    purge_spec!("user_voice", PrivacyPurgeKey::GuildId),
    purge_spec!("guild_config", PrivacyPurgeKey::GuildId),
    purge_spec!("blocklist", PrivacyPurgeKey::GuildId),
    purge_spec!("pronunciation", PrivacyPurgeKey::GuildId),
    purge_spec!("tts_optout", PrivacyPurgeKey::GuildId),
    purge_spec!("tts_lang_detect_on", PrivacyPurgeKey::GuildId),
    purge_spec!("user_nickname", PrivacyPurgeKey::GuildId),
    purge_spec!("game_score", PrivacyPurgeKey::GuildId),
    purge_spec!("user_birthday", PrivacyPurgeKey::GuildId),
    purge_spec!("talk_stats", PrivacyPurgeKey::GuildId),
    purge_spec!("talk_usage", PrivacyPurgeKey::GuildId),
    purge_spec!("guild_talk_streak", PrivacyPurgeKey::GuildId),
    purge_spec!("vote_promo_state", PrivacyPurgeKey::GuildId),
    purge_spec!("user_effect", PrivacyPurgeKey::GuildId),
    purge_spec!("voice_presence", PrivacyPurgeKey::GuildId),
    purge_spec!("stt_consent", PrivacyPurgeKey::GuildId),
    purge_spec!("guild_departed", PrivacyPurgeKey::GuildId),
    purge_spec!("guild_growth_activity_day", PrivacyPurgeKey::GuildId),
    purge_spec!("guild_growth_retention_record", PrivacyPurgeKey::GuildId),
    purge_spec!("guild_growth_lifecycle", PrivacyPurgeKey::GuildId),
    purge_spec!("translation_mapping", PrivacyPurgeKey::GuildId),
    purge_spec!("translation_preference", PrivacyPurgeKey::GuildId),
    purge_spec!("translation_daily_usage", PrivacyPurgeKey::GuildId),
    purge_spec!("translation_user_daily_usage", PrivacyPurgeKey::GuildId),
    purge_spec!("channel_profile", PrivacyPurgeKey::GuildId),
];

impl SqliteStore {
    /// Removes a departed server's configuration/content/statistics in one transaction. Paid
    /// memberships/pass activations deliberately remain: deleting them would revoke a purchase
    /// or free a paid seat.
    pub fn purge_guild_data(&self, guild_id: &str) -> Result<(), StoreError> {
        let transaction = self.connection().unchecked_transaction()?;
        for spec in GUILD_PURGE_SPECS {
            transaction.execute(
                &format!("DELETE FROM {} WHERE guild_id = ?1", spec.table),
                [guild_id],
            )?;
        }
        enqueue_privacy_tombstone(&transaction, "guild", guild_id)?;
        transaction.commit()?;
        Ok(())
    }

    /// Erases a user's personal data in every guild, atomically. It intentionally retains
    /// premium entitlement/payment evidence and HMAC-only anti-abuse ledgers. `talk_usage` is
    /// included despite being aggregate because it is scoped to a user and a guild.
    pub fn erase_user_data(&self, user_id: &str) -> Result<(), StoreError> {
        let transaction = self.connection().unchecked_transaction()?;
        for spec in USER_ERASE_SPECS {
            match spec.key {
                PrivacyPurgeKey::UserId => {
                    transaction.execute(
                        &format!("DELETE FROM {} WHERE user_id = ?1", spec.table),
                        [user_id],
                    )?;
                }
                PrivacyPurgeKey::DiscordId => {
                    transaction.execute(
                        &format!("DELETE FROM {} WHERE discord_id = ?1", spec.table),
                        [user_id],
                    )?;
                }
                PrivacyPurgeKey::GcloudPersonalKey => {
                    // gcloud `key` is a user ID for personal/pass usage; guild-level usage has a
                    // guild ID and remains under the departed-guild/retention policy.
                    transaction.execute(
                        &format!(
                            "DELETE FROM {} WHERE key = ?1 AND scope IN ('user', 'pass')",
                            spec.table
                        ),
                        params![user_id],
                    )?;
                }
                PrivacyPurgeKey::GuildId => unreachable!("guild key in user erase spec"),
            }
        }
        enqueue_privacy_tombstone(&transaction, "user", user_id)?;
        transaction.commit()?;
        Ok(())
    }
}

fn enqueue_privacy_tombstone(
    transaction: &rusqlite::Transaction<'_>,
    scope: &str,
    id: &str,
) -> Result<(), rusqlite::Error> {
    transaction.execute(
        "INSERT INTO runtime_outbox_batch (batch_id, created_at, payload)
         VALUES (?1 || lower(hex(randomblob(16))),
                 CAST(strftime('%s', 'now') AS INTEGER) * 1000,
                 json_object('version', 1, 'privacy', json_object('scope', ?2, 'id', ?3)))",
        params![format!("privacy-{scope}-"), scope, id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn privacy_erase_removes_personal_rows_but_retains_paid_rights() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .connection()
            .execute(
                "INSERT INTO kofi_supporter (email_hash, discord_id, updated_at) VALUES ('hash', 'user', 1)",
                [],
            )
            .expect("supporter");
        store
            .connection()
            .execute(
                "INSERT INTO gcloud_usage (scope, key, month, chars) VALUES
                 ('user', 'user', '2099-01', 1),
                 ('pass', 'user', '2099-01', 2),
                 ('guild', 'user', '2099-01', 3)",
                [],
            )
            .expect("gcloud usage");
        store
            .set_nickname("guild", "user", "Rexy")
            .expect("nickname");
        store
            .remember_voice_presence("guild", "voice", 1)
            .expect("presence");
        store.connection().execute(
            "INSERT INTO talk_usage (guild_id, user_id, language, engine, spoken_count) VALUES ('guild', 'user', 'en', 'piper', 1)",
            [],
        ).expect("usage");
        store
            .connection()
            .execute(
                "INSERT INTO premium_user (user_id, expires_at) VALUES ('user', 999)",
                [],
            )
            .expect("paid entitlement");

        store.erase_user_data("user").expect("erase");
        // Replaying the tombstone is safe and must not restore or remove retained guild usage.
        store.erase_user_data("user").expect("idempotent erase");
        assert_eq!(store.nickname("guild", "user").expect("nickname"), None);
        let usage: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM talk_usage WHERE user_id = 'user'",
                [],
                |row| row.get(0),
            )
            .expect("usage count");
        assert_eq!(usage, 0);
        let entitlement: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM premium_user WHERE user_id = 'user'",
                [],
                |row| row.get(0),
            )
            .expect("entitlement count");
        assert_eq!(entitlement, 1);
        // Voice presence has no user identifier and remains until the server/session lifecycle
        // removes it; a privacy erase must not disconnect every member of a shared call.
        assert_eq!(store.voice_presences().expect("presence").len(), 1);
        let supporter: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM kofi_supporter WHERE discord_id = 'user'",
                [],
                |row| row.get(0),
            )
            .expect("supporter count");
        assert_eq!(supporter, 0);
        let personal_usage: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM gcloud_usage WHERE key = 'user' AND scope IN ('user', 'pass')",
                [],
                |row| row.get(0),
            )
            .expect("personal usage count");
        assert_eq!(personal_usage, 0);
        let guild_usage: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM gcloud_usage WHERE key = 'user' AND scope = 'guild'",
                [],
                |row| row.get(0),
            )
            .expect("guild usage count");
        assert_eq!(guild_usage, 1);
        let tombstones = store
            .list_runtime_outbox(10)
            .expect("tombstones")
            .into_iter()
            .filter(|batch| batch.payload.contains("\"scope\":\"user\""))
            .count();
        assert_eq!(tombstones, 2);
    }

    #[test]
    fn guild_purge_removes_shared_content_but_keeps_paid_pass_state() {
        let store = SqliteStore::open_in_memory().expect("store");
        store
            .set_nickname("guild", "user", "Rexy")
            .expect("nickname");
        store
            .connection()
            .execute(
                "INSERT INTO premium_guild (guild_id, expires_at) VALUES ('guild', 999)",
                [],
            )
            .expect("paid guild entitlement");
        store.purge_guild_data("guild").expect("purge");
        assert_eq!(store.nickname("guild", "user").expect("nickname"), None);
        let entitlement: i64 = store
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM premium_guild WHERE guild_id = 'guild'",
                [],
                |row| row.get(0),
            )
            .expect("entitlement count");
        assert_eq!(entitlement, 1);
    }
}
