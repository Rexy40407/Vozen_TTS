import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  isGuildPremium,
  isUserPremium,
  getGuildPremiumExpiry,
  grantGuildPremium,
  grantUserPremium,
} from '../src/store/premium';

const G = 'guild-1';
const U = 'user-1';
const DAY = 86_400_000;

describe('premium — state by expiry', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('no row -> not premium', () => {
    expect(isGuildPremium(db, G, 1000)).toBe(false);
    expect(isUserPremium(db, U, 1000)).toBe(false);
    expect(getGuildPremiumExpiry(db, G)).toBeNull();
  });

  it('grantGuildPremium grants days from now', () => {
    const now = 1_000_000;
    const exp = grantGuildPremium(db, G, 30, 'test', now);
    expect(exp).toBe(now + 30 * DAY);
    expect(isGuildPremium(db, G, now + 1)).toBe(true);
    expect(isGuildPremium(db, G, exp + 1)).toBe(false); // expired
  });

  it('renewing BEFORE expiry EXTENDS (accumulates, does not lose time)', () => {
    const now = 1_000_000;
    grantGuildPremium(db, G, 30, 'test', now);
    const exp2 = grantGuildPremium(db, G, 30, 'test', now + DAY); // 1 day later, still active
    expect(exp2).toBe(now + 60 * DAY); // extends from the expiry, not from now+DAY
  });

  it('renewing AFTER expiry restarts from now', () => {
    const now = 1_000_000;
    const exp1 = grantGuildPremium(db, G, 30, 'test', now);
    const later = exp1 + 10 * DAY; // already expired
    const exp2 = grantGuildPremium(db, G, 30, 'test', later);
    expect(exp2).toBe(later + 30 * DAY);
  });

  it('grantUserPremium is independent of the guild', () => {
    const now = 1_000_000;
    grantUserPremium(db, U, 30, 'test', now);
    expect(isUserPremium(db, U, now + 1)).toBe(true);
    expect(isGuildPremium(db, G, now + 1)).toBe(false);
  });
});
