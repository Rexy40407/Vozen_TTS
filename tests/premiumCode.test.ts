import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { insertPremiumCode, getPremiumCode, redeemPremiumCode } from '../src/store/premiumCode';
import { generateCodeString, normalizeCode, CODE_ALPHABET } from '../src/premium/codeGen';

describe('codeGen — code generation/normalization', () => {
  it('VOZEN-XXXX-XXXX format using only the safe alphabet', () => {
    // deterministic randInt -> always index 0 ('A').
    const code = generateCodeString(() => 0);
    expect(code).toBe('VOZEN-AAAA-AAAA');
    expect(code).toMatch(/^VOZEN-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('the alphabet has no ambiguous characters (0/O/1/I/L)', () => {
    for (const c of '01OIL') expect(CODE_ALPHABET).not.toContain(c);
  });

  it('normalizeCode uppercases and strips spaces', () => {
    expect(normalizeCode('  vozen-aaaa-bbbb  ')).toBe('VOZEN-AAAA-BBBB');
  });
});

describe('premium_code — store (insert/get/redeem, single use)', () => {
  let db: Database.Database;
  const base = {
    plan: 'plus' as const,
    days: 30,
    seats: 0,
    createdBy: 'owner1',
    createdAt: 1000,
    expiresAt: null,
  };
  beforeEach(() => {
    db = initDb(':memory:');
  });

  it('insert + get round-trip', () => {
    expect(insertPremiumCode(db, { code: 'VOZEN-AAAA-BBBB', ...base })).toBe(true);
    const row = getPremiumCode(db, 'VOZEN-AAAA-BBBB');
    expect(row?.plan).toBe('plus');
    expect(row?.redeemedBy).toBeNull();
  });

  it('inserting a duplicate code returns false (so the caller regenerates)', () => {
    expect(insertPremiumCode(db, { code: 'DUP', ...base })).toBe(true);
    expect(insertPremiumCode(db, { code: 'DUP', ...base })).toBe(false);
  });

  it('redeeming a nonexistent code -> not-found', () => {
    expect(redeemPremiumCode(db, 'NOPE', 'user1', 2000)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('valid redemption returns the grant and marks the code as used', () => {
    insertPremiumCode(db, { code: 'GIFT1', ...base, plan: 'premium', seats: 3 });
    const res = redeemPremiumCode(db, 'GIFT1', 'user1', 2000);
    expect(res).toEqual({ ok: true, plan: 'premium', days: 30, seats: 3 });
    const row = getPremiumCode(db, 'GIFT1');
    expect(row?.redeemedBy).toBe('user1');
    expect(row?.redeemedAt).toBe(2000);
  });

  it('SINGLE USE: a 2nd redemption of the same code -> used', () => {
    insertPremiumCode(db, { code: 'ONCE', ...base });
    expect(redeemPremiumCode(db, 'ONCE', 'user1', 2000).ok).toBe(true);
    expect(redeemPremiumCode(db, 'ONCE', 'user2', 3000)).toEqual({ ok: false, reason: 'used' });
  });

  it('expired code -> expired (not redeemable)', () => {
    insertPremiumCode(db, { code: 'OLD', ...base, expiresAt: 1500 });
    expect(redeemPremiumCode(db, 'OLD', 'user1', 2000)).toEqual({ ok: false, reason: 'expired' });
    // and remains unused (was not consumed)
    expect(getPremiumCode(db, 'OLD')?.redeemedBy).toBeNull();
  });

  it('code with validity still in the future -> redeemable', () => {
    insertPremiumCode(db, { code: 'FRESH', ...base, expiresAt: 5000 });
    expect(redeemPremiumCode(db, 'FRESH', 'user1', 2000).ok).toBe(true);
  });

  it('ATOMIC: if applyGrant throws, the code is NOT burned (rollback)', () => {
    insertPremiumCode(db, { code: 'ATOM', ...base, plan: 'premium', seats: 3 });
    // The grant (applied INSIDE the transaction) throws — e.g. a write failure.
    expect(() =>
      redeemPremiumCode(db, 'ATOM', 'user1', 2000, () => {
        throw new Error('grant falhou');
      }),
    ).toThrow('grant falhou');
    // The code's claim must roll back along with it: still unused.
    expect(getPremiumCode(db, 'ATOM')?.redeemedBy).toBeNull();
    // And a new redemption (now with a successful grant) consumes it normally.
    let granted = false;
    const res = redeemPremiumCode(db, 'ATOM', 'user1', 3000, () => {
      granted = true;
    });
    expect(res.ok).toBe(true);
    expect(granted).toBe(true);
    expect(getPremiumCode(db, 'ATOM')?.redeemedBy).toBe('user1');
  });
});
