import type Database from 'better-sqlite3';
// CACHED table (read on every message): every setter MUST call invalidate.
import { cached, invalidate } from './cache';

interface CountRow {
  n: number;
}

const keyOf = (guildId: string, userId: string): string => `${guildId}:${userId}`;

/**
 * Toggle for AUTOMATIC language detection, per (guild, user).
 *
 * DEFAULT = **OFF**: by default the bot uses ONE fixed voice (the one chosen with
 * `/voice set`, else the guild default, else the global default) for ALL languages, so it
 * always sounds like the same person even when a message mixes languages. Foreign words
 * come out in that voice's accent (a Piper limitation: each voice is a speaker of ONE
 * language; there is no multilingual voice).
 *
 * Whoever WANTS a native voice per language (accepting that the speaker changes) opts in
 * with `/voice detection on`. The store keeps a single row for those users (one row => ON;
 * no row => OFF). Mirrors the optout pattern but with the sign INVERTED.
 */
export function isDetectionOn(db: Database.Database, guildId: string, userId: string): boolean {
  return cached(db, 'tts_lang_detect_on', keyOf(guildId, userId), () => {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM tts_lang_detect_on WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId) as CountRow;
    // A row => detection ON (opt-in). No row => OFF (default).
    return row.n > 0;
  });
}

/**
 * Turns detection on (`on=true`) or off (`on=false`) for a (guild, user). Turning it on
 * inserts the row (opt-in, idempotent via ON CONFLICT DO NOTHING); turning it off removes
 * it (back to the OFF default). Symmetric with setOptOut/setOptIn.
 */
export function setDetection(
  db: Database.Database,
  guildId: string,
  userId: string,
  on: boolean,
): void {
  if (on) {
    db.prepare(
      `INSERT INTO tts_lang_detect_on (guild_id, user_id) VALUES (?, ?)
       ON CONFLICT(guild_id, user_id) DO NOTHING`,
    ).run(guildId, userId);
    invalidate(db, 'tts_lang_detect_on', keyOf(guildId, userId));
    return;
  }
  db.prepare('DELETE FROM tts_lang_detect_on WHERE guild_id = ? AND user_id = ?').run(
    guildId,
    userId,
  );
  invalidate(db, 'tts_lang_detect_on', keyOf(guildId, userId));
}
