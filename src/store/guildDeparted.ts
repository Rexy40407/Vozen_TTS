// src/store/guildDeparted.ts
//
// Per-GUILD data retention (compliance §5(b)): when the bot is removed from a
// guild, the departure is marked. If the guild does not re-invite the bot within 30 days, its
// data is purged by a daily job. The grace period exists so an accidental kick or a
// guild migration does not wipe everything immediately.
//
// IMPORTANT: the mark comes from the REAL GuildDelete handler (client.ts), which already ignores
// outages (guild.available === false). This way a transient Discord outage never schedules
// data deletion for guilds that did not actually leave.
import type Database from 'better-sqlite3';
import { purgeGuild } from './dataLifecycle';

/** Window between departure and data purge (30 days). */
export const DEPARTURE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/** Marks (or re-marks) the moment the bot left a guild. */
export function markGuildDeparted(db: Database.Database, guildId: string, now: number): void {
  db.prepare(
    `INSERT INTO guild_departed (guild_id, left_at) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET left_at = excluded.left_at`,
  ).run(guildId, now);
}

/** Removes the departure mark (bot re-invited before the purge). */
export function unmarkGuildDeparted(db: Database.Database, guildId: string): void {
  db.prepare('DELETE FROM guild_departed WHERE guild_id = ?').run(guildId);
}

/**
 * Purges data for guilds whose departure was more than `graceMs` ago. For each one it calls
 * `purgeGuild` (deletes content/config/stats, keeps the financial data) and clears the mark.
 * Returns the purged guildIds (for logging). Idempotent: running twice repeats nothing.
 */
export function purgeDepartedGuilds(
  db: Database.Database,
  now: number,
  graceMs: number = DEPARTURE_GRACE_MS,
): string[] {
  const cutoff = now - graceMs;
  const rows = db.prepare('SELECT guild_id FROM guild_departed WHERE left_at <= ?').all(cutoff) as {
    guild_id: string;
  }[];
  const purged: string[] = [];
  for (const { guild_id: guildId } of rows) {
    purgeGuild(db, guildId); // deletes everything, incl. the mark itself (guild_departed ∈ purge)
    unmarkGuildDeparted(db, guildId); // safety net in case the mark survives
    purged.push(guildId);
  }
  return purged;
}

/** Purge job interval (once per day). */
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the purge job: runs once at startup and then every 24h. Never throws (an error
 * in one run must not bring the bot down). The timer is unref'd (does not keep the process
 * alive). Returns a `stop()` for tests/shutdown. The pure logic lives in `purgeDepartedGuilds`.
 */
export function startDepartedPurgeJob(
  db: Database.Database,
  onPurged: (guildIds: string[]) => void,
): () => void {
  const tick = (): void => {
    try {
      const ids = purgeDepartedGuilds(db, Date.now());
      if (ids.length > 0) onPurged(ids);
    } catch {
      // best-effort: never crash the maintenance loop.
    }
  };
  tick();
  const timer = setInterval(tick, PURGE_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return () => clearInterval(timer);
}
