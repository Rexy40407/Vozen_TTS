import type Database from 'better-sqlite3';
// Cached table read on every message; every setter must invalidate it.
import { cached, invalidate } from './cache';

/**
 * User-selected engine. The historical `google` value now means the operator-configured
 * default for database compatibility; that default is local Piper unless explicitly changed.
 */
export type UserEngine = 'google' | 'piper' | 'kokoro' | 'gcloud';

interface UserVoiceRow {
  voice_model: string;
  speed: number;
  engine: string | null;
}

const keyOf = (guildId: string, userId: string): string => `${guildId}:${userId}`;

export function getUserVoice(
  db: Database.Database,
  guildId: string,
  userId: string,
): { model: string; speed: number; engine: UserEngine } | null {
  const row = cached(db, 'user_voice', keyOf(guildId, userId), () => {
    const r = db
      .prepare(
        'SELECT voice_model, speed, engine FROM user_voice WHERE guild_id = ? AND user_id = ?',
      )
      .get(guildId, userId) as UserVoiceRow | undefined;
    if (!r) return null;
    // The column is NOT NULL; unknown legacy values use the configured-default route.
    return {
      model: r.voice_model,
      speed: r.speed,
      engine:
        r.engine === 'piper'
          ? 'piper'
          : r.engine === 'kokoro'
            ? 'kokoro'
            : r.engine === 'gcloud'
              ? 'gcloud'
              : 'google',
    } as {
      model: string;
      speed: number;
      engine: UserEngine;
    };
  });
  return row ? { ...row } : null; // Return a copy so callers cannot mutate cached state.
}

export function setUserVoice(
  db: Database.Database,
  guildId: string,
  userId: string,
  model: string,
  speed: number,
  engine: UserEngine = 'google',
): void {
  db.prepare(
    `INSERT INTO user_voice (guild_id, user_id, voice_model, speed, engine)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id)
     DO UPDATE SET voice_model = excluded.voice_model, speed = excluded.speed, engine = excluded.engine`,
  ).run(guildId, userId, model, speed, engine);
  invalidate(db, 'user_voice', keyOf(guildId, userId));
}

export function resetUserVoice(db: Database.Database, guildId: string, userId: string): void {
  db.prepare('DELETE FROM user_voice WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  invalidate(db, 'user_voice', keyOf(guildId, userId));
}
