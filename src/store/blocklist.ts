import type Database from 'better-sqlite3';
// CACHED table (read on every message): every setter MUST call invalidate.
import { cached, invalidate } from './cache';

interface WordRow {
  word: string;
}

/** Cap on blocked words per guild — limits growth and the per-message read cost
 *  (each word is a scan; see moderation/filter). Admin-gated, but not unlimited. */
export const MAX_BLOCKWORDS = 500;

export function getBlocklist(db: Database.Database, guildId: string): string[] {
  const words = cached(db, 'blocklist', guildId, () => {
    const rows = db
      .prepare('SELECT word FROM blocklist WHERE guild_id = ? ORDER BY word ASC')
      .all(guildId) as WordRow[];
    return rows.map((r) => r.word);
  });
  return [...words]; // copy: the caller must not mutate the cached array
}

export function addBlockword(db: Database.Database, guildId: string, word: string): 'ok' | 'limit' {
  const { c } = db
    .prepare('SELECT COUNT(*) AS c FROM blocklist WHERE guild_id = ?')
    .get(guildId) as { c: number };
  if (c >= MAX_BLOCKWORDS) return 'limit';
  db.prepare(
    `INSERT INTO blocklist (guild_id, word) VALUES (?, ?)
     ON CONFLICT(guild_id, word) DO NOTHING`,
  ).run(guildId, word);
  invalidate(db, 'blocklist', guildId);
  return 'ok';
}

export function removeBlockword(db: Database.Database, guildId: string, word: string): void {
  db.prepare('DELETE FROM blocklist WHERE guild_id = ? AND word = ?').run(guildId, word);
  invalidate(db, 'blocklist', guildId);
}
