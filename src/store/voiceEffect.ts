import type Database from 'better-sqlite3';
import { isVoiceEffect, type VoiceEffect } from '../tts/effects';
// CACHED table (read on every message): every setter MUST call invalidate.
import { cached, invalidate } from './cache';

// Per-(guild,user) voice effect: the filter applied to that person's read messages
// (robot/echo/deep...). Absent/'none' => clean voice. An invalid value reads as 'none'.
// The premium GATE is validated in the /voice effect command (when SAVING), not here.

const keyOf = (guildId: string, userId: string): string => `${guildId}:${userId}`;

export function getVoiceEffect(
  db: Database.Database,
  guildId: string,
  userId: string,
): VoiceEffect {
  return cached(db, 'user_effect', keyOf(guildId, userId), () => {
    const row = db
      .prepare('SELECT effect FROM user_effect WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId) as { effect: string } | undefined;
    if (!row || !isVoiceEffect(row.effect)) return 'none';
    return row.effect;
  });
}

export function setVoiceEffect(
  db: Database.Database,
  guildId: string,
  userId: string,
  effect: VoiceEffect,
): void {
  if (effect === 'none') {
    clearVoiceEffect(db, guildId, userId);
    return;
  }
  db.prepare(
    `INSERT INTO user_effect (guild_id, user_id, effect)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET effect = excluded.effect`,
  ).run(guildId, userId, effect);
  invalidate(db, 'user_effect', keyOf(guildId, userId));
}

export function clearVoiceEffect(db: Database.Database, guildId: string, userId: string): void {
  db.prepare('DELETE FROM user_effect WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  invalidate(db, 'user_effect', keyOf(guildId, userId));
}
