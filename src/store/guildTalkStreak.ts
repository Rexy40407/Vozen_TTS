import type Database from 'better-sqlite3';
import { dateKey, effectiveStreak, nextStreak } from './talkStats';

// Per-SERVER talk streak: consecutive days on which AT LEAST ONE person spoke (a message the
// bot auto-read). Same Duolingo rules as the per-user streak (shared `nextStreak`/`effectiveStreak`
// from talkStats.ts) — missing 1 day freezes, missing 2 in a row loses it. Owner-only: surfaced
// solely in the admin console's servers tab, never to members. Stores NO message content and no
// per-user data — one row per guild with the streak, its best, and the last active local day.

interface StreakRow {
  streak: number;
  best_streak: number;
  last_date: string;
}

/**
 * Seed for a server's FIRST-ever bump: the best still-alive per-user streak in this guild, floored
 * at 1 (the person speaking today guarantees day 1). An honest LOWER BOUND — if a member has kept
 * an N-day personal streak, the server has demonstrably had activity on those N days, so it must
 * not start at 1. Never inflates (a real gap in the server can only make the true value higher than
 * any single member's). Reads talk_stats, which in production is already fresh for the triggering
 * user (bumpGuildTalk runs right after bumpTalk). PURE over the db. */
function seedFromUsers(db: Database.Database, guildId: string, now: Date): number {
  const rows = db
    .prepare('SELECT streak, last_date FROM talk_stats WHERE guild_id = ?')
    .all(guildId) as { streak: number; last_date: string }[];
  let best = 1;
  for (const r of rows) {
    const eff = effectiveStreak(r.last_date, r.streak, now);
    if (eff > best) best = eff;
  }
  return best;
}

/**
 * Records that SOMEONE spoke in `guildId` on day `now` and returns the resulting streak. On the
 * first-ever bump the row is seeded from `seedFromUsers`; afterwards it advances via the shared
 * `nextStreak` machine (same day -> unchanged, so many people on one day = one step). Updates the
 * best streak. UPSERT. `now` injectable for tests.
 */
export function bumpGuildTalk(db: Database.Database, guildId: string, now: Date): number {
  const today = dateKey(now);
  const row = db
    .prepare('SELECT streak, best_streak, last_date FROM guild_talk_streak WHERE guild_id = ?')
    .get(guildId) as StreakRow | undefined;

  if (!row) {
    const seed = seedFromUsers(db, guildId, now);
    db.prepare(
      `INSERT INTO guild_talk_streak (guild_id, streak, best_streak, last_date)
       VALUES (?, ?, ?, ?)`,
    ).run(guildId, seed, seed, today);
    return seed;
  }

  const streak = nextStreak(row.last_date, row.streak, now);
  const best = Math.max(row.best_streak, streak);
  db.prepare(
    `UPDATE guild_talk_streak SET streak = ?, best_streak = ?, last_date = ? WHERE guild_id = ?`,
  ).run(streak, best, today, guildId);
  return streak;
}

/**
 * Server streak as of day `now`: the LIVE value (`effectiveStreak` — a dead streak, 3+ silent
 * days, reads 0) plus the all-time best. `{ streak: 0, bestStreak: 0 }` for a server that has
 * never been recorded. PURE over the db, `now` injectable.
 */
export function getGuildStreak(
  db: Database.Database,
  guildId: string,
  now: Date,
): { streak: number; bestStreak: number } {
  const row = db
    .prepare('SELECT streak, best_streak, last_date FROM guild_talk_streak WHERE guild_id = ?')
    .get(guildId) as StreakRow | undefined;
  if (!row) return { streak: 0, bestStreak: 0 };
  return { streak: effectiveStreak(row.last_date, row.streak, now), bestStreak: row.best_streak };
}
