import type Database from 'better-sqlite3';

export const MAX_VOICE_FAVORITES = 25;
export const MAX_RECENT_VOICES = 10;

function valid(value: string): boolean {
  return value.trim().length > 0 && value.length <= 100;
}

export function listVoiceFavorites(db: Database.Database, userId: string): string[] {
  return (
    db
      .prepare(
        `SELECT voice_model AS model FROM user_voice_favorite
         WHERE user_id = ? ORDER BY created_at DESC, voice_model ASC`,
      )
      .all(userId) as Array<{ model: string }>
  ).map((row) => row.model);
}

export function addVoiceFavorite(
  db: Database.Database,
  userId: string,
  model: string,
  createdAt = Date.now(),
): boolean {
  if (!valid(userId) || !valid(model) || !Number.isFinite(createdAt)) return false;
  const existing = db
    .prepare('SELECT 1 FROM user_voice_favorite WHERE user_id = ? AND voice_model = ?')
    .get(userId, model);
  if (!existing) {
    const count = (
      db
        .prepare('SELECT COUNT(*) AS count FROM user_voice_favorite WHERE user_id = ?')
        .get(userId) as {
        count: number;
      }
    ).count;
    if (count >= MAX_VOICE_FAVORITES) return false;
  }
  db.prepare(
    `INSERT INTO user_voice_favorite (user_id, voice_model, created_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id, voice_model) DO UPDATE SET created_at = excluded.created_at`,
  ).run(userId, model, Math.floor(createdAt));
  return true;
}

export function removeVoiceFavorite(db: Database.Database, userId: string, model: string): boolean {
  return (
    db
      .prepare('DELETE FROM user_voice_favorite WHERE user_id = ? AND voice_model = ?')
      .run(userId, model).changes === 1
  );
}

export function listRecentVoices(db: Database.Database, userId: string): string[] {
  return (
    db
      .prepare(
        `SELECT voice_model AS model FROM user_voice_recent
         WHERE user_id = ? ORDER BY used_at DESC, voice_model ASC LIMIT ?`,
      )
      .all(userId, MAX_RECENT_VOICES) as Array<{ model: string }>
  ).map((row) => row.model);
}

export function recordRecentVoice(
  db: Database.Database,
  userId: string,
  model: string,
  usedAt = Date.now(),
): void {
  if (!valid(userId) || !valid(model) || !Number.isFinite(usedAt)) return;
  const update = db.transaction(() => {
    db.prepare(
      `INSERT INTO user_voice_recent (user_id, voice_model, used_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, voice_model) DO UPDATE SET used_at = excluded.used_at`,
    ).run(userId, model, Math.floor(usedAt));
    db.prepare(
      `DELETE FROM user_voice_recent WHERE user_id = ? AND voice_model NOT IN (
         SELECT voice_model FROM user_voice_recent WHERE user_id = ?
         ORDER BY used_at DESC, voice_model ASC LIMIT ?
       )`,
    ).run(userId, userId, MAX_RECENT_VOICES);
  });
  update();
}
