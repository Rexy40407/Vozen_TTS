-- Vozen durable store: private Supabase/Postgres schema.
CREATE SCHEMA IF NOT EXISTS vozen;
REVOKE ALL ON SCHEMA vozen FROM PUBLIC, anon, authenticated;
SET search_path TO vozen, public;

CREATE TABLE blocklist (
        guild_id TEXT NOT NULL,
        word     TEXT NOT NULL,
        PRIMARY KEY (guild_id, word)
      );
CREATE TABLE channel_profile (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        auto_read INTEGER CHECK (auto_read IN (0, 1)),
        translation_enabled INTEGER CHECK (translation_enabled IN (0, 1)),
        default_voice TEXT,
        engine TEXT,
        speed REAL,
        max_chars INTEGER,
        read_bots INTEGER CHECK (read_bots IN (0, 1)),
        voice_channel_id TEXT,
        locale TEXT,
        effect TEXT,
        PRIMARY KEY (guild_id, channel_id)
      );
CREATE TABLE discord_premium_entitlement (
        kind       TEXT NOT NULL CHECK (kind IN ('guild', 'user')),
        target_id  TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (kind, target_id)
      );
CREATE TABLE game_score (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        points   INTEGER NOT NULL DEFAULT 0,
        wins     INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE gcloud_daily_usage (
        day   TEXT PRIMARY KEY,
        chars INTEGER NOT NULL DEFAULT 0
      );
CREATE TABLE gcloud_usage (
        scope TEXT NOT NULL,
        key   TEXT NOT NULL,
        month TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scope, key, month)
      );
CREATE TABLE guild_config (
        guild_id       TEXT PRIMARY KEY,
        tts_channel_id TEXT,
        autoread       INTEGER NOT NULL DEFAULT 0,
        default_voice  TEXT NOT NULL DEFAULT 'en_US-amy-medium',
        max_chars      INTEGER NOT NULL DEFAULT 300,
        rate_per_min   INTEGER NOT NULL DEFAULT 8,
        enabled        INTEGER NOT NULL DEFAULT 1,
        tts_role_id    TEXT,
        locale         TEXT NOT NULL DEFAULT 'en',
        xsaid          INTEGER NOT NULL DEFAULT 1,
        autojoin       INTEGER NOT NULL DEFAULT 0,
        read_bots      INTEGER NOT NULL DEFAULT 0,
        text_in_voice  INTEGER NOT NULL DEFAULT 0,
        greet_on_join  INTEGER NOT NULL DEFAULT 1,
        greet_locale   TEXT NOT NULL DEFAULT 'en',
        antispam       INTEGER NOT NULL DEFAULT 0,
        stay_in_call   INTEGER NOT NULL DEFAULT 0,
        streak_announce INTEGER NOT NULL DEFAULT 1,
        soundboard     INTEGER NOT NULL DEFAULT 1,
        vote_promos    INTEGER NOT NULL DEFAULT 0,
        priority_role_id TEXT,
        blocked_role_id  TEXT,
        translation_enabled INTEGER NOT NULL DEFAULT 0,
        translation_daily_char_limit INTEGER NOT NULL DEFAULT 10000,
        translation_per_user_daily_char_limit INTEGER NOT NULL DEFAULT 2000
      );
CREATE TABLE guild_departed (
        guild_id TEXT PRIMARY KEY,
        left_at  INTEGER NOT NULL
      );
CREATE TABLE guild_talk_streak (
        guild_id    TEXT PRIMARY KEY,
        streak      INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        last_date   TEXT NOT NULL DEFAULT ''
      );
CREATE TABLE kofi_activation_consent (
        transaction_id TEXT PRIMARY KEY,
        confirmation_id TEXT NOT NULL,
        discord_id      TEXT NOT NULL,
        accepted_at     INTEGER NOT NULL,
        terms_version   TEXT NOT NULL,
        method          TEXT NOT NULL CHECK (method IN ('discord_email', 'receipt'))
      );
CREATE TABLE kofi_pending (
        transaction_id  TEXT PRIMARY KEY,
        email_hash      TEXT,
        plan            TEXT NOT NULL,
        days            INTEGER NOT NULL,
        seats           INTEGER NOT NULL,
        created_at      INTEGER NOT NULL,
        claimed_at      INTEGER,
        -- Plan 035. Decides two things at claim time: which OTHER pending rows on the same
        -- email get applied along with this one, and whether claiming it may rebind
        -- email->Discord (which is what routes renewals). Only subscriptions travel together
        -- and only they may move the binding, so a gift bought on the buyer's own email
        -- cannot hand the buyer's renewals to the recipient.
        is_subscription INTEGER NOT NULL DEFAULT 0
      );
CREATE TABLE kofi_supporter (
        email_hash TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
CREATE TABLE kofi_transaction (
        transaction_id TEXT PRIMARY KEY,
        processed_at   INTEGER NOT NULL
      );
CREATE TABLE stripe_event (
        event_id     TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL
      );
CREATE TABLE stripe_subscription (
        subscription_id    TEXT PRIMARY KEY,
        customer_id        TEXT NOT NULL,
        user_id            TEXT NOT NULL,
        plan               TEXT NOT NULL,
        seats              INTEGER NOT NULL,
        current_period_end INTEGER NOT NULL,
        status             TEXT NOT NULL,
        updated_at         INTEGER NOT NULL
      );
CREATE TABLE operational_daily_metric (
        day      TEXT NOT NULL,
        metric   TEXT NOT NULL,
        provider TEXT NOT NULL,
        value    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, metric, provider)
      );
CREATE TABLE premium_code (
        code        TEXT PRIMARY KEY,
        plan        TEXT NOT NULL,
        days        INTEGER NOT NULL,
        seats       INTEGER NOT NULL,
        created_by  TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        expires_at  INTEGER,
        redeemed_by TEXT,
        redeemed_at INTEGER
      );
CREATE TABLE premium_guild (
        guild_id   TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT ''
      );
CREATE TABLE premium_pass (
        user_id    TEXT PRIMARY KEY,
        seats      INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT ''
      );
CREATE TABLE premium_pass_activation (
        user_id      TEXT NOT NULL,
        guild_id     TEXT NOT NULL,
        activated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );
CREATE TABLE premium_user (
        user_id    TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT ''
      );
CREATE TABLE pronunciation (
        guild_id    TEXT NOT NULL,
        term        TEXT NOT NULL,
        replacement TEXT NOT NULL,
        PRIMARY KEY (guild_id, term)
      );
CREATE TABLE pronunciation_user (
        user_id     TEXT NOT NULL,
        term        TEXT NOT NULL,
        replacement TEXT NOT NULL,
        PRIMARY KEY (user_id, term)
      );
CREATE TABLE provider_health_state (
        provider          TEXT PRIMARY KEY,
        health            TEXT NOT NULL CHECK (health IN ('healthy', 'degraded')),
        changed_at        INTEGER NOT NULL,
        last_healthy_at   INTEGER,
        last_degraded_at  INTEGER
      );
CREATE TABLE stt_consent (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        consent_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );
CREATE TABLE talk_stats (
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        spoken_count INTEGER NOT NULL DEFAULT 0,
        streak       INTEGER NOT NULL DEFAULT 0,
        best_streak  INTEGER NOT NULL DEFAULT 0,
        last_date    TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE talk_usage (
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        language     TEXT NOT NULL,
        engine       TEXT NOT NULL,
        spoken_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, language, engine)
      );
CREATE TABLE topgg_webhook_event (
        event_id     TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL
      );
CREATE TABLE translation_daily_usage (
        day TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, guild_id)
      );
CREATE TABLE translation_mapping (
        guild_id TEXT NOT NULL,
        source_channel_id TEXT NOT NULL,
        destination_channel_id TEXT NOT NULL,
        target_locale TEXT NOT NULL,
        PRIMARY KEY (guild_id, source_channel_id),
        CHECK (source_channel_id <> destination_channel_id)
      );
CREATE TABLE translation_preference (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        locale TEXT,
        speak_locale TEXT,
        opted_out INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE translation_user_daily_usage (
        day TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, guild_id, user_id)
      );
CREATE TABLE tts_lang_detect_on (
      guild_id TEXT NOT NULL,
      user_id  TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );
CREATE TABLE tts_optout (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE user_abbreviation (
        user_id     TEXT NOT NULL,
        term        TEXT NOT NULL,
        replacement TEXT NOT NULL,
        PRIMARY KEY (user_id, term)
      );
CREATE TABLE user_birthday (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        month    INTEGER NOT NULL,
        day      INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE user_effect (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        effect   TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE user_nickname (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        nickname TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE user_voice (
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        speed       REAL NOT NULL,
        engine      TEXT NOT NULL DEFAULT 'google',
        PRIMARY KEY (guild_id, user_id)
      );
CREATE TABLE user_voice_favorite (
        user_id    TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, voice_model)
      );
CREATE TABLE user_voice_recent (
        user_id    TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        used_at    INTEGER NOT NULL,
        PRIMARY KEY (user_id, voice_model)
      );
CREATE TABLE voice_presence (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
CREATE TABLE vote_promo_state (
        guild_id     TEXT PRIMARY KEY,
        last_post_at INTEGER NOT NULL,
        last_kind    TEXT NOT NULL DEFAULT 'vote' CHECK (last_kind IN ('vote', 'support'))
      );
CREATE TABLE vote_redemption (
        user_hash   TEXT PRIMARY KEY,
        redeemed_at INTEGER NOT NULL
      );
CREATE TABLE vote_redemption_meta (
        singleton          INTEGER PRIMARY KEY CHECK (singleton = 1),
        secret_fingerprint TEXT NOT NULL
      );
CREATE TABLE vote_reward (
        user_id     TEXT PRIMARY KEY,
        rewarded_at INTEGER NOT NULL
      );
CREATE INDEX idx_discord_premium_entitlement_target
        ON discord_premium_entitlement (target_id);
CREATE INDEX idx_kofi_activation_consent_confirmation
        ON kofi_activation_consent (confirmation_id);
CREATE INDEX idx_kofi_pending_email
        ON kofi_pending (email_hash);
CREATE INDEX idx_pass_activation_guild
        ON premium_pass_activation (guild_id);
CREATE INDEX idx_talk_usage_user ON talk_usage (user_id);

-- Idempotent batches are the durable destination for the local SQLite outbox.
CREATE TABLE runtime_applied_batch (
  batch_id TEXT PRIMARY KEY,
  applied_at BIGINT NOT NULL
);
CREATE TABLE runtime_outbox_batch (
  batch_id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  payload JSONB NOT NULL
);

REVOKE ALL ON ALL TABLES IN SCHEMA vozen FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA vozen REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
