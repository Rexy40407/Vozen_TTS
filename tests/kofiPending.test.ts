// tests/kofiPending.test.ts — PENDING Ko-fi grants (purchase without a Discord ID).
//
// The Ko-fi SUBSCRIPTION checkout has no reliable message box, so the buyer
// cannot put their Discord ID into the payment (confirmed by production logs: "purchase WITHOUT
// a valid Discord ID — MANUAL grant"). Instead of just logging, we store the purchase as PENDING,
// indexed by the tx id (which the buyer has on the receipt) and by the HASH of the email (never in clear).
// The buyer claims it later on the site (Discord login + code) — see src/store/kofiPending.ts.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  recordPendingGrant,
  findUnclaimedPendingByTx,
  listUnclaimedPendingByEmailHash,
  markPendingClaimed,
  purgeOldPendingGrants,
  startPendingPurgeJob,
} from '../src/store/kofiPending';

describe('kofiPending — pending grants (purchase without a Discord ID)', () => {
  let db: Database.Database;
  const now = 1_000_000;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  const input = (over: Partial<Parameters<typeof recordPendingGrant>[1]> = {}) => ({
    transactionId: 'tx-1',
    emailHash: 'hash-a',
    plan: 'plus',
    days: 30,
    seats: 3,
    ...over,
  });

  it('recordPendingGrant: first time true, duplicate (same tx) false + does NOT duplicate', () => {
    expect(recordPendingGrant(db, input(), now)).toBe(true);
    expect(recordPendingGrant(db, input(), now + 5)).toBe(false); // INSERT OR IGNORE (idempotent)
    expect(listUnclaimedPendingByEmailHash(db, 'hash-a')).toHaveLength(1);
  });

  it('findUnclaimedPendingByTx: returns the pending row with the right fields, claimedAt null', () => {
    recordPendingGrant(db, input({ plan: 'premium', seats: 8, days: 365 }), now);
    const p = findUnclaimedPendingByTx(db, 'tx-1')!;
    expect(p.transactionId).toBe('tx-1');
    expect(p.plan).toBe('premium');
    expect(p.seats).toBe(8);
    expect(p.days).toBe(365);
    expect(p.emailHash).toBe('hash-a');
    expect(p.createdAt).toBe(now);
    expect(p.claimedAt).toBeNull();
  });

  it('findUnclaimedPendingByTx: nonexistent tx -> null', () => {
    expect(findUnclaimedPendingByTx(db, 'nao-existe')).toBeNull();
  });

  it('listUnclaimedPendingByEmailHash: gathers MULTIPLE purchases from the same email (orphan renewals)', () => {
    recordPendingGrant(db, input({ transactionId: 'tx-1' }), now);
    recordPendingGrant(db, input({ transactionId: 'tx-2' }), now + 100);
    recordPendingGrant(db, input({ transactionId: 'tx-3', emailHash: 'outro' }), now + 200);
    const mine = listUnclaimedPendingByEmailHash(db, 'hash-a');
    expect(mine.map((p) => p.transactionId).sort()).toEqual(['tx-1', 'tx-2']);
  });

  it('markPendingClaimed: marks once; leaves the UNclaimed lists; re-marking -> false', () => {
    recordPendingGrant(db, input(), now);
    expect(markPendingClaimed(db, 'tx-1', now + 10)).toBe(true);
    expect(findUnclaimedPendingByTx(db, 'tx-1')).toBeNull(); // already claimed
    expect(listUnclaimedPendingByEmailHash(db, 'hash-a')).toHaveLength(0);
    expect(markPendingClaimed(db, 'tx-1', now + 20)).toBe(false); // idempotent: already was
  });

  it('emailHash null (payload without email) is accepted and never matches by email', () => {
    expect(
      recordPendingGrant(db, input({ transactionId: 'tx-sem-email', emailHash: null }), now),
    ).toBe(true);
    expect(findUnclaimedPendingByTx(db, 'tx-sem-email')!.emailHash).toBeNull();
    // A pending row without email never shows up in an email-hash search (claim only by tx id).
    expect(listUnclaimedPendingByEmailHash(db, 'hash-a')).toHaveLength(0);
  });

  it('purgeOldPendingGrants: removes those created before the cutoff, keeps the recent ones', () => {
    recordPendingGrant(db, input({ transactionId: 'velho' }), now);
    recordPendingGrant(db, input({ transactionId: 'novo' }), now + 100_000);
    const removed = purgeOldPendingGrants(db, now + 50_000);
    expect(removed).toBe(1);
    expect(findUnclaimedPendingByTx(db, 'velho')).toBeNull();
    expect(findUnclaimedPendingByTx(db, 'novo')).not.toBeNull();
  });

  it('startPendingPurgeJob: runs on startup, purges those >90d and keeps the recent ones; stop() ok', () => {
    // created_at=1 (near epoch) is well beyond 90 days -> purged on the immediate tick.
    recordPendingGrant(db, input({ transactionId: 'antigo' }), 1);
    recordPendingGrant(db, input({ transactionId: 'recente' }), Date.now());
    const removed: number[] = [];
    const stop = startPendingPurgeJob(db, (n) => removed.push(n));
    expect(findUnclaimedPendingByTx(db, 'antigo')).toBeNull();
    expect(findUnclaimedPendingByTx(db, 'recente')).not.toBeNull();
    expect(removed).toEqual([1]);
    expect(() => stop()).not.toThrow();
  });
});
