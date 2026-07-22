import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  bumpTalk,
  getTopSpeakers,
  dateKey,
  prevDateKey,
  dayKeyMinus,
  effectiveStreak,
} from '../src/store/talkStats';

const G = 'guild-1';
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('dateKey / prevDateKey / dayKeyMinus — local day keys', () => {
  it('formats YYYY-MM-DD with zero-padding', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05'); // 5 Jan
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
  it('prevDateKey crosses month/year boundaries', () => {
    expect(prevDateKey(new Date(2026, 2, 1))).toBe('2026-02-28'); // 1 Mar -> 28 Feb (2026 not a leap year)
    expect(prevDateKey(new Date(2026, 0, 1))).toBe('2025-12-31'); // 1 Jan -> 31 Dec previous year
  });
  it('dayKeyMinus(n) goes back n days (DST-safe, crosses boundaries)', () => {
    expect(dayKeyMinus(new Date(2026, 6, 10), 2)).toBe('2026-07-08');
    expect(dayKeyMinus(new Date(2026, 2, 2), 2)).toBe('2026-02-28'); // 2 Mar -> 28 Feb
  });
});

describe('bumpTalk — count + streak (Duolingo rules)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('first message creates the row with count 1 and streak 1', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    expect(getTopSpeakers(db, G, d(2026, 7, 5))).toEqual([
      { userId: 'u1', count: 1, streak: 1, bestStreak: 1 },
    ]);
  });

  it('multiple messages on the SAME day -> count rises, streak stays 1', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    expect(getTopSpeakers(db, G, d(2026, 7, 5))[0]).toEqual({
      userId: 'u1',
      count: 3,
      streak: 1,
      bestStreak: 1,
    });
  });

  it('CONSECUTIVE days increase the streak', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    bumpTalk(db, G, 'u1', d(2026, 7, 6));
    bumpTalk(db, G, 'u1', d(2026, 7, 7));
    expect(getTopSpeakers(db, G, d(2026, 7, 7))[0]).toEqual({
      userId: 'u1',
      count: 3,
      streak: 3,
      bestStreak: 3,
    });
  });

  it('MISSING 1 day (freeze): the streak CONTINUES, without counting the missed day', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5)); // streak 1
    bumpTalk(db, G, 'u1', d(2026, 7, 6)); // streak 2
    // misses day 7 (1 day); returns on day 8 -> freeze: continues to 3 (the missed day does not count)
    const bump = bumpTalk(db, G, 'u1', d(2026, 7, 8));
    expect(bump.streak).toBe(3);
    expect(getTopSpeakers(db, G, d(2026, 7, 8))[0]).toMatchObject({ streak: 3, bestStreak: 3 });
  });

  it('MISSING 2 CONSECUTIVE days: loses the streak (restarts at 1), keeps the best', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5)); // streak 1
    bumpTalk(db, G, 'u1', d(2026, 7, 6)); // streak 2
    // misses days 7 and 8 (2 in a row); returns on day 9 -> loses -> 1
    const bump = bumpTalk(db, G, 'u1', d(2026, 7, 9));
    expect(bump.streak).toBe(1);
    expect(getTopSpeakers(db, G, d(2026, 7, 9))[0]).toMatchObject({ streak: 1, bestStreak: 2 });
  });

  it('is per-guild', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    expect(getTopSpeakers(db, 'outra', d(2026, 7, 5))).toEqual([]);
  });
});

describe('effectiveStreak — streak ALIVE on the reference day', () => {
  it('alive today / yesterday / the day before (within the freeze) -> stored value', () => {
    const now = d(2026, 7, 10);
    expect(effectiveStreak(dateKey(now), 5, now)).toBe(5); // today
    expect(effectiveStreak(dayKeyMinus(now, 1), 5, now)).toBe(5); // yesterday
    expect(effectiveStreak(dayKeyMinus(now, 2), 5, now)).toBe(5); // day before (1 missed day)
  });
  it('3+ days without speaking (2 consecutive missed days) -> 0 (lost)', () => {
    const now = d(2026, 7, 10);
    expect(effectiveStreak(dayKeyMinus(now, 3), 5, now)).toBe(0);
    expect(effectiveStreak(dayKeyMinus(now, 30), 99, now)).toBe(0);
  });
});

describe('getTopSpeakers — leaderboard ranked by message COUNT (streak as tiebreak)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('whoever has MORE messages ranks first, even with a LOWER streak (count-first)', () => {
    // The screenshot case: "bom dia" has 814 messages / streak 10 and must beat "diogo"
    // with 318 messages / streak 11. Here: talker (count 5, streak 2) beats streaker
    // (count 3, streak 3). Under the OLD streak-first order this was reversed.
    bumpTalk(db, G, 'talker', d(2026, 7, 9)); // day 9 x4 -> count 4, streak 1
    bumpTalk(db, G, 'talker', d(2026, 7, 9));
    bumpTalk(db, G, 'talker', d(2026, 7, 9));
    bumpTalk(db, G, 'talker', d(2026, 7, 9));
    bumpTalk(db, G, 'talker', d(2026, 7, 10)); // day 10 -> count 5, streak 2
    bumpTalk(db, G, 'streaker', d(2026, 7, 8)); // 3 consecutive days -> count 3, streak 3
    bumpTalk(db, G, 'streaker', d(2026, 7, 9));
    bumpTalk(db, G, 'streaker', d(2026, 7, 10));
    const top = getTopSpeakers(db, G, d(2026, 7, 10));
    expect(top.map((r) => r.userId)).toEqual(['talker', 'streaker']); // 5 msgs > 3 msgs
    expect(top[0].count).toBe(5);
    expect(top[1].streak).toBe(3); // streak is still reported, just not the sort key
  });

  it('a DEAD streak (3+ days without speaking) still shows as 0 (decoration stays live)', () => {
    bumpTalk(db, G, 'morto', d(2026, 7, 1)); // count 1, streak dead
    bumpTalk(db, G, 'vivo', d(2026, 7, 10)); // count 1, streak 1
    const top = getTopSpeakers(db, G, d(2026, 7, 10));
    const dead = top.find((r) => r.userId === 'morto');
    expect(dead?.streak).toBe(0); // live streak still computed for display
    // Equal counts (1 vs 1) -> tiebreak by streak -> vivo (1) above morto (0).
    expect(top.map((r) => r.userId)).toEqual(['vivo', 'morto']);
  });

  it('count TIE -> broken by streak DAYS (more consecutive days wins)', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 10)); // count 1, streak 1
    bumpTalk(db, G, 'u2', d(2026, 7, 9)); // count 2 over 2 days, streak 2
    bumpTalk(db, G, 'u2', d(2026, 7, 10));
    // Give u1 one more so counts tie at 2, and u2 keeps the higher streak.
    bumpTalk(db, G, 'u1', d(2026, 7, 10)); // count 2, streak 1
    const top = getTopSpeakers(db, G, d(2026, 7, 10));
    expect(top.map((r) => r.userId)).toEqual(['u2', 'u1']); // both count 2 -> u2 streak 2 wins
  });
});

describe('bumpTalk — streak signal (return) for the 🔥 notice', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('very first message ever -> { firstOfDay:true, streak:1 }', () => {
    expect(bumpTalk(db, G, 'u1', d(2026, 7, 5))).toEqual({ firstOfDay: true, streak: 1 });
  });

  it('repetition on the SAME day -> firstOfDay:false', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    expect(bumpTalk(db, G, 'u1', d(2026, 7, 5))).toEqual({ firstOfDay: false, streak: 1 });
  });

  it('NEXT day -> firstOfDay:true, streak rises', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    expect(bumpTalk(db, G, 'u1', d(2026, 7, 6))).toEqual({ firstOfDay: true, streak: 2 });
  });

  it('2 CONSECUTIVE missed days -> firstOfDay:true, streak restarts at 1', () => {
    bumpTalk(db, G, 'u1', d(2026, 7, 5));
    bumpTalk(db, G, 'u1', d(2026, 7, 6));
    expect(bumpTalk(db, G, 'u1', d(2026, 7, 9))).toEqual({ firstOfDay: true, streak: 1 });
  });
});
