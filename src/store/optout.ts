import type Database from 'better-sqlite3';
// Tabela CACHEADA (lida a cada mensagem): todo o setter TEM de chamar invalidate.
import { cached, invalidate } from './cache';

interface CountRow {
  n: number;
}

const keyOf = (guildId: string, userId: string): string => `${guildId}:${userId}`;

export function isOptedOut(db: Database.Database, guildId: string, userId: string): boolean {
  return cached(db, 'tts_optout', keyOf(guildId, userId), () => {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM tts_optout WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId) as CountRow;
    return row.n > 0;
  });
}

export function setOptOut(db: Database.Database, guildId: string, userId: string): void {
  db.prepare(
    `INSERT INTO tts_optout (guild_id, user_id) VALUES (?, ?)
     ON CONFLICT(guild_id, user_id) DO NOTHING`,
  ).run(guildId, userId);
  invalidate(db, 'tts_optout', keyOf(guildId, userId));
}

export function setOptIn(db: Database.Database, guildId: string, userId: string): void {
  db.prepare('DELETE FROM tts_optout WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  invalidate(db, 'tts_optout', keyOf(guildId, userId));
}
