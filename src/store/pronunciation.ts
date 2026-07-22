import type Database from 'better-sqlite3';
import type { PronunciationEntry } from '../textCleaning/pronunciation';
// CACHED table (read on every message): every setter MUST call invalidate.
import { cached, invalidate } from './cache';

// Two pronunciation dictionaries:
//  • PERSONAL (/pronunciation, pronunciation_user table): only affects the author's
//    own messages; global (follows the user); limit 3 Free / 50 Premium.
//  • SERVER (/server-pronunciation, pronunciation table): affects the WHOLE guild (admin);
//    limit 3 Free / 50 with the guild Premium. In the pipeline the PERSONAL one is applied
//    first (the user's term wins) and then the server one.

/** Personal pronunciation limits per plan. */
export const USER_PRON_LIMIT_FREE = 3;
export const USER_PRON_LIMIT_PREMIUM = 50;
/** SERVER pronunciation limits per guild plan. */
export const SERVER_PRON_LIMIT = 3;
export const SERVER_PRON_LIMIT_PREMIUM = 50;

export type AddPronResult = 'ok' | 'limit';

// ── SERVER dictionary (/server-pronunciation, admin) ──────────────────────────────

export function getServerPronunciations(
  db: Database.Database,
  guildId: string,
): PronunciationEntry[] {
  const rows = cached(db, 'pronunciation', guildId, () => {
    return db
      .prepare('SELECT term, replacement FROM pronunciation WHERE guild_id = ? ORDER BY term ASC')
      .all(guildId) as PronunciationEntry[];
  });
  return rows.map((e) => ({ ...e }));
}

/** Adds/edits a server pronunciation. Editing does not count toward the limit (it's an UPDATE). */
export function addServerPronunciation(
  db: Database.Database,
  guildId: string,
  term: string,
  replacement: string,
  limit: number,
): AddPronResult {
  const exists = db
    .prepare('SELECT 1 FROM pronunciation WHERE guild_id = ? AND term = ?')
    .get(guildId, term);
  if (!exists) {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM pronunciation WHERE guild_id = ?')
      .get(guildId) as { n: number };
    if (row.n >= limit) return 'limit';
  }
  db.prepare(
    `INSERT INTO pronunciation (guild_id, term, replacement) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, term) DO UPDATE SET replacement = excluded.replacement`,
  ).run(guildId, term, replacement);
  invalidate(db, 'pronunciation', guildId);
  return 'ok';
}

/** Removes a server pronunciation. Returns true if it existed. */
export function removeServerPronunciation(
  db: Database.Database,
  guildId: string,
  term: string,
): boolean {
  const res = db
    .prepare('DELETE FROM pronunciation WHERE guild_id = ? AND term = ?')
    .run(guildId, term);
  if (res.changes > 0) invalidate(db, 'pronunciation', guildId);
  return res.changes > 0;
}

// ── PERSONAL dictionary (/pronunciation) ───────────────────────────────────────────────

export function getUserPronunciations(db: Database.Database, userId: string): PronunciationEntry[] {
  const rows = cached(db, 'pronunciation_user', userId, () => {
    return db
      .prepare(
        'SELECT term, replacement FROM pronunciation_user WHERE user_id = ? ORDER BY term ASC',
      )
      .all(userId) as PronunciationEntry[];
  });
  return rows.map((e) => ({ ...e }));
}

export type AddUserPronResult = 'ok' | 'limit';

/**
 * Adds/edits a personal pronunciation. EDITING an existing term never counts toward the
 * limit (it's an UPDATE); only NEW entries are blocked when the user is already at the cap.
 */
export function addUserPronunciation(
  db: Database.Database,
  userId: string,
  term: string,
  replacement: string,
  limit: number,
): AddUserPronResult {
  const exists = db
    .prepare('SELECT 1 FROM pronunciation_user WHERE user_id = ? AND term = ?')
    .get(userId, term);
  if (!exists) {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM pronunciation_user WHERE user_id = ?')
      .get(userId) as { n: number };
    if (row.n >= limit) return 'limit';
  }
  db.prepare(
    `INSERT INTO pronunciation_user (user_id, term, replacement) VALUES (?, ?, ?)
     ON CONFLICT(user_id, term) DO UPDATE SET replacement = excluded.replacement`,
  ).run(userId, term, replacement);
  invalidate(db, 'pronunciation_user', userId);
  return 'ok';
}

/** Removes a personal pronunciation. Returns true if it existed. */
export function removeUserPronunciation(
  db: Database.Database,
  userId: string,
  term: string,
): boolean {
  const res = db
    .prepare('DELETE FROM pronunciation_user WHERE user_id = ? AND term = ?')
    .run(userId, term);
  if (res.changes > 0) invalidate(db, 'pronunciation_user', userId);
  return res.changes > 0;
}
