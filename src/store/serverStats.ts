// src/store/serverStats.ts
//
// Aggregation of SERVER STATISTICS (Premium perk /server-stats). Compliance: ONLY aggregates
// data the bot ALREADY stores (talk_stats + game_score) — no new collection; "top-talkers"
// is per-user data already disclosed and already erasable via /privacy erase. See
// docs/COMPLIANCE-VAGA5.md · Stats. PURE/deterministic (given db + now); reuses
// getTopSpeakers + getLeaderboard, no new SQL.

import type Database from 'better-sqlite3';
import { getTopSpeakers, type TalkRow } from './talkStats';
import { getLeaderboard, type ScoreRow } from './gameScore';

export interface ServerStats {
  /** Total messages Vozen read in this server (sum of spoken_count). */
  totalMessages: number;
  /** Number of people with at least 1 message read. */
  activeSpeakers: number;
  /** Highest streak of LIVE days in the server right now (0 if nobody). */
  topStreak: number;
  /** Top N talkers (by message count, tiebreak by live streak). */
  topSpeakers: TalkRow[];
  /** Total minigame points (sum of points). */
  gamePoints: number;
  /** Total matches won (sum of wins). */
  gameWins: number;
  /** Number of players with a score. */
  gamePlayers: number;
  /** Top N players (by points, tiebreak by wins). */
  topPlayers: ScoreRow[];
}

// Defensive limit when scanning the rows for the totals (huge servers). Well above any
// real leaderboard; avoids materializing giant arrays in a single pathological server.
const SCAN_CAP = 5000;

/**
 * Assembles the aggregated statistics of `guildId`. `limit` = size of the tops shown.
 * The TOTALS (messages, speakers, points, players) scan all rows (up to SCAN_CAP);
 * the TOPS are the first `limit` already sorted. `now` injectable (live streak depends on
 * the day).
 */
export function buildServerStats(
  db: Database.Database,
  guildId: string,
  now: Date,
  limit = 5,
): ServerStats {
  const speakers = getTopSpeakers(db, guildId, now, SCAN_CAP); // all, already sorted
  const players = getLeaderboard(db, guildId, SCAN_CAP); // all, already sorted

  return {
    totalMessages: speakers.reduce((a, s) => a + s.count, 0),
    activeSpeakers: speakers.length,
    // `speakers` is now sorted by COUNT, so speakers[0] is NOT the top-streak person.
    // Compute the highest live streak across everyone explicitly.
    topStreak: speakers.reduce((m, s) => Math.max(m, s.streak), 0),
    topSpeakers: speakers.slice(0, limit),
    gamePoints: players.reduce((a, p) => a + p.points, 0),
    gameWins: players.reduce((a, p) => a + p.wins, 0),
    gamePlayers: players.length,
    topPlayers: players.slice(0, limit),
  };
}
