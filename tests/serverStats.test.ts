import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { bumpTalk } from '../src/store/talkStats';
import { persistGameScores } from '../src/store/gameScore';
import { buildServerStats } from '../src/store/serverStats';

// Server stats aggregation (Premium perk /server-stats). ONLY aggregates data ALREADY
// stored (talk_stats + game_score) — no new collection. See docs/COMPLIANCE-VAGA5.md.
const G = '222222222222222222';
const A = 'aaa';
const B = 'bbb';
const C = 'ccc';
const now = new Date(2026, 6, 13); // fixed day (deterministic)

describe('buildServerStats — aggregation of already-stored data', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('empty server → zeros and empty lists', () => {
    const s = buildServerStats(db, G, now);
    expect(s.totalMessages).toBe(0);
    expect(s.activeSpeakers).toBe(0);
    expect(s.topStreak).toBe(0);
    expect(s.topSpeakers).toEqual([]);
    expect(s.gamePoints).toBe(0);
    expect(s.gameWins).toBe(0);
    expect(s.gamePlayers).toBe(0);
    expect(s.topPlayers).toEqual([]);
  });

  it('aggregates read messages: total, active speakers and sorted top', () => {
    bumpTalk(db, G, A, now); // A: 3 msgs
    bumpTalk(db, G, A, now);
    bumpTalk(db, G, A, now);
    bumpTalk(db, G, B, now); // B: 1 msg
    const s = buildServerStats(db, G, now);
    expect(s.totalMessages).toBe(4);
    expect(s.activeSpeakers).toBe(2);
    expect(s.topStreak).toBe(1); // both spoke today -> live streak 1
    expect(s.topSpeakers[0].userId).toBe(A); // A is the top (most messages)
    expect(s.topSpeakers[0].count).toBe(3);
  });

  it('aggregates game points/wins/players + top', () => {
    persistGameScores(
      db,
      G,
      new Map([
        [A, 10],
        [B, 4],
      ]),
    ); // A wins (most points)
    persistGameScores(db, G, new Map([[C, 7]])); // C wins
    const s = buildServerStats(db, G, now);
    expect(s.gamePoints).toBe(21); // 10+4+7
    expect(s.gameWins).toBe(2); // A and C
    expect(s.gamePlayers).toBe(3);
    expect(s.topPlayers[0].userId).toBe(A); // A is the top (10 points)
    expect(s.topPlayers[0].points).toBe(10);
  });

  it('respects the top limit', () => {
    for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) bumpTalk(db, G, u, now);
    const s = buildServerStats(db, G, now, 3);
    expect(s.topSpeakers).toHaveLength(3);
    expect(s.activeSpeakers).toBe(6); // the total is NOT limited
  });
});
