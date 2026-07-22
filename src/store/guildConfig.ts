import type Database from 'better-sqlite3';
import { DEFAULT_LOCALE } from '../i18n/index';
// CACHED table (read on every message): every setter MUST call invalidate.
import { cached, invalidate } from './cache';

export interface GuildConfig {
  ttsChannelId: string | null;
  autoread: boolean;
  defaultVoice: string;
  maxChars: number;
  ratePerMin: number;
  enabled: boolean;
  ttsRoleId: string | null;
  // INTERFACE (text) language per guild. 'en' = default/base. Independent of the
  // VOICE/TTS language. See src/i18n. P16.1: column + storage; the switch command
  // is P16.3.
  locale: string;
  // xsaid: announce "{name} said" before each read message (who spoke). ON
  // by default (Diogo's decision); can be turned off with /config x-said. The announcement is
  // localized in the voice language (spokenPhrases.said).
  xsaid: boolean;
  // autojoin: Vozen joins the author's voice channel by itself when a message arrives
  // to be read and it is not in a call yet. OFF by default (opt-in).
  autojoin: boolean;
  // readBots: read messages from OTHER bots/webhooks (e.g. bridges, notifications).
  // OFF by default (historic behavior: ignores bots). Vozen NEVER
  // reads itself, regardless of this (anti-loop).
  readBots: boolean;
  // textInVoice: also read messages from the text chat EMBEDDED in the voice channel where
  // Vozen is (Discord voice-channel text). OFF by default.
  textInVoice: boolean;
  // greetOnJoin: Vozen says "Hi {name}" when someone JOINS the voice channel it
  // is in. ON by default (can be turned off with /config greet). greetLocale = greeting
  // language (the main one is always English, 'en').
  greetOnJoin: boolean;
  greetLocale: string;
  // antispam: when ON, Vozen does not read spammed messages — massive repetition of the
  // same word/phrase (e.g. "POKEBOLAS ×39") nor the same large message repeated in a
  // short window. OFF by default (opt-in). See src/moderation/antispam.
  antispam: boolean;
  // stayInCall: 24/7 in-call — Vozen stays in the voice channel even when it empties (does not leave
  // for being alone) and is restored at startup after restarts/deploys. OFF by default
  // (opt-in, even with Premium — the person turns it on with /config always-on). It only takes EFFECT if the
  // guild is Premium (the gate in AloneWatcher/rejoin requires Premium AND this toggle).
  stayInCall: boolean;
  // streakAnnounce: show the "🔥 Day N" notice on each person's FIRST read message of the day
  // (streak of consecutive days, TikTok style). ON by default; turned off with
  // /config streaks. The streak itself is always computed (feeds /top-speakers).
  streakAnnounce: boolean;
  // soundboard: enables /sound (sound clips in the call). ON by default; an admin
  // can turn it off with /config soundboard. The per-user rate-limit already limits
  // spam; this toggle is the per-server kill-switch.
  soundboard: boolean;
  // votePromos: alternating Top.gg reward and Vozen support notices in the configured
  // TTS channel. OFF by default and enabled only by a server admin through
  // /config vote-reminders. Never sends DMs or mentions.
  votePromos: boolean;
  /** Accessibility queue lane. Admin-configured role only; entitlement never grants this. */
  priorityRoleId: string | null;
  /** Hard queue denial role. Takes precedence over priority and every caller option. */
  blockedRoleId: string | null;
  /** Translation is default-deny and needs both this flag and a valid mapping. */
  translationEnabled: boolean;
  /** Atomic daily character cap shared by all translation mappings in this guild. */
  translationDailyCharLimit: number;
  /** Daily per-member cap, applied before any external provider request. */
  translationPerUserDailyCharLimit: number;
}

const DEFAULTS: GuildConfig = {
  ttsChannelId: null,
  autoread: false,
  // Empty = the guild has not set a default voice; the precedence in resolveSynth then
  // falls to config.defaultVoice (.env). See /config default-voice.
  defaultVoice: '',
  maxChars: 300,
  ratePerMin: 8,
  enabled: true,
  ttsRoleId: null,
  locale: DEFAULT_LOCALE, // 'en' — English as the default interface language
  xsaid: true, // announce "{name} said" ON by default
  autojoin: false, // auto-join the call OFF by default (opt-in)
  readBots: false, // do NOT read other bots by default (historic behavior)
  textInVoice: false, // do NOT read voice-channel text chat by default (opt-in)
  greetOnJoin: true, // greet whoever joins the call ON by default
  greetLocale: DEFAULT_LOCALE, // 'en' — English as the default greeting language
  antispam: false, // do NOT filter spam by default (opt-in, Diogo's decision)
  stayInCall: false, // 24/7 in-call OFF by default (opt-in, even with Premium)
  streakAnnounce: true, // streak 🔥 notice ON by default
  soundboard: true, // /sound ON by default (admin turns off with /config soundboard)
  votePromos: false, // alternating Top.gg/support notices OFF by default; admin must opt in
  priorityRoleId: null,
  blockedRoleId: null,
  translationEnabled: false,
  translationDailyCharLimit: 10_000,
  translationPerUserDailyCharLimit: 2_000,
};

interface GuildConfigRow {
  guild_id: string;
  tts_channel_id: string | null;
  autoread: number;
  default_voice: string;
  max_chars: number;
  rate_per_min: number;
  enabled: number;
  tts_role_id: string | null;
  locale: string | null;
  xsaid: number | null;
  autojoin: number | null;
  read_bots: number | null;
  text_in_voice: number | null;
  greet_on_join: number | null;
  greet_locale: string | null;
  antispam: number | null;
  stay_in_call: number | null;
  streak_announce: number | null;
  soundboard: number | null;
  vote_promos: number | null;
  priority_role_id: string | null;
  blocked_role_id: string | null;
  translation_enabled: number | null;
  translation_daily_char_limit: number | null;
  translation_per_user_daily_char_limit: number | null;
}

type SqlValue = string | number | null;

/**
 * Descriptor for ONE guild_config column. ADDING A NEW FIELD =
 *   1) an entry here,
 *   2) the field in `GuildConfig`,
 *   3) the field in `GuildConfigRow`,
 *   4) the default in `DEFAULTS`,
 *   5) the column in `db.ts`'s CREATE TABLE.
 * The parity tests in tests/store.test.ts blow up if any of the five
 * is missing — that is the point. The idempotent migration (ALTER) and the UPSERT are
 * DERIVED from this array; there is no hand-written SQL per field.
 */
interface GuildConfigColumn {
  /** property name in GuildConfig */
  prop: keyof GuildConfig;
  /** SQL column name */
  column: string;
  /** type+constraints for the migration ALTER (identical to CREATE TABLE) */
  sqlType: string;
  /** JS -> SQL (booleans become 1/0; strings/numbers/null pass as-is) */
  toDb: (v: unknown) => SqlValue;
  /** SQL -> JS with the defensive per-column fallback (old DBs may have null) */
  fromDb: (raw: unknown) => unknown;
}

const asBool = (v: unknown): SqlValue => (v ? 1 : 0);
const asIs = (v: unknown): SqlValue => v as SqlValue;

// Order = column order in CREATE TABLE (without `guild_id`, which is the PK and is
// handled separately in the INSERT/migration). Keep the order for readable diffs.
export const GUILD_CONFIG_COLUMNS: GuildConfigColumn[] = [
  { prop: 'ttsChannelId', column: 'tts_channel_id', sqlType: 'TEXT', toDb: asIs, fromDb: (r) => r },
  {
    prop: 'autoread',
    column: 'autoread',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => r === 1,
  },
  {
    prop: 'defaultVoice',
    column: 'default_voice',
    sqlType: "TEXT NOT NULL DEFAULT 'en_US-amy-medium'",
    toDb: asIs,
    fromDb: (r) => r,
  },
  {
    prop: 'maxChars',
    column: 'max_chars',
    sqlType: 'INTEGER NOT NULL DEFAULT 300',
    toDb: asIs,
    fromDb: (r) => r,
  },
  {
    prop: 'ratePerMin',
    // DEFAULT 8: aligned with the CREATE TABLE (db.ts) and with DEFAULTS.ratePerMin. It was
    // 5 (inert drift — setGuildConfig always writes the column, the default was never read),
    // now covered by the dflt_value parity test.
    column: 'rate_per_min',
    sqlType: 'INTEGER NOT NULL DEFAULT 8',
    toDb: asIs,
    fromDb: (r) => r,
  },
  {
    prop: 'enabled',
    column: 'enabled',
    sqlType: 'INTEGER NOT NULL DEFAULT 1',
    toDb: asBool,
    fromDb: (r) => r === 1,
  },
  { prop: 'ttsRoleId', column: 'tts_role_id', sqlType: 'TEXT', toDb: asIs, fromDb: (r) => r },
  {
    prop: 'locale',
    column: 'locale',
    sqlType: "TEXT NOT NULL DEFAULT 'en'",
    toDb: asIs,
    fromDb: (r) => r ?? DEFAULT_LOCALE,
  },
  {
    prop: 'xsaid',
    column: 'xsaid',
    sqlType: 'INTEGER NOT NULL DEFAULT 1',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.xsaid : r === 1),
  },
  {
    prop: 'autojoin',
    column: 'autojoin',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.autojoin : r === 1),
  },
  {
    prop: 'readBots',
    column: 'read_bots',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.readBots : r === 1),
  },
  {
    prop: 'textInVoice',
    column: 'text_in_voice',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.textInVoice : r === 1),
  },
  {
    prop: 'greetOnJoin',
    column: 'greet_on_join',
    sqlType: 'INTEGER NOT NULL DEFAULT 1',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.greetOnJoin : r === 1),
  },
  {
    prop: 'greetLocale',
    column: 'greet_locale',
    sqlType: "TEXT NOT NULL DEFAULT 'en'",
    toDb: asIs,
    fromDb: (r) => r ?? DEFAULTS.greetLocale,
  },
  {
    prop: 'antispam',
    column: 'antispam',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.antispam : r === 1),
  },
  {
    prop: 'stayInCall',
    column: 'stay_in_call',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.stayInCall : r === 1),
  },
  {
    prop: 'streakAnnounce',
    column: 'streak_announce',
    sqlType: 'INTEGER NOT NULL DEFAULT 1',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.streakAnnounce : r === 1),
  },
  {
    prop: 'soundboard',
    column: 'soundboard',
    sqlType: 'INTEGER NOT NULL DEFAULT 1',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.soundboard : r === 1),
  },
  {
    prop: 'votePromos',
    column: 'vote_promos',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.votePromos : r === 1),
  },
  {
    prop: 'priorityRoleId',
    column: 'priority_role_id',
    sqlType: 'TEXT',
    toDb: asIs,
    fromDb: (r) => r,
  },
  {
    prop: 'blockedRoleId',
    column: 'blocked_role_id',
    sqlType: 'TEXT',
    toDb: asIs,
    fromDb: (r) => r,
  },
  {
    prop: 'translationEnabled',
    column: 'translation_enabled',
    sqlType: 'INTEGER NOT NULL DEFAULT 0',
    toDb: asBool,
    fromDb: (r) => (r == null ? DEFAULTS.translationEnabled : r === 1),
  },
  {
    prop: 'translationDailyCharLimit',
    column: 'translation_daily_char_limit',
    sqlType: 'INTEGER NOT NULL DEFAULT 10000',
    toDb: asIs,
    fromDb: (r) => r ?? DEFAULTS.translationDailyCharLimit,
  },
  {
    prop: 'translationPerUserDailyCharLimit',
    column: 'translation_per_user_daily_char_limit',
    sqlType: 'INTEGER NOT NULL DEFAULT 2000',
    toDb: asIs,
    fromDb: (r) => r ?? DEFAULTS.translationPerUserDailyCharLimit,
  },
];

// UPSERT derived from the descriptor (built once). Writes ALL columns on
// each set — the byte-for-byte semantics of the previous handwritten one: each column via
// excluded.<column>, booleans already serialized to 1/0 by toDb.
const UPSERT_SQL = (() => {
  const cols = GUILD_CONFIG_COLUMNS.map((c) => c.column);
  const placeholders = ['?', ...cols.map(() => '?')].join(', ');
  const sets = cols.map((c) => `${c} = excluded.${c}`).join(',\n       ');
  return `INSERT INTO guild_config
       (guild_id, ${cols.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(guild_id) DO UPDATE SET
       ${sets}`;
})();

export function getGuildConfig(db: Database.Database, guildId: string): GuildConfig {
  // Shallow copy of the cached value: the caller (e.g. setGuildConfig, /config show) must
  // not mutate the object stored in the cache. The loader returns the immutable object.
  return { ...cached(db, 'guild_config', guildId, () => loadGuildConfig(db, guildId)) };
}

function loadGuildConfig(db: Database.Database, guildId: string): GuildConfig {
  const row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId) as
    GuildConfigRow | undefined;
  if (!row) return { ...DEFAULTS };
  // row->object mapping driven by the descriptor: each column applies its
  // fromDb (with the defensive per-column fallback for old DBs with null).
  const out = {} as Record<string, unknown>;
  const raw = row as unknown as Record<string, unknown>;
  for (const col of GUILD_CONFIG_COLUMNS) {
    out[col.prop] = col.fromDb(raw[col.column]);
  }
  return out as unknown as GuildConfig;
}

export function resetGuildConfig(db: Database.Database, guildId: string): void {
  db.prepare('DELETE FROM guild_config WHERE guild_id = ?').run(guildId);
  invalidate(db, 'guild_config', guildId);
}

export function setGuildConfig(
  db: Database.Database,
  guildId: string,
  patch: Partial<GuildConfig>,
): void {
  const current = getGuildConfig(db, guildId);
  const next: GuildConfig = { ...current, ...patch };
  // Args in the descriptor order (= column order in UPSERT_SQL). Each column's
  // toDb serializes (booleans -> 1/0; the rest as-is).
  db.prepare(UPSERT_SQL).run(guildId, ...GUILD_CONFIG_COLUMNS.map((c) => c.toDb(next[c.prop])));
  invalidate(db, 'guild_config', guildId);
}
