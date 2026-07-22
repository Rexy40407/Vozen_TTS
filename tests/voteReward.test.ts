import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../src/store/db';
import { getUserPremiumExpiry, grantUserPremium, isUserPremium } from '../src/store/premium';
import {
  claimVoteReward,
  getVoteRewardAt,
  hasRedeemedVoteReward,
  initializeVoteRedemptionLedger,
  purgeExpiredVoteRewards,
  voteRedemptionHash,
  voteRewardStatus,
  VOTE_REWARD_HOURS,
  VOTE_REWARD_MS,
} from '../src/store/voteReward';

const USER_ID = '123456789012345678';
const SECRET = '0123456789abcdef0123456789abcdef';
const NOW = 1_800_000_000_000;

describe('vote reward — one 48h claim per Discord account, ever', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => db.close());

  it('grants exactly 48h on the first verified vote', () => {
    expect(VOTE_REWARD_HOURS).toBe(48);
    const result = claimVoteReward(db, USER_ID, NOW, SECRET);

    expect(result).toEqual({ granted: true, expiresAt: NOW + VOTE_REWARD_MS });
    expect(getVoteRewardAt(db, USER_ID)).toBe(NOW);
    expect(isUserPremium(db, USER_ID, NOW + VOTE_REWARD_MS - 1)).toBe(true);
    expect(isUserPremium(db, USER_ID, NOW + VOTE_REWARD_MS)).toBe(false);
  });

  it('never grants a second reward, even years later', () => {
    claimVoteReward(db, USER_ID, NOW, SECRET);
    const second = claimVoteReward(db, USER_ID, NOW + 10 * 365 * 86_400_000, SECRET);

    expect(second).toEqual({ granted: false, alreadyRedeemed: true });
    expect(getVoteRewardAt(db, USER_ID)).toBe(NOW);
  });

  it('fails closed if the stable HMAC key is accidentally changed', () => {
    claimVoteReward(db, USER_ID, NOW, SECRET);
    const replacement = 'abcdef0123456789abcdef0123456789';

    expect(() => voteRewardStatus(db, USER_ID, replacement)).toThrow(/does not match/i);
    expect(() =>
      claimVoteReward(db, '999999999999999999', NOW + VOTE_REWARD_MS, replacement),
    ).toThrow(/does not match/i);
    expect(db.prepare('SELECT COUNT(*) AS n FROM vote_redemption').get()).toEqual({ n: 1 });
  });

  it('backfills rewards created before the lifetime ledger and remains idempotent', () => {
    db.prepare('INSERT INTO vote_reward (user_id, rewarded_at) VALUES (?, ?)').run(USER_ID, NOW);

    expect(initializeVoteRedemptionLedger(db, SECRET)).toBe(1);
    expect(initializeVoteRedemptionLedger(db, SECRET)).toBe(0);
    expect(hasRedeemedVoteReward(db, USER_ID, SECRET)).toBe(true);
    expect(claimVoteReward(db, USER_ID, NOW + VOTE_REWARD_MS, SECRET)).toEqual({
      granted: false,
      alreadyRedeemed: true,
    });
  });

  it('checks the pinned key at startup before a webhook or command is used', () => {
    initializeVoteRedemptionLedger(db, SECRET);

    expect(() => initializeVoteRedemptionLedger(db, 'abcdef0123456789abcdef0123456789')).toThrow(
      /does not match/i,
    );
  });

  it('keeps the lifetime marker after /privacy erase removes the raw entitlement', () => {
    claimVoteReward(db, USER_ID, NOW, SECRET);
    db.prepare('DELETE FROM vote_reward WHERE user_id = ?').run(USER_ID); // /privacy erase path

    expect(getVoteRewardAt(db, USER_ID)).toBeNull();
    expect(hasRedeemedVoteReward(db, USER_ID, SECRET)).toBe(true);
    expect(claimVoteReward(db, USER_ID, NOW + VOTE_REWARD_MS, SECRET)).toEqual({
      granted: false,
      alreadyRedeemed: true,
    });
  });

  it('stores a keyed HMAC rather than the raw Discord id in the permanent ledger', () => {
    claimVoteReward(db, USER_ID, NOW, SECRET);
    const row = db.prepare('SELECT user_hash FROM vote_redemption').get() as { user_hash: string };

    expect(row.user_hash).toBe(voteRedemptionHash(SECRET, USER_ID));
    expect(row.user_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.user_hash).not.toContain(USER_ID);
  });

  it('purges expired raw entitlements without removing lifetime markers', () => {
    claimVoteReward(db, USER_ID, NOW, SECRET);
    expect(purgeExpiredVoteRewards(db, NOW + VOTE_REWARD_MS - 1)).toBe(0);
    expect(purgeExpiredVoteRewards(db, NOW + VOTE_REWARD_MS)).toBe(1);
    expect(getVoteRewardAt(db, USER_ID)).toBeNull();
    expect(hasRedeemedVoteReward(db, USER_ID, SECRET)).toBe(true);
  });

  it('does not overwrite or extend a paid Plus entitlement', () => {
    const paidExpiry = grantUserPremium(db, USER_ID, 30, 'kofi', NOW);
    claimVoteReward(db, USER_ID, NOW, SECRET);

    expect(getUserPremiumExpiry(db, USER_ID)).toBe(paidExpiry);
    expect(db.prepare('SELECT source FROM premium_user WHERE user_id = ?').get(USER_ID)).toEqual({
      source: 'kofi',
    });
  });

  it('reports permanent eligibility honestly', () => {
    expect(voteRewardStatus(db, USER_ID, SECRET)).toEqual({
      eligible: true,
      alreadyRedeemed: false,
    });
    claimVoteReward(db, USER_ID, NOW, SECRET);
    expect(voteRewardStatus(db, USER_ID, SECRET)).toEqual({
      eligible: false,
      alreadyRedeemed: true,
    });
  });

  it('rejects weak secrets and malformed Discord ids', () => {
    expect(() => voteRedemptionHash('short', USER_ID)).toThrow(/at least 32/i);
    expect(() => voteRedemptionHash(SECRET, 'not-an-id')).toThrow(/Discord user id/i);
  });
});

describe('vote reward persistence across process/VPS restarts', () => {
  it('reopening the on-disk SQLite database cannot make an account eligible again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vozen-vote-'));
    const dbPath = join(dir, 'tts.db');
    try {
      const first = initDb(dbPath);
      claimVoteReward(first, USER_ID, NOW, SECRET);
      first.close();

      const afterRestart = initDb(dbPath);
      try {
        expect(hasRedeemedVoteReward(afterRestart, USER_ID, SECRET)).toBe(true);
        expect(claimVoteReward(afterRestart, USER_ID, NOW + 365 * 86_400_000, SECRET)).toEqual({
          granted: false,
          alreadyRedeemed: true,
        });
        expect(() =>
          hasRedeemedVoteReward(afterRestart, USER_ID, 'abcdef0123456789abcdef0123456789'),
        ).toThrow(/does not match/i);
      } finally {
        afterRestart.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
