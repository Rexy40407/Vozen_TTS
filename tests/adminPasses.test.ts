import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  grantGuildPass,
  grantUserPremium,
  activateSeat,
  isGuildPremium,
  isUserPremium,
} from '../src/store/premium';
import { listActivePremium, revokeGuildPass, revokeUserPremium } from '../src/store/adminPasses';

// Read/revoke helpers for the admin console (plan 037). The GRANT path reuses the tested
// grantUserPremium/grantGuildPass — these only add the console's own needs: an overview of who
// currently holds what, and a revoke that must actually take the access away.

const DAY = 86_400_000;

describe('adminPasses — listActivePremium', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('is empty on a fresh db', () => {
    expect(listActivePremium(db, 1_000)).toEqual({ plus: [], passes: [] });
  });

  it('lists active Plus and passes, and counts used seats', () => {
    const now = 1_000_000;
    grantUserPremium(db, 'plus-1', 30, 'kofi', now);
    grantGuildPass(db, 'owner-1', 3, 30, 'manual', now);
    activateSeat(db, 'owner-1', 'guild-A', now);
    activateSeat(db, 'owner-1', 'guild-B', now);

    const view = listActivePremium(db, now);
    expect(view.plus).toEqual([{ userId: 'plus-1', expiresAt: now + 30 * DAY, source: 'kofi' }]);
    expect(view.passes).toEqual([
      { userId: 'owner-1', seats: 3, used: 2, expiresAt: now + 30 * DAY, source: 'manual' },
    ]);
  });

  it('excludes expired Plus and passes', () => {
    const past = 1_000_000;
    grantUserPremium(db, 'old-plus', 1, 'kofi', past);
    grantGuildPass(db, 'old-owner', 1, 1, 'kofi', past);
    // now is well after both expired
    const view = listActivePremium(db, past + 5 * DAY);
    expect(view.plus).toEqual([]);
    expect(view.passes).toEqual([]);
  });
});

describe('adminPasses — revoke', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('revokeUserPremium removes the Plus and reports it', () => {
    const now = 2_000_000;
    grantUserPremium(db, 'u', 30, 'kofi', now);
    expect(isUserPremium(db, 'u', now)).toBe(true);
    expect(revokeUserPremium(db, 'u')).toBe(true);
    expect(isUserPremium(db, 'u', now)).toBe(false);
  });

  it('revokeUserPremium returns false when there is nothing to revoke', () => {
    expect(revokeUserPremium(db, 'nobody')).toBe(false);
  });

  it('revokeGuildPass removes the pass AND its seat activations (guild stops being premium)', () => {
    const now = 2_000_000;
    grantGuildPass(db, 'owner', 2, 30, 'manual', now);
    activateSeat(db, 'owner', 'guild-A', now);
    expect(isGuildPremium(db, 'guild-A', now)).toBe(true);

    expect(revokeGuildPass(db, 'owner')).toBe(true);
    // The activation row must be gone too — otherwise isGuildPremium can read stale-true.
    expect(isGuildPremium(db, 'guild-A', now)).toBe(false);
    expect(listActivePremium(db, now).passes).toEqual([]);
  });

  it('revokeGuildPass returns false when there is no pass', () => {
    expect(revokeGuildPass(db, 'nobody')).toBe(false);
  });
});
