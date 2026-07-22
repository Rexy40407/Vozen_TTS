//! Idempotent upgrades for production SQLite files created by older Node releases.
//!
//! The generated schema contract intentionally represents the current schema only. SQLite's
//! `CREATE TABLE IF NOT EXISTS` does not add missing columns, therefore a Rust process must run
//! these historical transformations before it can safely open an existing production database.

use std::collections::HashSet;

use rusqlite::Connection;

use crate::StoreError;

const GUILD_CONFIG_COLUMNS: &[(&str, &str)] = &[
    ("tts_channel_id", "TEXT"),
    ("autoread", "INTEGER NOT NULL DEFAULT 0"),
    ("default_voice", "TEXT NOT NULL DEFAULT 'en_US-amy-medium'"),
    ("max_chars", "INTEGER NOT NULL DEFAULT 300"),
    ("rate_per_min", "INTEGER NOT NULL DEFAULT 8"),
    ("enabled", "INTEGER NOT NULL DEFAULT 1"),
    ("tts_role_id", "TEXT"),
    ("locale", "TEXT NOT NULL DEFAULT 'en'"),
    ("xsaid", "INTEGER NOT NULL DEFAULT 1"),
    ("autojoin", "INTEGER NOT NULL DEFAULT 0"),
    ("read_bots", "INTEGER NOT NULL DEFAULT 0"),
    ("text_in_voice", "INTEGER NOT NULL DEFAULT 0"),
    ("greet_on_join", "INTEGER NOT NULL DEFAULT 1"),
    ("greet_locale", "TEXT NOT NULL DEFAULT 'en'"),
    ("antispam", "INTEGER NOT NULL DEFAULT 0"),
    ("stay_in_call", "INTEGER NOT NULL DEFAULT 0"),
    ("streak_announce", "INTEGER NOT NULL DEFAULT 1"),
    ("soundboard", "INTEGER NOT NULL DEFAULT 1"),
    ("vote_promos", "INTEGER NOT NULL DEFAULT 0"),
    ("priority_role_id", "TEXT"),
    ("blocked_role_id", "TEXT"),
    ("translation_enabled", "INTEGER NOT NULL DEFAULT 0"),
    (
        "translation_daily_char_limit",
        "INTEGER NOT NULL DEFAULT 10000",
    ),
    (
        "translation_per_user_daily_char_limit",
        "INTEGER NOT NULL DEFAULT 2000",
    ),
];

const CHANNEL_PROFILE_COLUMNS: &[(&str, &str)] = &[
    ("engine", "TEXT"),
    ("speed", "REAL"),
    ("max_chars", "INTEGER"),
    ("read_bots", "INTEGER CHECK (read_bots IN (0, 1))"),
    ("voice_channel_id", "TEXT"),
    ("locale", "TEXT"),
    ("effect", "TEXT"),
];

pub(crate) fn migrate_legacy_schema(connection: &Connection) -> Result<(), StoreError> {
    // Removed voice cloning stored biometric-consent metadata. This deletion is deliberately
    // irreversible and mirrors the privacy purge in Node before a Rust cutover is permitted.
    connection.execute_batch("DROP TABLE IF EXISTS user_clone;")?;

    add_missing_columns(connection, "guild_config", GUILD_CONFIG_COLUMNS)?;
    add_missing_columns(
        connection,
        "user_voice",
        &[("engine", "TEXT NOT NULL DEFAULT 'google'")],
    )?;
    add_missing_columns(
        connection,
        "translation_preference",
        &[("speak_locale", "TEXT")],
    )?;
    add_missing_columns(connection, "channel_profile", CHANNEL_PROFILE_COLUMNS)?;
    add_missing_columns(
        connection,
        "vote_promo_state",
        &[(
            "last_kind",
            "TEXT NOT NULL DEFAULT 'vote' CHECK (last_kind IN ('vote', 'support'))",
        )],
    )?;
    add_missing_columns(
        connection,
        "kofi_pending",
        &[("is_subscription", "INTEGER NOT NULL DEFAULT 0")],
    )?;

    let supporter_columns = table_columns(connection, "kofi_supporter")?;
    if supporter_columns.contains("email") && !supporter_columns.contains("email_hash") {
        // The values in old rows are intentionally no longer usable as an email lookup key; they
        // become inert until Ko-fi supplies a new HMACed payment email.
        connection
            .execute_batch("ALTER TABLE kofi_supporter RENAME COLUMN email TO email_hash;")?;
    }

    connection.execute_batch(
        "UPDATE user_voice SET voice_model = 'pt_PT-google-medium'
         WHERE voice_model = 'pt_PT-tugao-medium';
         UPDATE guild_config SET default_voice = 'pt_PT-google-medium'
         WHERE default_voice = 'pt_PT-tugao-medium';
         DROP TABLE IF EXISTS tts_lang_detect_off;
         CREATE TABLE IF NOT EXISTS tts_lang_detect_on (
           guild_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           PRIMARY KEY (guild_id, user_id)
         );",
    )?;
    Ok(())
}

fn add_missing_columns(
    connection: &Connection,
    table: &str,
    definitions: &[(&str, &str)],
) -> Result<(), StoreError> {
    let mut existing = table_columns(connection, table)?;
    for (column, definition) in definitions {
        if !existing.contains(*column) {
            // Both values are Rust constants above, never user input.
            connection.execute_batch(&format!(
                "ALTER TABLE {table} ADD COLUMN {column} {definition};"
            ))?;
            existing.insert((*column).to_owned());
        }
    }
    Ok(())
}

fn table_columns(connection: &Connection, table: &str) -> Result<HashSet<String>, StoreError> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    statement
        .query_map([], |row| row.get(1))?
        .collect::<Result<HashSet<String>, _>>()
        .map_err(StoreError::from)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs::remove_file;
    use std::process;
    use std::time::{SystemTime, UNIX_EPOCH};

    use rusqlite::Connection;

    use crate::SqliteStore;

    fn temporary_database_path() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "vozen-rust-legacy-{}-{nonce}.sqlite",
            process::id()
        ))
    }

    fn columns(connection: &Connection, table: &str) -> HashSet<String> {
        super::table_columns(connection, table).expect("columns")
    }

    #[test]
    fn upgrades_legacy_columns_and_preserves_existing_values() {
        let path = temporary_database_path();
        let legacy = Connection::open(&path).expect("legacy DB");
        legacy.execute_batch(
            "CREATE TABLE guild_config (
                guild_id TEXT PRIMARY KEY,
                default_voice TEXT NOT NULL DEFAULT 'en_US-amy-medium'
             );
             INSERT INTO guild_config (guild_id, default_voice) VALUES ('guild', 'pt_PT-tugao-medium');
             CREATE TABLE user_voice (
                guild_id TEXT NOT NULL, user_id TEXT NOT NULL, voice_model TEXT NOT NULL,
                speed REAL NOT NULL, PRIMARY KEY (guild_id, user_id)
             );
             INSERT INTO user_voice VALUES ('guild', 'user', 'pt_PT-tugao-medium', 1.0);
             CREATE TABLE kofi_supporter (email TEXT PRIMARY KEY, discord_id TEXT NOT NULL, updated_at INTEGER NOT NULL);
             CREATE TABLE vote_promo_state (guild_id TEXT PRIMARY KEY, last_post_at INTEGER NOT NULL);
             INSERT INTO vote_promo_state VALUES ('guild', 1);
             CREATE TABLE user_clone (user_id TEXT PRIMARY KEY, sample_path TEXT NOT NULL, consent_at INTEGER NOT NULL);
             CREATE TABLE tts_lang_detect_off (guild_id TEXT NOT NULL, user_id TEXT NOT NULL);",
        ).expect("legacy schema");
        drop(legacy);

        let store = SqliteStore::open(&path).expect("migrate");
        let config_columns = columns(store.connection(), "guild_config");
        assert!(config_columns.contains("translation_per_user_daily_char_limit"));
        assert!(columns(store.connection(), "user_voice").contains("engine"));
        assert!(columns(store.connection(), "kofi_supporter").contains("email_hash"));
        assert!(!columns(store.connection(), "kofi_supporter").contains("email"));
        assert!(columns(store.connection(), "vote_promo_state").contains("last_kind"));
        assert!(
            store
                .connection()
                .query_row("SELECT voice_model FROM user_voice", [], |row| row
                    .get::<_, String>(0))
                .expect("voice")
                == "pt_PT-google-medium"
        );
        assert!(
            store
                .connection()
                .query_row("SELECT default_voice FROM guild_config", [], |row| row
                    .get::<_, String>(
                    0
                ))
                .expect("default voice")
                == "pt_PT-google-medium"
        );
        assert!(!store.has_schema_object("user_clone").expect("clone purged"));
        assert!(
            !store
                .has_schema_object("tts_lang_detect_off")
                .expect("old optout purged")
        );
        assert!(
            store
                .has_schema_object("tts_lang_detect_on")
                .expect("optin present")
        );
        drop(store);
        let _ = remove_file(&path);
        let _ = remove_file(format!("{}-wal", path.display()));
        let _ = remove_file(format!("{}-shm", path.display()));
    }
}
