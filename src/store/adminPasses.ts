// src/store/adminPasses.ts
//
// Read/revoke helpers for the admin console (plan 037). Grants reuse the tested
// grantUserPremium/grantGuildPass in ./premium — this module only adds what the console needs on
// top: an overview of who currently holds what, and a revoke that actually removes the access.
// Read-only functions never write; revoke deletes and reports whether anything existed.

import type Database from 'better-sqlite3';

/** An active per-user Plus. */
export interface AdminPlusRow {
  userId: string;
  expiresAt: number;
  source: string;
}

/** An active multi-seat pass, with how many of its seats are currently activated. */
export interface AdminPassRow {
  userId: string;
  seats: number;
  used: number;
  expiresAt: number;
  source: string;
}

export interface AdminPassesView {
  plus: AdminPlusRow[];
  passes: AdminPassRow[];
}

/** Defensive ceiling on a single listing (a pathological number of holders). Far above any real
 *  count — the console shows the most-recently-expiring first. */
const SCAN_CAP = 2000;

/**
 * Every ACTIVE Plus and pass (`expires_at > now`), most-recent-expiry first. `used` is the number
 * of seats currently activated for each pass. Pure read; touches only premium_user, premium_pass
 * and premium_pass_activation.
 */
export function listActivePremium(db: Database.Database, now: number): AdminPassesView {
  const plus = db
    .prepare(
      `SELECT user_id, expires_at, source FROM premium_user
        WHERE expires_at > ? ORDER BY expires_at DESC LIMIT ?`,
    )
    .all(now, SCAN_CAP) as Array<{ user_id: string; expires_at: number; source: string }>;

  const passes = db
    .prepare(
      `SELECT p.user_id, p.seats, p.expires_at, p.source,
              (SELECT COUNT(*) FROM premium_pass_activation a WHERE a.user_id = p.user_id) AS used
         FROM premium_pass p
        WHERE p.expires_at > ? ORDER BY p.expires_at DESC LIMIT ?`,
    )
    .all(now, SCAN_CAP) as Array<{
    user_id: string;
    seats: number;
    expires_at: number;
    source: string;
    used: number;
  }>;

  return {
    plus: plus.map((r) => ({ userId: r.user_id, expiresAt: r.expires_at, source: r.source })),
    passes: passes.map((r) => ({
      userId: r.user_id,
      seats: r.seats,
      used: r.used,
      expiresAt: r.expires_at,
      source: r.source,
    })),
  };
}

/** Removes a user's Plus. Returns true iff a row was deleted. */
export function revokeUserPremium(db: Database.Database, userId: string): boolean {
  const info = db.prepare('DELETE FROM premium_user WHERE user_id = ?').run(userId);
  return info.changes > 0;
}

/**
 * Removes a user's pass AND all of its seat activations, in ONE transaction. Both must go together:
 * an orphaned premium_pass_activation row would keep isGuildPremium reading true for a guild whose
 * pass no longer exists. Returns true iff a pass existed.
 */
export function revokeGuildPass(db: Database.Database, userId: string): boolean {
  return db.transaction(() => {
    const info = db.prepare('DELETE FROM premium_pass WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM premium_pass_activation WHERE user_id = ?').run(userId);
    return info.changes > 0;
  })();
}
