import type Database from 'better-sqlite3';

// Voice-session persistence per guild. It supports Premium 24/7 and recovery after a planned
// deploy, systemctl restart, or normal VPS reboot. Every live session writes its current
// channel; normal exits delete it, while a clean shutdown preserves it.

export interface VoicePresenceRow {
  guildId: string;
  channelId: string;
  updatedAt: number;
}

/** Records/updates (upsert) the channel the bot is in for this guild. */
export function rememberVoicePresence(
  db: Database.Database,
  guildId: string,
  channelId: string,
  now: number,
): void {
  db.prepare(
    `INSERT INTO voice_presence (guild_id, channel_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, updated_at = excluded.updated_at`,
  ).run(guildId, channelId, now);
}

/** Forgets this guild's presence. Idempotent (no-op if it doesn't exist). */
export function forgetVoicePresence(db: Database.Database, guildId: string): void {
  db.prepare('DELETE FROM voice_presence WHERE guild_id = ?').run(guildId);
}

/** All persisted presences (for the rejoin on startup). */
export function listVoicePresence(db: Database.Database): VoicePresenceRow[] {
  const rows = db.prepare('SELECT guild_id, channel_id, updated_at FROM voice_presence').all() as {
    guild_id: string;
    channel_id: string;
    updated_at: number;
  }[];
  return rows.map((r) => ({
    guildId: r.guild_id,
    channelId: r.channel_id,
    updatedAt: r.updated_at,
  }));
}
