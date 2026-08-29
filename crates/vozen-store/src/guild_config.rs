use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{OptionalExtension, params};

use crate::{SqliteStore, StoreError};

/// Persistent server settings. Field names and defaults intentionally match the current Node
/// `GuildConfig` contract so Discord, the dashboard and the voice policy can migrate one
/// consumer at a time without changing stored data.
#[derive(Debug, Clone, PartialEq)]
pub struct GuildConfig {
    pub tts_channel_id: Option<String>,
    pub autoread: bool,
    pub default_voice: String,
    pub max_chars: i64,
    pub rate_per_min: i64,
    pub enabled: bool,
    pub tts_role_id: Option<String>,
    pub locale: String,
    pub xsaid: bool,
    pub autojoin: bool,
    pub read_bots: bool,
    pub text_in_voice: bool,
    pub greet_on_join: bool,
    pub greet_locale: String,
    pub antispam: bool,
    pub stay_in_call: bool,
    pub streak_announce: bool,
    pub soundboard: bool,
    pub vote_promos: bool,
    pub priority_role_id: Option<String>,
    pub blocked_role_id: Option<String>,
    pub translation_enabled: bool,
    pub translation_daily_char_limit: i64,
    pub translation_per_user_daily_char_limit: i64,
}

impl Default for GuildConfig {
    fn default() -> Self {
        Self {
            tts_channel_id: None,
            autoread: false,
            default_voice: String::new(),
            max_chars: 300,
            rate_per_min: 8,
            enabled: true,
            tts_role_id: None,
            locale: "en".into(),
            xsaid: true,
            autojoin: false,
            read_bots: false,
            text_in_voice: false,
            greet_on_join: true,
            greet_locale: "en".into(),
            antispam: false,
            stay_in_call: false,
            streak_announce: true,
            soundboard: true,
            vote_promos: false,
            priority_role_id: None,
            blocked_role_id: None,
            translation_enabled: false,
            translation_daily_char_limit: 10_000,
            translation_per_user_daily_char_limit: 2_000,
        }
    }
}

/// Partial settings update. `Some(None)` deliberately clears a nullable Discord identifier.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct GuildConfigPatch {
    pub tts_channel_id: Option<Option<String>>,
    pub autoread: Option<bool>,
    pub default_voice: Option<String>,
    pub max_chars: Option<i64>,
    pub rate_per_min: Option<i64>,
    pub enabled: Option<bool>,
    pub tts_role_id: Option<Option<String>>,
    pub locale: Option<String>,
    pub xsaid: Option<bool>,
    pub autojoin: Option<bool>,
    pub read_bots: Option<bool>,
    pub text_in_voice: Option<bool>,
    pub greet_on_join: Option<bool>,
    pub greet_locale: Option<String>,
    pub antispam: Option<bool>,
    pub stay_in_call: Option<bool>,
    pub streak_announce: Option<bool>,
    pub soundboard: Option<bool>,
    pub vote_promos: Option<bool>,
    pub priority_role_id: Option<Option<String>>,
    pub blocked_role_id: Option<Option<String>>,
    pub translation_enabled: Option<bool>,
    pub translation_daily_char_limit: Option<i64>,
    pub translation_per_user_daily_char_limit: Option<i64>,
}

impl GuildConfig {
    fn apply(&mut self, patch: GuildConfigPatch) {
        macro_rules! apply {
            ($field:ident) => {
                if let Some(value) = patch.$field {
                    self.$field = value;
                }
            };
        }
        apply!(tts_channel_id);
        apply!(autoread);
        apply!(default_voice);
        apply!(max_chars);
        apply!(rate_per_min);
        apply!(enabled);
        apply!(tts_role_id);
        apply!(locale);
        apply!(xsaid);
        apply!(autojoin);
        apply!(read_bots);
        apply!(text_in_voice);
        apply!(greet_on_join);
        apply!(greet_locale);
        apply!(antispam);
        apply!(stay_in_call);
        apply!(streak_announce);
        apply!(soundboard);
        apply!(vote_promos);
        apply!(priority_role_id);
        apply!(blocked_role_id);
        apply!(translation_enabled);
        apply!(translation_daily_char_limit);
        apply!(translation_per_user_daily_char_limit);
    }
}

impl SqliteStore {
    pub fn guild_config(&self, guild_id: &str) -> Result<GuildConfig, StoreError> {
        self.connection()
            .query_row(
                "SELECT tts_channel_id, autoread, default_voice, max_chars, rate_per_min, enabled,
                        tts_role_id, locale, xsaid, autojoin, read_bots, text_in_voice, greet_on_join,
                        greet_locale, antispam, stay_in_call, streak_announce, soundboard, vote_promos,
                        priority_role_id, blocked_role_id, translation_enabled,
                        translation_daily_char_limit, translation_per_user_daily_char_limit
                 FROM guild_config WHERE guild_id = ?1",
                [guild_id],
                |row| {
                    Ok(GuildConfig {
                        tts_channel_id: row.get(0)?,
                        autoread: bool_or_default(row.get(1)?, false),
                        default_voice: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                        max_chars: row.get::<_, Option<i64>>(3)?.unwrap_or(300),
                        rate_per_min: row.get::<_, Option<i64>>(4)?.unwrap_or(8),
                        enabled: bool_or_default(row.get(5)?, true),
                        tts_role_id: row.get(6)?,
                        locale: row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "en".into()),
                        xsaid: bool_or_default(row.get(8)?, true),
                        autojoin: bool_or_default(row.get(9)?, false),
                        read_bots: bool_or_default(row.get(10)?, false),
                        text_in_voice: bool_or_default(row.get(11)?, false),
                        greet_on_join: bool_or_default(row.get(12)?, true),
                        greet_locale: row.get::<_, Option<String>>(13)?.unwrap_or_else(|| "en".into()),
                        antispam: bool_or_default(row.get(14)?, false),
                        stay_in_call: bool_or_default(row.get(15)?, false),
                        streak_announce: bool_or_default(row.get(16)?, true),
                        soundboard: bool_or_default(row.get(17)?, true),
                        vote_promos: bool_or_default(row.get(18)?, false),
                        priority_role_id: row.get(19)?,
                        blocked_role_id: row.get(20)?,
                        translation_enabled: bool_or_default(row.get(21)?, false),
                        translation_daily_char_limit: row.get::<_, Option<i64>>(22)?.unwrap_or(10_000),
                        translation_per_user_daily_char_limit: row
                            .get::<_, Option<i64>>(23)?
                            .unwrap_or(2_000),
                    })
                },
            )
            .optional()
            .map(|config| config.unwrap_or_default())
            .map_err(StoreError::from)
    }

    pub fn update_guild_config(
        &self,
        guild_id: &str,
        patch: GuildConfigPatch,
    ) -> Result<GuildConfig, StoreError> {
        let previous = self.guild_config(guild_id)?;
        let mut config = previous.clone();
        config.apply(patch);
        self.save_guild_config(guild_id, &config)?;
        if !tts_ready(&previous) && tts_ready(&config) {
            self.record_guild_setup_completed(guild_id, now_ms())?;
        }
        Ok(config)
    }

    pub fn reset_guild_config(&self, guild_id: &str) -> Result<(), StoreError> {
        self.connection()
            .execute("DELETE FROM guild_config WHERE guild_id = ?1", [guild_id])?;
        Ok(())
    }

    fn save_guild_config(&self, guild_id: &str, config: &GuildConfig) -> Result<(), StoreError> {
        self.connection().execute(
            "INSERT INTO guild_config (
                guild_id, tts_channel_id, autoread, default_voice, max_chars, rate_per_min, enabled,
                tts_role_id, locale, xsaid, autojoin, read_bots, text_in_voice, greet_on_join,
                greet_locale, antispam, stay_in_call, streak_announce, soundboard, vote_promos,
                priority_role_id, blocked_role_id, translation_enabled, translation_daily_char_limit,
                translation_per_user_daily_char_limit
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
                ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25
             ) ON CONFLICT(guild_id) DO UPDATE SET
                tts_channel_id = excluded.tts_channel_id,
                autoread = excluded.autoread,
                default_voice = excluded.default_voice,
                max_chars = excluded.max_chars,
                rate_per_min = excluded.rate_per_min,
                enabled = excluded.enabled,
                tts_role_id = excluded.tts_role_id,
                locale = excluded.locale,
                xsaid = excluded.xsaid,
                autojoin = excluded.autojoin,
                read_bots = excluded.read_bots,
                text_in_voice = excluded.text_in_voice,
                greet_on_join = excluded.greet_on_join,
                greet_locale = excluded.greet_locale,
                antispam = excluded.antispam,
                stay_in_call = excluded.stay_in_call,
                streak_announce = excluded.streak_announce,
                soundboard = excluded.soundboard,
                vote_promos = excluded.vote_promos,
                priority_role_id = excluded.priority_role_id,
                blocked_role_id = excluded.blocked_role_id,
                translation_enabled = excluded.translation_enabled,
                translation_daily_char_limit = excluded.translation_daily_char_limit,
                translation_per_user_daily_char_limit = excluded.translation_per_user_daily_char_limit",
            params![
                guild_id,
                config.tts_channel_id,
                i64::from(config.autoread),
                config.default_voice,
                config.max_chars,
                config.rate_per_min,
                i64::from(config.enabled),
                config.tts_role_id,
                config.locale,
                i64::from(config.xsaid),
                i64::from(config.autojoin),
                i64::from(config.read_bots),
                i64::from(config.text_in_voice),
                i64::from(config.greet_on_join),
                config.greet_locale,
                i64::from(config.antispam),
                i64::from(config.stay_in_call),
                i64::from(config.streak_announce),
                i64::from(config.soundboard),
                i64::from(config.vote_promos),
                config.priority_role_id,
                config.blocked_role_id,
                i64::from(config.translation_enabled),
                config.translation_daily_char_limit,
                config.translation_per_user_daily_char_limit,
            ],
        )?;
        Ok(())
    }
}

fn bool_or_default(value: Option<i64>, default: bool) -> bool {
    value.map_or(default, |raw| raw == 1)
}

fn tts_ready(config: &GuildConfig) -> bool {
    config.enabled && config.autoread && config.tts_channel_id.is_some()
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_guild_uses_the_node_defaults() {
        let store = SqliteStore::open_in_memory().expect("open store");
        assert_eq!(
            store.guild_config("guild").expect("read config"),
            GuildConfig::default()
        );
    }

    #[test]
    fn update_preserves_unpatched_settings_and_can_clear_nullable_ids() {
        let store = SqliteStore::open_in_memory().expect("open store");
        let updated = store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    tts_channel_id: Some(Some("channel".into())),
                    autoread: Some(true),
                    locale: Some("pt".into()),
                    priority_role_id: Some(Some("accessibility".into())),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("save config");
        assert!(updated.autoread);
        assert_eq!(updated.tts_channel_id.as_deref(), Some("channel"));
        assert_eq!(updated.locale, "pt");
        assert_eq!(updated.rate_per_min, 8);

        let cleared = store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    tts_channel_id: Some(None),
                    priority_role_id: Some(None),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("clear IDs");
        assert_eq!(cleared.tts_channel_id, None);
        assert_eq!(cleared.priority_role_id, None);
        assert!(cleared.autoread);
    }

    #[test]
    fn reset_restores_the_node_defaults() {
        let store = SqliteStore::open_in_memory().expect("open store");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    enabled: Some(false),
                    soundboard: Some(false),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("save config");
        store.reset_guild_config("guild").expect("reset config");
        assert_eq!(
            store.guild_config("guild").expect("read config"),
            GuildConfig::default()
        );
    }

    #[test]
    fn first_ready_tts_configuration_records_one_setup_completion() {
        let store = SqliteStore::open_in_memory().expect("open store");
        store
            .record_guild_join("guild", None, 86_400_000)
            .expect("join");

        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    tts_channel_id: Some(Some("channel".into())),
                    autoread: Some(true),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("mark ready");
        store
            .update_guild_config(
                "guild",
                GuildConfigPatch {
                    default_voice: Some("en_US-amy-medium".into()),
                    ..GuildConfigPatch::default()
                },
            )
            .expect("change voice");

        assert_eq!(
            store
                .growth_overview(60 * 86_400_000)
                .expect("overview")
                .setup_completed,
            1
        );
    }
}
