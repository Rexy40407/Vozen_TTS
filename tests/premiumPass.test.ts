import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  isGuildPremium,
  grantGuildPass,
  activateSeat,
  deactivateSeat,
  getPremiumPass,
  countActiveSeats,
  listPassActivations,
} from '../src/store/premium';

const U = 'user-1';
const A = 'guild-A';
const B = 'guild-B';
const C = 'guild-C';
const DAY = 86_400_000;

describe('Premium pass — per-user seats activated per guild', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('no pass -> activateSeat returns no_pass and the guild is not premium', () => {
    expect(activateSeat(db, U, A, 1000).status).toBe('no_pass');
    expect(isGuildPremium(db, A, 1000)).toBe(false);
    expect(getPremiumPass(db, U)).toBeNull();
  });

  it('grantGuildPass creates the pass; activateSeat makes the guild premium', () => {
    const now = 1_000_000;
    const exp = grantGuildPass(db, U, 2, 30, 'kofi', now);
    expect(exp).toBe(now + 30 * DAY);
    expect(getPremiumPass(db, U)).toEqual({ seats: 2, expiresAt: exp, source: 'kofi' });
    // not activated yet -> guild is not premium
    expect(isGuildPremium(db, A, now + 1)).toBe(false);
    const r = activateSeat(db, U, A, now);
    expect(r.status).toBe('ok');
    expect(r.used).toBe(1);
    expect(isGuildPremium(db, A, now + 1)).toBe(true);
    expect(isGuildPremium(db, A, exp + 1)).toBe(false); // pass expired -> no longer valid
  });

  it('limit of 2 seats: the 3rd activation is refused', () => {
    const now = 1_000_000;
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    expect(activateSeat(db, U, A, now).status).toBe('ok');
    expect(activateSeat(db, U, B, now).status).toBe('ok');
    const third = activateSeat(db, U, C, now);
    expect(third.status).toBe('no_seats');
    expect(third.used).toBe(2);
    expect(isGuildPremium(db, C, now + 1)).toBe(false);
    expect(countActiveSeats(db, U)).toBe(2);
  });

  it('reactivating the same guild -> already, without spending another seat', () => {
    const now = 1_000_000;
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, A, now);
    const again = activateSeat(db, U, A, now);
    expect(again.status).toBe('already');
    expect(countActiveSeats(db, U)).toBe(1); // still 1
  });

  it('reversible: spend on A, release and move to B — the CLOCK stays on the pass', () => {
    const day0 = 1_000_000;
    const exp = grantGuildPass(db, U, 2, 30, 'kofi', day0); // absolute end = day 30
    activateSeat(db, U, A, day0);
    expect(isGuildPremium(db, A, day0 + 10 * DAY)).toBe(true);

    // day 10: release A and put it on B
    const day10 = day0 + 10 * DAY;
    expect(deactivateSeat(db, U, A)).toBe(true);
    expect(isGuildPremium(db, A, day10)).toBe(false); // A stops being premium immediately
    expect(activateSeat(db, U, B, day10).status).toBe('ok');

    // B is premium until the SAME pass end (day 30) — did not reset or extend
    expect(isGuildPremium(db, B, day0 + 29 * DAY)).toBe(true);
    expect(isGuildPremium(db, B, exp + 1)).toBe(false);
    expect(getPremiumPass(db, U)!.expiresAt).toBe(exp); // end unchanged by the move
  });

  it('deactivateSeat on a non-activated guild -> false', () => {
    grantGuildPass(db, U, 2, 30, 'kofi', 1000);
    expect(deactivateSeat(db, U, A)).toBe(false);
  });

  it('renewing extends the pass and active guilds inherit the new date', () => {
    const now = 1_000_000;
    const exp1 = grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, A, now);
    // renew 1 day before expiring -> accumulates
    const exp2 = grantGuildPass(db, U, 2, 30, 'kofi', exp1 - DAY);
    expect(exp2).toBe(exp1 + 30 * DAY);
    // after the OLD end, the guild stays premium (inherited the new date, without re-activating)
    expect(isGuildPremium(db, A, exp1 + DAY)).toBe(true);
    expect(isGuildPremium(db, A, exp2 + 1)).toBe(false);
  });

  it('activateSeat with an expired pass -> expired', () => {
    const now = 1_000_000;
    const exp = grantGuildPass(db, U, 2, 30, 'kofi', now);
    expect(activateSeat(db, U, A, exp + DAY).status).toBe('expired');
  });

  it('grantGuildPass never reduces the number of seats', () => {
    const now = 1_000_000;
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    grantGuildPass(db, U, 1, 30, 'kofi', now + DAY); // "downgrade" does not reduce
    expect(getPremiumPass(db, U)!.seats).toBe(2);
  });

  it('listPassActivations returns the guilds in activation order', () => {
    const now = 1_000_000;
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, B, now);
    activateSeat(db, U, A, now + 1);
    expect(listPassActivations(db, U)).toEqual([B, A]);
  });
});
