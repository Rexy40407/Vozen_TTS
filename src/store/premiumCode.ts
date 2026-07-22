import type Database from 'better-sqlite3';

// Gift codes: the owner generates them with /generate-code (owner-only), the person redeems
// with /redeem. SINGLE-USE — redemption is atomic (transaction + UPDATE ... WHERE
// redeemed_by IS NULL) so two simultaneous redemptions don't spend the same code twice.
// See the premium_code table in db.ts. The grant itself reuses grantUserPremium/
// grantGuildPass (like Ko-fi and /vozen-grant), with source 'code'.

export type CodePlan = 'premium' | 'plus';

export interface PremiumCodeInput {
  code: string;
  plan: CodePlan;
  days: number;
  /** Only relevant for 'premium' (number of pass seats); 0 for 'plus'. */
  seats: number;
  createdBy: string;
  createdAt: number;
  /** CODE validity (unix ms) — null = never expires. Not to be confused with the premium duration. */
  expiresAt: number | null;
}

export interface PremiumCodeRow extends PremiumCodeInput {
  redeemedBy: string | null;
  redeemedAt: number | null;
}

export type RedeemResult =
  | { ok: true; plan: CodePlan; days: number; seats: number }
  | { ok: false; reason: 'not-found' | 'used' | 'expired' };

/** Inserts a new code. Returns false if the code already exists (collision — the caller regenerates). */
export function insertPremiumCode(db: Database.Database, c: PremiumCodeInput): boolean {
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO premium_code
         (code, plan, days, seats, created_by, created_at, expires_at, redeemed_by, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    )
    .run(c.code, c.plan, c.days, c.seats, c.createdBy, c.createdAt, c.expiresAt);
  return res.changes > 0;
}

/** Reads a code by value (already normalized). null if it does not exist. */
export function getPremiumCode(db: Database.Database, code: string): PremiumCodeRow | null {
  const r = db.prepare('SELECT * FROM premium_code WHERE code = ?').get(code) as
    | {
        code: string;
        plan: string;
        days: number;
        seats: number;
        created_by: string;
        created_at: number;
        expires_at: number | null;
        redeemed_by: string | null;
        redeemed_at: number | null;
      }
    | undefined;
  if (!r) return null;
  return {
    code: r.code,
    plan: r.plan as CodePlan,
    days: r.days,
    seats: r.seats,
    createdBy: r.created_by,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    redeemedBy: r.redeemed_by,
    redeemedAt: r.redeemed_at,
  };
}

/** What the code grants — passed to `applyGrant` for it to apply the premium. */
export interface RedeemClaim {
  plan: CodePlan;
  days: number;
  seats: number;
}

/**
 * Redeems a code ATOMICALLY (single-use). In a transaction: validates existence/use/
 * expiration, claims the row with UPDATE ... WHERE redeemed_by IS NULL and — in the SAME
 * transaction — applies the grant via `applyGrant`. If two redemptions ran together, only
 * one sees changes>0; the other gets 'used'. If `applyGrant` throws, the transaction rolls
 * back and the code is NOT burned (same pattern as the Ko-fi webhook: claim+grant is atomic).
 * `applyGrant` receives the SAME `db` (inside the transaction) and is synchronous (better-sqlite3).
 */
export function redeemPremiumCode(
  db: Database.Database,
  code: string,
  userId: string,
  now: number,
  applyGrant?: (db: Database.Database, claim: RedeemClaim) => void,
): RedeemResult {
  return db.transaction((): RedeemResult => {
    const row = getPremiumCode(db, code);
    if (!row) return { ok: false, reason: 'not-found' };
    if (row.redeemedBy) return { ok: false, reason: 'used' };
    if (row.expiresAt != null && row.expiresAt <= now) return { ok: false, reason: 'expired' };
    const upd = db
      .prepare(
        'UPDATE premium_code SET redeemed_by = ?, redeemed_at = ? WHERE code = ? AND redeemed_by IS NULL',
      )
      .run(userId, now, code);
    if (upd.changes === 0) return { ok: false, reason: 'used' }; // race: someone redeemed first
    // Grant INSIDE the transaction: if it throws, the UPDATE above rolls back with it.
    applyGrant?.(db, { plan: row.plan, days: row.days, seats: row.seats });
    return { ok: true, plan: row.plan, days: row.days, seats: row.seats };
  })();
}
