import type Database from 'better-sqlite3';
// CACHED table (read on every message): every setter MUST call invalidate.
import { cached, invalidate } from './cache';

// PHONETIC nickname per-(guild,user) for the xsaid announcement: names full of emojis/
// symbols ("🔥xX_Pro_Xx🔥") are unreadable out loud; the user sets here how they want to
// be CALLED. Empty/absent => falls back to displayName (sanitized).

const keyOf = (guildId: string, userId: string): string => `${guildId}:${userId}`;

export function getNickname(db: Database.Database, guildId: string, userId: string): string | null {
  return cached(db, 'user_nickname', keyOf(guildId, userId), () => {
    const row = db
      .prepare('SELECT nickname FROM user_nickname WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId) as { nickname: string } | undefined;
    return row ? row.nickname : null;
  });
}

export function setNickname(
  db: Database.Database,
  guildId: string,
  userId: string,
  nickname: string,
): void {
  db.prepare(
    `INSERT INTO user_nickname (guild_id, user_id, nickname)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET nickname = excluded.nickname`,
  ).run(guildId, userId, nickname);
  invalidate(db, 'user_nickname', keyOf(guildId, userId));
}

export function clearNickname(db: Database.Database, guildId: string, userId: string): void {
  db.prepare('DELETE FROM user_nickname WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  invalidate(db, 'user_nickname', keyOf(guildId, userId));
}
