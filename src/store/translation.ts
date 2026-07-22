import type Database from 'better-sqlite3';
import { isGuildPremium, isUserPremium } from './premium';

export interface TranslationMapping {
  guildId: string;
  sourceChannelId: string;
  destinationChannelId: string;
  targetLocale: string;
}

export interface TranslationPreference {
  guildId: string;
  userId: string;
  optedOut: boolean;
  locale: string | null;
  speakLocale: string | null;
}

export type TranslationReservation =
  { ok: true; chars: number; day: string } | { ok: false; reason: 'guild_quota' | 'user_quota' };

export function utcDayKey(now = Date.now()): string {
  if (!Number.isFinite(now)) throw new Error('Translation timestamp must be finite');
  return new Date(now).toISOString().slice(0, 10);
}

function rollingWindowStart(day: string): string {
  const parsed = Date.parse(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed))
    throw new Error('Translation day must be UTC YYYY-MM-DD');
  return new Date(parsed - 29 * 86_400_000).toISOString().slice(0, 10);
}

/** Published rolling 30-day caps. Paid entitlements raise capacity, never authorization. */
export function resolveTranslationLimits(
  db: Database.Database,
  guildId: string | null,
  userId: string,
  now = Date.now(),
): { guildLimit: number; userLimit: number } {
  const plus = isUserPremium(db, userId, now);
  const premium = guildId ? isGuildPremium(db, guildId, now) : false;
  return {
    guildLimit: premium ? 500_000 : 100_000,
    userLimit: plus || premium ? 100_000 : 10_000,
  };
}

export function listTranslationMappings(
  db: Database.Database,
  guildId: string,
): TranslationMapping[] {
  return db
    .prepare(
      `SELECT guild_id AS guildId, source_channel_id AS sourceChannelId,
              destination_channel_id AS destinationChannelId, target_locale AS targetLocale
       FROM translation_mapping WHERE guild_id = ? ORDER BY source_channel_id`,
    )
    .all(guildId) as TranslationMapping[];
}

export function getTranslationMapping(
  db: Database.Database,
  guildId: string,
  sourceChannelId: string,
): TranslationMapping | undefined {
  return db
    .prepare(
      `SELECT guild_id AS guildId, source_channel_id AS sourceChannelId,
              destination_channel_id AS destinationChannelId, target_locale AS targetLocale
       FROM translation_mapping WHERE guild_id = ? AND source_channel_id = ?`,
    )
    .get(guildId, sourceChannelId) as TranslationMapping | undefined;
}

export function addTranslationMapping(db: Database.Database, mapping: TranslationMapping): void {
  if (
    !mapping.guildId ||
    !mapping.sourceChannelId ||
    !mapping.destinationChannelId ||
    !mapping.targetLocale ||
    mapping.sourceChannelId === mapping.destinationChannelId
  )
    throw new Error('Invalid translation mapping');
  const cycle = db
    .prepare(
      `SELECT 1 FROM translation_mapping
       WHERE guild_id = ? AND source_channel_id = ? AND destination_channel_id = ?`,
    )
    .get(mapping.guildId, mapping.destinationChannelId, mapping.sourceChannelId);
  if (cycle) throw new Error('Translation mapping would create a cycle');
  db.prepare(
    `INSERT INTO translation_mapping (guild_id, source_channel_id, destination_channel_id, target_locale)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, source_channel_id) DO UPDATE SET
       destination_channel_id = excluded.destination_channel_id,
       target_locale = excluded.target_locale`,
  ).run(
    mapping.guildId,
    mapping.sourceChannelId,
    mapping.destinationChannelId,
    mapping.targetLocale,
  );
}

export function removeTranslationMapping(
  db: Database.Database,
  guildId: string,
  sourceChannelId: string,
): boolean {
  return (
    db
      .prepare('DELETE FROM translation_mapping WHERE guild_id = ? AND source_channel_id = ?')
      .run(guildId, sourceChannelId).changes === 1
  );
}

export function clearTranslationConfig(db: Database.Database, guildId: string): void {
  const run = db.transaction((id: string) => {
    db.prepare('DELETE FROM translation_mapping WHERE guild_id = ?').run(id);
    db.prepare('DELETE FROM translation_preference WHERE guild_id = ?').run(id);
  });
  run(guildId);
}

export function getTranslationPreference(
  db: Database.Database,
  guildId: string,
  userId: string,
): TranslationPreference {
  const row = db
    .prepare(
      `SELECT opted_out AS optedOut, locale, speak_locale AS speakLocale
       FROM translation_preference
       WHERE guild_id = ? AND user_id = ?`,
    )
    .get(guildId, userId) as
    { optedOut: number; locale: string | null; speakLocale: string | null } | undefined;
  return {
    guildId,
    userId,
    optedOut: row?.optedOut === 1,
    locale: row?.locale ?? null,
    speakLocale: row?.speakLocale ?? null,
  };
}

export function setTranslationPreference(
  db: Database.Database,
  preference: Pick<TranslationPreference, 'guildId' | 'userId' | 'optedOut'> &
    Partial<Pick<TranslationPreference, 'locale' | 'speakLocale'>>,
): void {
  const current = getTranslationPreference(db, preference.guildId, preference.userId);
  db.prepare(
    `INSERT INTO translation_preference (guild_id, user_id, locale, speak_locale, opted_out)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       locale = excluded.locale,
       speak_locale = excluded.speak_locale,
       opted_out = excluded.opted_out`,
  ).run(
    preference.guildId,
    preference.userId,
    preference.locale === undefined ? current.locale : preference.locale,
    preference.speakLocale === undefined ? current.speakLocale : preference.speakLocale,
    preference.optedOut ? 1 : 0,
  );
}

/** Atomically reserves guild and per-user characters in the rolling 30-day window. */
export function reserveTranslationChars(
  db: Database.Database,
  input: {
    guildId: string;
    userId: string;
    chars: number;
    guildLimit: number;
    userLimit: number;
    day?: string;
  },
): TranslationReservation {
  const { guildId, userId, chars, guildLimit, userLimit } = input;
  if (!Number.isInteger(chars) || chars <= 0)
    throw new Error('Translation chars must be a positive integer');
  if (
    !Number.isInteger(guildLimit) ||
    guildLimit < 0 ||
    !Number.isInteger(userLimit) ||
    userLimit < 0
  )
    throw new Error('Translation limits must be non-negative integers');
  const day = input.day ?? utcDayKey();
  const windowStart = rollingWindowStart(day);
  class Denied extends Error {
    constructor(readonly reason: 'guild_quota' | 'user_quota') {
      super(reason);
    }
  }
  const reserve = db.transaction(() => {
    const guildUsed = (
      db
        .prepare(
          `SELECT COALESCE(SUM(chars), 0) AS used FROM translation_daily_usage
           WHERE guild_id = ? AND day BETWEEN ? AND ?`,
        )
        .get(guildId, windowStart, day) as { used: number }
    ).used;
    if (guildUsed + chars > guildLimit) throw new Denied('guild_quota');
    const userUsed = (
      db
        .prepare(
          `SELECT COALESCE(SUM(chars), 0) AS used FROM translation_user_daily_usage
           WHERE guild_id = ? AND user_id = ? AND day BETWEEN ? AND ?`,
        )
        .get(guildId, userId, windowStart, day) as { used: number }
    ).used;
    if (userUsed + chars > userLimit) throw new Denied('user_quota');
    db.prepare(
      `INSERT INTO translation_daily_usage (day, guild_id, chars) VALUES (?, ?, ?)
       ON CONFLICT(day, guild_id) DO UPDATE SET chars = chars + excluded.chars`,
    ).run(day, guildId, chars);
    db.prepare(
      `INSERT INTO translation_user_daily_usage (day, guild_id, user_id, chars) VALUES (?, ?, ?, ?)
       ON CONFLICT(day, guild_id, user_id) DO UPDATE SET chars = chars + excluded.chars`,
    ).run(day, guildId, userId, chars);
  });
  try {
    reserve();
    return { ok: true, chars, day };
  } catch (err) {
    if (err instanceof Denied) return { ok: false, reason: err.reason };
    throw err;
  }
}

/** Refunds exactly a reservation after a provider error; never permits negative counters. */
export function refundTranslationChars(
  db: Database.Database,
  reservation: Extract<TranslationReservation, { ok: true }>,
  guildId: string,
  userId: string,
): void {
  const refund = db.transaction(() => {
    db.prepare(
      'UPDATE translation_daily_usage SET chars = MAX(0, chars - ?) WHERE day = ? AND guild_id = ?',
    ).run(reservation.chars, reservation.day, guildId);
    db.prepare(
      'UPDATE translation_user_daily_usage SET chars = MAX(0, chars - ?) WHERE day = ? AND guild_id = ? AND user_id = ?',
    ).run(reservation.chars, reservation.day, guildId, userId);
  });
  refund();
}
