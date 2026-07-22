import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { bumpTalk, nextStreak, dateKey, dayKeyMinus } from '../src/store/talkStats';
import { bumpGuildTalk, getGuildStreak } from '../src/store/guildTalkStreak';

const G = 'guild-1';
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

// The server streak reuses the SAME state machine as the per-user streak (extracted into
// `nextStreak`), so "mesmas regras" is a shared invariant, not a copy that drifts. These pin
// that machine directly.
describe('nextStreak — shared Duolingo state machine (guild + user)', () => {
  const now = d(2026, 7, 10);
  it('spoke TODAY already -> unchanged', () => {
    expect(nextStreak(dateKey(now), 5, now)).toBe(5);
  });
  it('spoke YESTERDAY -> +1 (consecutive)', () => {
    expect(nextStreak(dayKeyMinus(now, 1), 5, now)).toBe(6);
  });
  it('spoke the DAY BEFORE (1 missed day, freeze) -> +1', () => {
    expect(nextStreak(dayKeyMinus(now, 2), 5, now)).toBe(6);
  });
  it('2 CONSECUTIVE missed days (gap >= 3) -> resets to 1', () => {
    expect(nextStreak(dayKeyMinus(now, 3), 5, now)).toBe(1);
    expect(nextStreak(dayKeyMinus(now, 30), 99, now)).toBe(1);
  });
  it('no prior date (empty) -> starts at 1', () => {
    expect(nextStreak('', 0, now)).toBe(1);
  });
});

describe('bumpGuildTalk — one server-wide streak (any single person speaking counts)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('first bump with NO user history seeds at 1 (the person spoke today)', () => {
    expect(bumpGuildTalk(db, G, d(2026, 7, 5))).toBe(1);
    expect(getGuildStreak(db, G, d(2026, 7, 5))).toEqual({ streak: 1, bestStreak: 1 });
  });

  it('first bump SEEDS from the best still-alive user streak (honest lower bound)', () => {
    // A member kept a 5-day personal streak (days 1..5). The server has therefore had activity
    // on at least those 5 days, so the very first server bump must start at 5, not 1.
    for (let day = 1; day <= 5; day += 1) bumpTalk(db, G, 'u1', d(2026, 7, day));
    // In production bumpGuildTalk runs AFTER bumpTalk for the same message, so u1's row is
    // already fresh when the seed reads MAX(effectiveStreak).
    expect(bumpGuildTalk(db, G, d(2026, 7, 5))).toBe(5);
    expect(getGuildStreak(db, G, d(2026, 7, 5))).toEqual({ streak: 5, bestStreak: 5 });
  });

  it('several people the SAME day -> stays the same (one day = one streak step)', () => {
    bumpGuildTalk(db, G, d(2026, 7, 5)); // -> 1
    bumpGuildTalk(db, G, d(2026, 7, 5)); // same day, another person -> still 1
    bumpGuildTalk(db, G, d(2026, 7, 5));
    expect(getGuildStreak(db, G, d(2026, 7, 5))).toEqual({ streak: 1, bestStreak: 1 });
  });

  it('CONSECUTIVE days increase the server streak', () => {
    bumpGuildTalk(db, G, d(2026, 7, 5)); // 1
    bumpGuildTalk(db, G, d(2026, 7, 6)); // 2
    expect(bumpGuildTalk(db, G, d(2026, 7, 7))).toBe(3); // 3
    expect(getGuildStreak(db, G, d(2026, 7, 7))).toEqual({ streak: 3, bestStreak: 3 });
  });

  it('MISSING 1 day (freeze): continues without counting the gap', () => {
    bumpGuildTalk(db, G, d(2026, 7, 5)); // 1
    bumpGuildTalk(db, G, d(2026, 7, 6)); // 2
    // skips day 7; someone speaks on day 8 -> freeze -> 3
    expect(bumpGuildTalk(db, G, d(2026, 7, 8))).toBe(3);
  });

  it('MISSING 2 CONSECUTIVE days: loses it (restarts at 1), keeps best', () => {
    bumpGuildTalk(db, G, d(2026, 7, 5)); // 1
    bumpGuildTalk(db, G, d(2026, 7, 6)); // 2
    // skips days 7 and 8; returns on day 9 -> lost -> 1
    expect(bumpGuildTalk(db, G, d(2026, 7, 9))).toBe(1);
    expect(getGuildStreak(db, G, d(2026, 7, 9))).toEqual({ streak: 1, bestStreak: 2 });
  });

  it('a DEAD streak reads as 0 live but keeps the best', () => {
    bumpGuildTalk(db, G, d(2026, 7, 1)); // 1, then goes silent
    // 3+ days later without any activity -> live streak is 0.
    expect(getGuildStreak(db, G, d(2026, 7, 10))).toEqual({ streak: 0, bestStreak: 1 });
  });

  it('is per-guild (a bump in G does not create one in another server)', () => {
    bumpGuildTalk(db, G, d(2026, 7, 5));
    expect(getGuildStreak(db, 'outra', d(2026, 7, 5))).toEqual({ streak: 0, bestStreak: 0 });
  });
});
