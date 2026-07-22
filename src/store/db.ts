import Database from 'better-sqlite3';
import { GUILD_CONFIG_COLUMNS } from './guildConfig';

export function initDb(path: string): Database.Database {
  let db: Database.Database | undefined;
  try {
    // O try cobre ABRIR e o schema inicial: um ficheiro corrompido/que-nao-e-DB
    // deixa `new Database()` passar (validacao lazy) e so rebenta em db.exec com
    // "file is not a database". Sem isto, esse caso daria stack trace cru.
    db = new Database(path);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_voice (
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        speed       REAL NOT NULL,
        engine      TEXT NOT NULL DEFAULT 'google',
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS guild_config (
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

      CREATE TABLE IF NOT EXISTS blocklist (
        guild_id TEXT NOT NULL,
        word     TEXT NOT NULL,
        PRIMARY KEY (guild_id, word)
      );

      -- Per-guild pronunciation dictionary (/server-pronunciation, admin). It applies to
      -- the entire guild and has a fixed limit of 3. Personal entries live elsewhere.
      CREATE TABLE IF NOT EXISTS pronunciation (
        guild_id    TEXT NOT NULL,
        term        TEXT NOT NULL,
        replacement TEXT NOT NULL,
        PRIMARY KEY (guild_id, term)
      );

      CREATE TABLE IF NOT EXISTS tts_optout (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS user_abbreviation (
        user_id     TEXT NOT NULL,
        term        TEXT NOT NULL,
        replacement TEXT NOT NULL,
        PRIMARY KEY (user_id, term)
      );

      -- Personal pronunciations (/pronunciation) apply only to their author's messages
      -- in every guild. The handler enforces 3 Free or 50 Premium entries.
      CREATE TABLE IF NOT EXISTS pronunciation_user (
        user_id     TEXT NOT NULL,
        term        TEXT NOT NULL,
        replacement TEXT NOT NULL,
        PRIMARY KEY (user_id, term)
      );

      -- Phonetic nickname per (guild,user), used by xsaid when speaking the author's
      -- name. A missing row falls back to the sanitized display name. See /voice nickname.
      CREATE TABLE IF NOT EXISTS user_nickname (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        nickname TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      -- Minigame leaderboard (/game) per (guild,user). points accumulates across matches;
      -- wins counts matches won. CREATE IF NOT EXISTS supports new and existing databases.
      CREATE TABLE IF NOT EXISTS game_score (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        points   INTEGER NOT NULL DEFAULT 0,
        wins     INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );

      -- Birthday per (guild,user): month and day, without a year. Vozen greets the member
      -- when they join its voice channel on that date.
      CREATE TABLE IF NOT EXISTS user_birthday (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        month    INTEGER NOT NULL,
        day      INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      -- Speaker statistics: auto-read message count and consecutive-day streaks for
      -- /top-speakers. last_date is the local YYYY-MM-DD date of the latest message.
      CREATE TABLE IF NOT EXISTS talk_stats (
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        spoken_count INTEGER NOT NULL DEFAULT 0,
        streak       INTEGER NOT NULL DEFAULT 0,
        best_streak  INTEGER NOT NULL DEFAULT 0,
        last_date    TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (guild_id, user_id)
      );

      -- Aggregate language/engine usage for the owner top-10 card. One counter per resolved
      -- combination; never stores message content. Existing databases start collecting on deploy.
      CREATE TABLE IF NOT EXISTS talk_usage (
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        language     TEXT NOT NULL,
        engine       TEXT NOT NULL,
        spoken_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, language, engine)
      );
      CREATE INDEX IF NOT EXISTS idx_talk_usage_user ON talk_usage (user_id);

      -- Per-SERVER talk streak (admin console only): consecutive days on which at least one
      -- person spoke. Same Duolingo rules as talk_stats' per-user streak. No message content,
      -- no per-user data — one row per guild. last_date is the local YYYY-MM-DD of the latest day.
      CREATE TABLE IF NOT EXISTS guild_talk_streak (
        guild_id    TEXT PRIMARY KEY,
        streak      INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        last_date   TEXT NOT NULL DEFAULT ''
      );

      -- Per-guild Vozen Premium purchased/granted directly. expires_at uses Unix
      -- milliseconds; a missing or expired row is Free. source records redeem, kofi,
      -- or manual provenance. Discord Premium App state is reconciled separately below.
      CREATE TABLE IF NOT EXISTS premium_guild (
        guild_id   TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT ''
      );

      -- Per-user Vozen Plus; personal perks follow the member across guilds.
      CREATE TABLE IF NOT EXISTS premium_user (
        user_id    TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT ''
      );

      -- Current Discord Premium App entitlements. This is reconciled from Discord's
      -- complete active entitlement list, so it must never overwrite durable paid rows.
      -- kind is 'guild' for Premium and 'user' for Plus.
      CREATE TABLE IF NOT EXISTS discord_premium_entitlement (
        kind       TEXT NOT NULL CHECK (kind IN ('guild', 'user')),
        target_id  TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (kind, target_id)
      );
      CREATE INDEX IF NOT EXISTS idx_discord_premium_entitlement_target
        ON discord_premium_entitlement (target_id);

      -- Active top.gg vote entitlement. The raw Discord ID is needed only while the
      -- 48h reward can be used and is erasable through /privacy erase. The permanent
      -- one-claim guard is the separate pseudonymous vote_redemption ledger below.
      CREATE TABLE IF NOT EXISTS vote_reward (
        user_id     TEXT PRIMARY KEY,
        rewarded_at INTEGER NOT NULL
      );

      -- Lifetime one-claim guard for the top.gg reward. user_hash is
      -- HMAC-SHA256(VOTE_REDEMPTION_SECRET, Discord user id), never the raw id. It is
      -- retained while the promotion exists so deleting personal settings or restarting
      -- the VPS cannot make the same account eligible again.
      CREATE TABLE IF NOT EXISTS vote_redemption (
        user_hash   TEXT PRIMARY KEY,
        redeemed_at INTEGER NOT NULL
      );

      -- Fails closed if VOTE_REDEMPTION_SECRET is accidentally replaced. Without
      -- this fingerprint a new secret would make every existing HMAC unmatchable
      -- and incorrectly let every account claim again.
      CREATE TABLE IF NOT EXISTS vote_redemption_meta (
        singleton          INTEGER PRIMARY KEY CHECK (singleton = 1),
        secret_fingerprint TEXT NOT NULL
      );

      -- Top.gg v1 delivery IDs are a short-retention idempotency ledger. The event id
      -- is external protocol metadata, not Discord identity/content, and is purged daily.
      CREATE TABLE IF NOT EXISTS topgg_webhook_event (
        event_id     TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL
      );

      -- Persistent per-server rotation for occasional Top.gg/support reminders.
      CREATE TABLE IF NOT EXISTS vote_promo_state (
        guild_id     TEXT PRIMARY KEY,
        last_post_at INTEGER NOT NULL,
        last_kind    TEXT NOT NULL DEFAULT 'vote' CHECK (last_kind IN ('vote', 'support'))
      );

      -- Voice effect per (guild,user): FFmpeg filter applied to the member's TTS.
      -- A missing row means 'none' (clean voice).
      CREATE TABLE IF NOT EXISTS user_effect (
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        effect   TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      -- Per-guild speech-to-text consent. A row exists only after explicit consent;
      -- hasSttConsent gates receiver input. Revocation deletes the row. No audio is stored
      -- here, only the consent fact and timestamp.
      CREATE TABLE IF NOT EXISTS stt_consent (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        consent_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );

      -- Per-user Premium pass with N seats and an absolute expires_at timestamp. Activating
      -- or deactivating a guild does not pause or extend it. /premium activate consumes a
      -- seat; renewals extend expires_at and active guilds inherit the new date immediately.
      CREATE TABLE IF NOT EXISTS premium_pass (
        user_id    TEXT PRIMARY KEY,
        seats      INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT ''
      );

      -- Guilds activated by a pass owner. One row consumes one seat, and rows per user_id
      -- never exceed premium_pass.seats. The guild index keeps isGuildPremium efficient.
      CREATE TABLE IF NOT EXISTS premium_pass_activation (
        user_id      TEXT NOT NULL,
        guild_id     TEXT NOT NULL,
        activated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pass_activation_guild
        ON premium_pass_activation (guild_id);

      -- Persistent monthly Google HD character usage by pool. scope is user, pass, guild,
      -- or global; key identifies the pool; month is UTC YYYY-MM. Only cache misses that
      -- call Google are counted. See tts/gcloudUsage.ts.
      CREATE TABLE IF NOT EXISTS gcloud_usage (
        scope TEXT NOT NULL,
        key   TEXT NOT NULL,
        month TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scope, key, month)
      );

      -- Persistent UTC-day global Google HD backstop. This intentionally has no guild,
      -- user, content or request columns: it is one daily service-wide cost counter.
      CREATE TABLE IF NOT EXISTS gcloud_daily_usage (
        day   TEXT PRIMARY KEY,
        chars INTEGER NOT NULL DEFAULT 0
      );

      -- Identity-free operational telemetry. Each row is only a UTC day, a fixed metric
      -- name, a provider label and a numeric aggregate; never text, audio, Discord IDs,
      -- tokens, request metadata or raw provider errors.
      CREATE TABLE IF NOT EXISTS operational_daily_metric (
        day      TEXT NOT NULL,
        metric   TEXT NOT NULL,
        provider TEXT NOT NULL,
        value    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, metric, provider)
      );

      -- Provider state carries only health/degradation timestamps. Error/request bodies
      -- remain in ordinary transient logs and are deliberately not copied here.
      CREATE TABLE IF NOT EXISTS provider_health_state (
        provider          TEXT PRIMARY KEY,
        health            TEXT NOT NULL CHECK (health IN ('healthy', 'degraded')),
        changed_at        INTEGER NOT NULL,
        last_healthy_at   INTEGER,
        last_degraded_at  INTEGER
      );

      -- Opt-in text translation configuration. Source text and translated output are never
      -- persisted: only channel routing, locale and bounded character counters live here.
      CREATE TABLE IF NOT EXISTS translation_mapping (
        guild_id TEXT NOT NULL,
        source_channel_id TEXT NOT NULL,
        destination_channel_id TEXT NOT NULL,
        target_locale TEXT NOT NULL,
        PRIMARY KEY (guild_id, source_channel_id),
        CHECK (source_channel_id <> destination_channel_id)
      );
      CREATE TABLE IF NOT EXISTS translation_preference (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        locale TEXT,
        speak_locale TEXT,
        opted_out INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS user_voice_favorite (
        user_id    TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, voice_model)
      );

      CREATE TABLE IF NOT EXISTS user_voice_recent (
        user_id    TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        used_at    INTEGER NOT NULL,
        PRIMARY KEY (user_id, voice_model)
      );
      CREATE TABLE IF NOT EXISTS translation_daily_usage (
        day TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, guild_id)
      );
      CREATE TABLE IF NOT EXISTS translation_user_daily_usage (
        day TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, guild_id, user_id)
      );

      -- Per-channel overrides. Nullable fields inherit the guild configuration so a newly
      -- created profile is inert. This table intentionally contains configuration only.
      CREATE TABLE IF NOT EXISTS channel_profile (
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

      -- Hashed-email to Discord-ID map for Ko-fi renewals. The first purchase supplies the
      -- Discord ID; later renewals are matched by email hash. Plain email is never stored.
      CREATE TABLE IF NOT EXISTS kofi_supporter (
        email_hash TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Processed Ko-fi transaction ledger for webhook idempotency. Ko-fi retries timed-out
      -- or non-2xx deliveries; this prevents a retry from extending a grant twice. Legitimate
      -- renewals carry distinct transaction IDs.
      CREATE TABLE IF NOT EXISTS kofi_transaction (
        transaction_id TEXT PRIMARY KEY,
        processed_at   INTEGER NOT NULL
      );

      -- Pending Ko-fi purchases without an attributable Discord ID. The buyer claims them
      -- on the site using Discord login and the receipt transaction ID. email_hash supports
      -- orphaned renewals and may be NULL. claimed_at NULL means unclaimed. Old rows are purged.
      CREATE TABLE IF NOT EXISTS kofi_pending (
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
      CREATE INDEX IF NOT EXISTS idx_kofi_pending_email
        ON kofi_pending (email_hash);

      -- Minimum, non-email evidence of explicit consent for instant Ko-fi activation. One row
      -- per applied purchase; every purchase in the same batch shares a confirmation_id.
      -- Retained with the financial/entitlement record for disputes and legal obligations.
      CREATE TABLE IF NOT EXISTS kofi_activation_consent (
        transaction_id TEXT PRIMARY KEY,
        confirmation_id TEXT NOT NULL,
        discord_id      TEXT NOT NULL,
        accepted_at     INTEGER NOT NULL,
        terms_version   TEXT NOT NULL,
        method          TEXT NOT NULL CHECK (method IN ('discord_email', 'receipt'))
      );
      CREATE INDEX IF NOT EXISTS idx_kofi_activation_consent_confirmation
        ON kofi_activation_consent (confirmation_id);

      -- Per-guild voice presence. Stored for every live session and deleted by normal
      -- teardown or guildDelete, but not by shutdown so it survives a deployment.
      -- ClientReady restores Premium 24/7 rows, plus planned clean-restart recovery rows.
      CREATE TABLE IF NOT EXISTS voice_presence (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Single-use gift codes generated by /generate-code and redeemed by /redeem. Redemption
      -- is atomic. plan is premium or plus; seats applies to premium; expires_at limits
      -- the code itself and NULL means that the code does not expire.
      CREATE TABLE IF NOT EXISTS premium_code (
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

      -- Records a real guild departure, not a transient outage. Re-inviting clears it.
      -- A daily job purges guild data after a 30-day re-invite grace period.
      CREATE TABLE IF NOT EXISTS guild_departed (
        guild_id TEXT PRIMARY KEY,
        left_at  INTEGER NOT NULL
      );
    `);

    // Removed voice-clone feature: purge the biometric consent records (sample_path +
    // consent_at) the /voice clone feature stored. Idempotent — DROP IF EXISTS is a no-op on
    // fresh databases that never had the table and on already-purged ones. The on-disk .wav
    // samples are removed separately at startup (see src/index.ts).
    db.exec('DROP TABLE IF EXISTS user_clone');

    // Migracoes idempotentes de guild_config GUIADAS PELO DESCRITOR
    // (GUILD_CONFIG_COLUMNS em ./guildConfig): qualquer coluna do descritor que falte
    // numa DB antiga e adicionada com o MESMO tipo/default do CREATE TABLE — o ALTER com
    // default CONSTANTE backfilla TODAS as linhas existentes (ex.: xsaid=1, autojoin=0).
    // As 6 colunas originais estao sempre presentes -> essas iteracoes sao no-op. Acrescentar
    // um campo novo ao descritor passa a migrar-se sozinho (era ~1 bloco if por campo).
    const cols = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
    for (const col of GUILD_CONFIG_COLUMNS) {
      if (!cols.some((c) => c.name === col.column)) {
        db.exec(`ALTER TABLE guild_config ADD COLUMN ${col.column} ${col.sqlType}`);
      }
    }
    // Migracao idempotente do `engine` no user_voice: motor por-utilizador (google/piper).
    // DEFAULT 'google' -> as vozes ja gravadas ficam no motor Google (backfill). No-op novas.
    const uvCols = db.pragma('table_info(user_voice)') as Array<{ name: string }>;
    if (!uvCols.some((c) => c.name === 'engine')) {
      db.exec("ALTER TABLE user_voice ADD COLUMN engine TEXT NOT NULL DEFAULT 'google'");
    }
    const translationPreferenceCols = db.pragma('table_info(translation_preference)') as Array<{
      name: string;
    }>;
    if (!translationPreferenceCols.some((column) => column.name === 'speak_locale')) {
      db.exec('ALTER TABLE translation_preference ADD COLUMN speak_locale TEXT');
    }
    const channelProfileCols = db.pragma('table_info(channel_profile)') as Array<{ name: string }>;
    const channelProfileMigrations = [
      ['engine', 'TEXT'],
      ['speed', 'REAL'],
      ['max_chars', 'INTEGER'],
      ['read_bots', 'INTEGER CHECK (read_bots IN (0, 1))'],
      ['voice_channel_id', 'TEXT'],
      ['locale', 'TEXT'],
      ['effect', 'TEXT'],
    ] as const;
    for (const [column, definition] of channelProfileMigrations) {
      if (!channelProfileCols.some((existing) => existing.name === column)) {
        db.exec(`ALTER TABLE channel_profile ADD COLUMN ${column} ${definition}`);
      }
    }
    // Existing rows came from the vote-only scheduler, so `vote` is the honest backfill:
    // after the 24h shared cooldown their next card is support, preserving alternation.
    const promoCols = db.pragma('table_info(vote_promo_state)') as Array<{ name: string }>;
    if (!promoCols.some((c) => c.name === 'last_kind')) {
      db.exec(
        "ALTER TABLE vote_promo_state ADD COLUMN last_kind TEXT NOT NULL DEFAULT 'vote' CHECK (last_kind IN ('vote', 'support'))",
      );
    }
    // Idempotent migration of `is_subscription` on kofi_pending (plan 035). DEFAULT 0 is the
    // conservative backfill for rows already waiting: they stay standalone and cannot move the
    // email binding. Every pending row that predates this is a Shop order or a first payment
    // that nobody has claimed yet — treating those as "not a subscription" only ever narrows
    // what a claim touches, so no existing pending purchase can be over-applied. No-op on new
    // DBs (the CREATE above already has it).
    const kpCols = db.pragma('table_info(kofi_pending)') as Array<{ name: string }>;
    if (!kpCols.some((c) => c.name === 'is_subscription')) {
      db.exec('ALTER TABLE kofi_pending ADD COLUMN is_subscription INTEGER NOT NULL DEFAULT 0');
    }
    // Migracao idempotente: kofi_supporter passou a indexar por HASH do email (minimizacao
    // de PII). A coluna antiga `email` (email em claro) renomeia-se para `email_hash`. Em DBs
    // novas o CREATE ja tem email_hash (no-op). A tabela e uma cache reconstruivel (o Ko-fi
    // reenvia o email nas renovacoes), por isso linhas antigas em claro que sobrem sao inertes
    // (o lookup passa a ser por hash e nunca casa com um email em claro).
    const ksCols = db.pragma('table_info(kofi_supporter)') as Array<{ name: string }>;
    if (ksCols.some((c) => c.name === 'email') && !ksCols.some((c) => c.name === 'email_hash')) {
      db.exec('ALTER TABLE kofi_supporter RENAME COLUMN email TO email_hash');
    }

    // Migracao idempotente: a voz Piper de Portugues europeu (pt_PT-tugao-medium) foi
    // RETIRADA das opcoes — fica so o pt-PT do Google (e do Kokoro para quem o usa). As
    // prefs ja gravadas que a apontavam migram para a voz pt-PT do Google
    // (pt_PT-google-medium), mesma lingua, servida pelo motor default. Apos correr uma vez
    // nao ha mais linhas a migrar (no-op). Cobre a voz por-user e a default da guild.
    db.exec(
      "UPDATE user_voice SET voice_model = 'pt_PT-google-medium' WHERE voice_model = 'pt_PT-tugao-medium'",
    );
    db.exec(
      "UPDATE guild_config SET default_voice = 'pt_PT-google-medium' WHERE default_voice = 'pt_PT-tugao-medium'",
    );

    // Language-detection opt-in toggle (/voice detection): one row per (guild,user) that
    // turned it ON; no row => OFF (the default fixed voice). Recreated idempotently (a
    // prior build had DROP'd it). The legacy tts_lang_detect_off table stays dropped.
    db.exec('DROP TABLE IF EXISTS tts_lang_detect_off');
    db.exec(`CREATE TABLE IF NOT EXISTS tts_lang_detect_on (
      guild_id TEXT NOT NULL,
      user_id  TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )`);

    return db;
  } catch (err) {
    // Se abrimos o handle antes de o schema falhar, fechamo-lo para nao deixar o
    // ficheiro bloqueado (Windows) nem o handle pendurado.
    try {
      db?.close();
    } catch {
      // ignorar
    }
    // Mensagem clara em vez de stack trace cru (caminho invalido/sem permissoes,
    // ou ficheiro existente que nao e uma base de dados SQLite valida).
    throw new Error(`Failed to open the database at ${path}: ${(err as Error).message}`, {
      cause: err,
    });
  }
}
