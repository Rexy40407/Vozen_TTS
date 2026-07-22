// src/store/voteReward.ts
//
// A verified top.gg vote can grant one 48-hour Vozen Plus trial per Discord
// account, once for the lifetime of the promotion. Two records deliberately have
// different lifecycles:
//   - vote_reward: raw user id + timestamp while the 48h entitlement is useful;
//   - vote_redemption: permanent keyed HMAC, never the raw id, which prevents a
//     second claim after expiry, /privacy erase, restart, or deploy.
//
// The dedicated VOTE_REDEMPTION_SECRET must stay stable. Rotating it without a
// ledger migration would make old HMACs unmatchable, so production backs up both
// the SQLite database and the .env separately.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';

/** Duration of the only vote reward an account can ever receive. */
export const VOTE_REWARD_HOURS = 48;
export const VOTE_REWARD_MS = VOTE_REWARD_HOURS * 60 * 60 * 1000;
export const VOTE_REDEMPTION_SECRET_MIN_LENGTH = 32;

function validatedSecretFingerprint(secret: string): string {
  if (secret.length < VOTE_REDEMPTION_SECRET_MIN_LENGTH) {
    throw new Error(
      `VOTE_REDEMPTION_SECRET must contain at least ${VOTE_REDEMPTION_SECRET_MIN_LENGTH} characters`,
    );
  }
  return createHash('sha256').update(`vozen-vote-redemption:v1:${secret}`).digest('hex');
}

/** Pins the ledger to one key and refuses silent eligibility resets after key rotation/loss. */
function assertStableRedemptionSecret(db: Database.Database, secret: string): void {
  const fingerprint = validatedSecretFingerprint(secret);
  db.prepare(
    `INSERT OR IGNORE INTO vote_redemption_meta (singleton, secret_fingerprint)
     VALUES (1, ?)`,
  ).run(fingerprint);
  const row = db
    .prepare('SELECT secret_fingerprint FROM vote_redemption_meta WHERE singleton = 1')
    .get() as { secret_fingerprint: string };
  const expected = Buffer.from(row.secret_fingerprint, 'hex');
  const received = Buffer.from(fingerprint, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error(
      'VOTE_REDEMPTION_SECRET does not match the key pinned to this database; restore the original key or run an explicit ledger migration',
    );
  }
}

/**
 * Pins the stable key during startup and backfills any entitlement rows created by
 * an older deployment. This closes the upgrade gap where a previous recipient could
 * otherwise vote again after the lifetime ledger is introduced.
 */
export function initializeVoteRedemptionLedger(db: Database.Database, secret: string): number {
  const initialize = db.transaction((): number => {
    assertStableRedemptionSecret(db, secret);
    const legacyRewards = db
      .prepare('SELECT user_id, rewarded_at FROM vote_reward')
      .all() as Array<{ user_id: string; rewarded_at: number }>;
    const insert = db.prepare(
      'INSERT OR IGNORE INTO vote_redemption (user_hash, redeemed_at) VALUES (?, ?)',
    );
    let backfilled = 0;
    for (const reward of legacyRewards) {
      backfilled += insert.run(
        voteRedemptionHash(secret, reward.user_id),
        reward.rewarded_at,
      ).changes;
    }
    return backfilled;
  });
  return initialize();
}

export interface VoteRewardResult {
  /** true only for the account's first verified vote. */
  granted: boolean;
  /** End of the 48h Plus trial, present when granted=true. */
  expiresAt?: number;
  /** true when the permanent ledger already contained this account. */
  alreadyRedeemed?: boolean;
}

/** Raw entitlement timestamp (temporary/erasable), or null when absent. */
export function getVoteRewardAt(db: Database.Database, userId: string): number | null {
  const row = db.prepare('SELECT rewarded_at FROM vote_reward WHERE user_id = ?').get(userId) as
    { rewarded_at: number } | undefined;
  return row?.rewarded_at ?? null;
}

/** Stable pseudonymous key; the raw Discord id is never written to the lifetime ledger. */
export function voteRedemptionHash(secret: string, userId: string): string {
  validatedSecretFingerprint(secret);
  if (!/^\d{5,25}$/.test(userId)) throw new Error('invalid Discord user id');
  return createHmac('sha256', secret).update(`discord:${userId}`).digest('hex');
}

export function hasRedeemedVoteReward(
  db: Database.Database,
  userId: string,
  secret: string,
): boolean {
  assertStableRedemptionSecret(db, secret);
  const userHash = voteRedemptionHash(secret, userId);
  return !!db.prepare('SELECT 1 FROM vote_redemption WHERE user_hash = ?').get(userHash);
}

/**
 * Grants the one-time reward transactionally. INSERT OR IGNORE on the HMAC ledger
 * is the concurrency/idempotency gate: simultaneous delivery, Top.gg retry, shard,
 * or process restart can produce at most one successful claim.
 */
export function claimVoteReward(
  db: Database.Database,
  userId: string,
  now: number,
  redemptionSecret: string,
): VoteRewardResult {
  assertStableRedemptionSecret(db, redemptionSecret);
  const userHash = voteRedemptionHash(redemptionSecret, userId);
  const tx = db.transaction((): VoteRewardResult => {
    const marker = db
      .prepare('INSERT OR IGNORE INTO vote_redemption (user_hash, redeemed_at) VALUES (?, ?)')
      .run(userHash, now);
    if (marker.changes !== 1) return { granted: false, alreadyRedeemed: true };

    db.prepare(
      `INSERT INTO vote_reward (user_id, rewarded_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET rewarded_at = excluded.rewarded_at`,
    ).run(userId, now);
    return { granted: true, expiresAt: now + VOTE_REWARD_MS };
  });
  return tx();
}

export interface VoteRewardStatus {
  eligible: boolean;
  alreadyRedeemed: boolean;
}

/** Read-only status for /vote, /premium, and honest upsell copy. */
export function voteRewardStatus(
  db: Database.Database,
  userId: string,
  redemptionSecret: string,
): VoteRewardStatus {
  const alreadyRedeemed = hasRedeemedVoteReward(db, userId, redemptionSecret);
  return { eligible: !alreadyRedeemed, alreadyRedeemed };
}

/**
 * Removes expired raw-user entitlement rows. The lifetime HMAC markers are never
 * removed here: they are the minimum anti-abuse record that enforces "once ever".
 */
export function purgeExpiredVoteRewards(db: Database.Database, now: number): number {
  return db.prepare('DELETE FROM vote_reward WHERE rewarded_at <= ?').run(now - VOTE_REWARD_MS)
    .changes;
}
