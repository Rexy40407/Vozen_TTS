import type Database from 'better-sqlite3';

// PENDING Ko-fi grants: a purchase that arrived via the webhook WITHOUT an associable Discord ID
// (Ko-fi's subscription checkout has no reliable message box). Instead of losing it
// in a log, we store it here waiting to be CLAIMED by the buyer on the site (Discord login +
// receipt code). Indexed by the tx id (which the buyer has on the receipt, a strong key) and by the
// email HASH (for orphan renewals); NEVER the email in cleartext — see hashKofiEmail in
// premium/kofi.ts. On claiming, the grant is applied to the Discord ID and email->Discord
// ID is memorized (kofi_supporter), so subsequent renewals resolve themselves.

export interface PendingGrant {
  transactionId: string;
  /** HMAC HASH of the email (never the cleartext email), or null if the payload had no email. */
  emailHash: string | null;
  plan: string; // 'plus' | 'premium'
  days: number;
  seats: number; // relevant only for 'premium'
  createdAt: number;
  /** Unix ms when it was claimed, or null while unclaimed. */
  claimedAt: number | null;
  /**
   * true when this row is a membership payment (plan 035). Governs claim blast radius: only
   * subscriptions are applied alongside a sibling on the same email, and only a subscription
   * claim may rebind email->Discord. Keeps a gift from stealing the buyer renewals.
   */
  isSubscription: boolean;
}

export interface PendingGrantInput {
  transactionId: string;
  emailHash: string | null;
  plan: string;
  days: number;
  seats: number;
  /** Membership payment? Defaults to false — a Shop order is never a subscription. */
  isSubscription?: boolean;
}

/**
 * Records a purchase without a Discord ID as PENDING. INSERT OR IGNORE on the PK (transaction_id):
 * idempotent — a Ko-fi re-delivery (same tx) doesn't duplicate. Returns true if it inserted
 * (1st time), false if it already existed.
 */
export function recordPendingGrant(
  db: Database.Database,
  input: PendingGrantInput,
  now: number,
): boolean {
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO kofi_pending
         (transaction_id, email_hash, plan, days, seats, created_at, claimed_at, is_subscription)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(
      input.transactionId,
      input.emailHash,
      input.plan,
      input.days,
      input.seats,
      now,
      input.isSubscription ? 1 : 0,
    );
  return res.changes > 0;
}

function rowToPending(row: {
  transaction_id: string;
  email_hash: string | null;
  plan: string;
  days: number;
  seats: number;
  created_at: number;
  claimed_at: number | null;
  is_subscription: number;
}): PendingGrant {
  return {
    transactionId: row.transaction_id,
    emailHash: row.email_hash,
    plan: row.plan,
    days: row.days,
    seats: row.seats,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    isSubscription: row.is_subscription === 1,
  };
}

/** UNCLAIMED pending with this tx id, or null. */
export function findUnclaimedPendingByTx(
  db: Database.Database,
  transactionId: string,
): PendingGrant | null {
  const row = db
    .prepare('SELECT * FROM kofi_pending WHERE transaction_id = ? AND claimed_at IS NULL')
    .get(transactionId) as Parameters<typeof rowToPending>[0] | undefined;
  return row ? rowToPending(row) : null;
}

/**
 * ALL UNCLAIMED pendings with this email hash (orphan renewals: someone who bought
 * several times without ever claiming has several pendings — the claim applies all). A pending
 * without email (email_hash NULL) never matches here (only claimable by tx id).
 */
export function listUnclaimedPendingByEmailHash(
  db: Database.Database,
  emailHash: string,
): PendingGrant[] {
  const rows = db
    .prepare(
      'SELECT * FROM kofi_pending WHERE email_hash = ? AND claimed_at IS NULL ORDER BY created_at',
    )
    .all(emailHash) as Parameters<typeof rowToPending>[0][];
  return rows.map(rowToPending);
}

/**
 * ALL unclaimed pendings, newest first, capped. For the admin console overview (plan 037): the
 * owner sees the purchases still waiting for a buyer to claim them, to reconcile against Ko-fi.
 * The email is never here in cleartext (only its hash), so this leaks nothing the owner cannot
 * already see in their own seller panel.
 */
export function listAllUnclaimedPending(db: Database.Database, cap = 500): PendingGrant[] {
  const rows = db
    .prepare('SELECT * FROM kofi_pending WHERE claimed_at IS NULL ORDER BY created_at DESC LIMIT ?')
    .all(cap) as Parameters<typeof rowToPending>[0][];
  return rows.map(rowToPending);
}

/**
 * Marks the pending as claimed. Idempotent: only affects rows still unclaimed
 * (claimed_at IS NULL), so a 2nd claim of the same tx returns false without re-applying.
 */
export function markPendingClaimed(
  db: Database.Database,
  transactionId: string,
  now: number,
): boolean {
  const res = db
    .prepare(
      'UPDATE kofi_pending SET claimed_at = ? WHERE transaction_id = ? AND claimed_at IS NULL',
    )
    .run(now, transactionId);
  return res.changes > 0;
}

/**
 * Purges pendings created before `cutoff` (data minimization — same spirit as the purge
 * of departed guilds). Deletes old claimed and unclaimed ones: the claimed were already
 * applied and the kofi_transaction ledger still guarantees the webhook's idempotency.
 * Returns the number of rows removed.
 */
export function purgeOldPendingGrants(db: Database.Database, cutoff: number): number {
  const res = db.prepare('DELETE FROM kofi_pending WHERE created_at < ?').run(cutoff);
  return res.changes;
}

/** Retention of a pending (90 days). After this the abandoned purchase is deleted
 * (data minimization). The buyer claims well before; renewals don't depend on
 * old pendings (they use the email->Discord ID map memorized on the 1st claim). */
export const PENDING_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Purge job interval (1x/day). */
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the pending-purge job: runs 1x on startup and then 1x/day. Never throws
 * (a run can't take down the bot). The timer is unref'd (doesn't hold the process). Returns
 * a `stop()` for tests/shutdown. The pure logic is in `purgeOldPendingGrants`.
 */
export function startPendingPurgeJob(
  db: Database.Database,
  onPurged?: (removed: number) => void,
): () => void {
  const tick = (): void => {
    try {
      const removed = purgeOldPendingGrants(db, Date.now() - PENDING_RETENTION_MS);
      if (removed > 0 && onPurged) onPurged(removed);
    } catch {
      // best-effort: never crash the maintenance loop.
    }
  };
  tick();
  const timer = setInterval(tick, PURGE_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return () => clearInterval(timer);
}
