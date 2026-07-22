import type Database from 'better-sqlite3';
import { VOTE_REWARD_MS } from './voteReward';

// Vozen Premium / Plus: EXPIRY-based subscriptions (unix ms). No row or expired =>
// Free. Paid features (Kokoro/Google HD, full effects, etc.) check isGuildPremium/
// isUserPremium. Purchases arrive via the
// Ko-fi webhook (source 'kofi'); the owner can also grant by hand with /vozen-grant (source 'manual').

export type PremiumKind = 'guild' | 'user';

const DAY_MS = 86_400_000;

export function isGuildPremium(db: Database.Database, guildId: string, now: number): boolean {
  // DIRECT server Premium (redeem/Ko-fi/manual) or current Discord Premium App access.
  const row = db
    .prepare(
      `SELECT MAX(expires_at) AS expires_at
         FROM (
           SELECT expires_at FROM premium_guild WHERE guild_id = ?
           UNION ALL
           SELECT expires_at FROM discord_premium_entitlement
             WHERE kind = 'guild' AND target_id = ?
         )`,
    )
    .get(guildId, guildId) as { expires_at: number | null };
  if (row.expires_at !== null && row.expires_at > now) return true;
  // ...OR a PASS: is there an activation of this server whose pass has not expired yet?
  const pass = db
    .prepare(
      `SELECT 1 FROM premium_pass_activation a
       JOIN premium_pass p ON p.user_id = a.user_id
       WHERE a.guild_id = ? AND p.expires_at > ? LIMIT 1`,
    )
    .get(guildId, now) as { 1: number } | undefined;
  return !!pass;
}

export function isUserPremium(db: Database.Database, userId: string, now: number): boolean {
  const row = db
    .prepare(
      `SELECT MAX(expires_at) AS expires_at
         FROM (
           SELECT expires_at FROM premium_user WHERE user_id = ?
           UNION ALL
           SELECT rewarded_at + ? AS expires_at FROM vote_reward WHERE user_id = ?
           UNION ALL
           SELECT expires_at FROM discord_premium_entitlement
             WHERE kind = 'user' AND target_id = ?
         )`,
    )
    .get(userId, VOTE_REWARD_MS, userId, userId) as { expires_at: number | null };
  return row.expires_at !== null && row.expires_at > now;
}

/** Guild premium expiry (unix ms) or null if it never had one. May be in the past. */
export function getGuildPremiumExpiry(db: Database.Database, guildId: string): number | null {
  const row = db.prepare('SELECT expires_at FROM premium_guild WHERE guild_id = ?').get(guildId) as
    { expires_at: number } | undefined;
  return row ? row.expires_at : null;
}

/**
 * EFFECTIVE end of the server's Premium for DISPLAY (active only): the max between the direct
 * expiry (redeem/Ko-fi/manual), the current Discord entitlement, and the end of any pass that has an active license
 * here. null if the server is not Premium now. (To EXTEND, use getGuildPremium
 * Expiry, which is only the direct row.)
 */
export function effectiveGuildPremiumExpiry(
  db: Database.Database,
  guildId: string,
  now: number,
): number | null {
  const row = db
    .prepare(
      `SELECT MAX(exp) AS m FROM (
         SELECT expires_at AS exp FROM premium_guild WHERE guild_id = ? AND expires_at > ?
         UNION ALL
         SELECT expires_at AS exp FROM discord_premium_entitlement
           WHERE kind = 'guild' AND target_id = ? AND expires_at > ?
         UNION ALL
         SELECT p.expires_at FROM premium_pass_activation a
           JOIN premium_pass p ON p.user_id = a.user_id
           WHERE a.guild_id = ? AND p.expires_at > ?
       )`,
    )
    .get(guildId, now, guildId, now, guildId, now) as { m: number | null };
  return row.m ?? null;
}

/** User Plus expiry (unix ms) or null if it never had one. May be in the past. */
export function getUserPremiumExpiry(db: Database.Database, userId: string): number | null {
  const row = db
    .prepare(
      `SELECT MAX(expires_at) AS expires_at
         FROM (
           SELECT expires_at FROM premium_user WHERE user_id = ?
           UNION ALL
           SELECT rewarded_at + ? AS expires_at FROM vote_reward WHERE user_id = ?
           UNION ALL
           SELECT expires_at FROM discord_premium_entitlement
             WHERE kind = 'user' AND target_id = ?
         )`,
    )
    .get(userId, VOTE_REWARD_MS, userId, userId) as { expires_at: number | null };
  return row.expires_at;
}

/**
 * Grants `days` of premium to the guild. EXTENDS from the max between now and the current
 * expiry (renewing before expiry accumulates, no time lost). Returns the new expiry (ms).
 */
export function grantGuildPremium(
  db: Database.Database,
  guildId: string,
  days: number,
  source: string,
  now: number,
): number {
  const cur = getGuildPremiumExpiry(db, guildId);
  const base = cur && cur > now ? cur : now;
  const expiresAt = base + days * DAY_MS;
  db.prepare(
    `INSERT INTO premium_guild (guild_id, expires_at, source)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET expires_at = excluded.expires_at, source = excluded.source`,
  ).run(guildId, expiresAt, source);
  return expiresAt;
}

/** Same as grantGuildPremium but for Vozen Plus (per-user). */
export function grantUserPremium(
  db: Database.Database,
  userId: string,
  days: number,
  source: string,
  now: number,
): number {
  const row = db.prepare('SELECT expires_at FROM premium_user WHERE user_id = ?').get(userId) as
    { expires_at: number } | undefined;
  const base = row && row.expires_at > now ? row.expires_at : now;
  const expiresAt = base + days * DAY_MS;
  db.prepare(
    `INSERT INTO premium_user (user_id, expires_at, source)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET expires_at = excluded.expires_at, source = excluded.source`,
  ).run(userId, expiresAt, source);
  return expiresAt;
}

// ── Premium Pass (Ko-fi): N per-user licenses, activated per server ───────
// A Premium (guild) purchase gives the PERSON a pass with `seats` licenses and an
// ABSOLUTE end date. The person spends a license on a server (activateSeat) and can release it
// (deactivateSeat) to use it on another — the clock always runs on the pass, not the server.

export interface PremiumPass {
  seats: number;
  expiresAt: number;
  source: string;
}

export type ActivateStatus = 'ok' | 'already' | 'no_pass' | 'expired' | 'no_seats';

export interface ActivateResult {
  status: ActivateStatus;
  seats?: number; // total licenses of the pass
  used?: number; // licenses in use after the operation
  expiresAt?: number; // pass end (unix ms)
}

/** The user's pass (or null if they never bought one). expiresAt may be in the past. */
export function getPremiumPass(db: Database.Database, userId: string): PremiumPass | null {
  const row = db
    .prepare('SELECT seats, expires_at, source FROM premium_pass WHERE user_id = ?')
    .get(userId) as { seats: number; expires_at: number; source: string } | undefined;
  return row ? { seats: row.seats, expiresAt: row.expires_at, source: row.source } : null;
}

/** Servers where the user has an active license (activation order). */
export function listPassActivations(db: Database.Database, userId: string): string[] {
  return (
    db
      .prepare(
        'SELECT guild_id FROM premium_pass_activation WHERE user_id = ? ORDER BY activated_at',
      )
      .all(userId) as { guild_id: string }[]
  ).map((r) => r.guild_id);
}

/**
 * Owner (and seat count) of the ACTIVE pass that covers this guild — to know which Google
 * HD allowance POOL to debit (the pool belongs to the PASS, shared across its servers,
 * keyed by owner). Non-expired passes only. `premium_pass_activation` has no UNIQUE on
 * guild_id, so two owners COULD have activated the same guild — DETERMINISTIC
 * tiebreak by the oldest `activated_at` (the first to cover the guild). null if
 * no active pass covers the guild (e.g. direct Premium or Discord access, no pass).
 */
export function resolveGuildPassOwner(
  db: Database.Database,
  guildId: string,
  now: number,
): { ownerId: string; seats: number } | null {
  const row = db
    .prepare(
      `SELECT a.user_id AS owner, p.seats AS seats
       FROM premium_pass_activation a
       JOIN premium_pass p ON p.user_id = a.user_id
       WHERE a.guild_id = ? AND p.expires_at > ?
       ORDER BY a.activated_at ASC
       LIMIT 1`,
    )
    .get(guildId, now) as { owner: string; seats: number } | undefined;
  return row ? { ownerId: row.owner, seats: row.seats } : null;
}

/** How many licenses the user has in use right now. */
export function countActiveSeats(db: Database.Database, userId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM premium_pass_activation WHERE user_id = ?')
    .get(userId) as { n: number };
  return row.n;
}

/**
 * Grants/renews a pass of `seats` licenses for `days` days. EXTENDS from the max
 * between now and the current end (renewing before expiry accumulates). Never REDUCES the
 * number of licenses (uses the max) — upgrading the plan increases it, renewing keeps it. Returns the new end.
 */
export function grantGuildPass(
  db: Database.Database,
  userId: string,
  seats: number,
  days: number,
  source: string,
  now: number,
): number {
  const cur = getPremiumPass(db, userId);
  const base = cur && cur.expiresAt > now ? cur.expiresAt : now;
  const expiresAt = base + days * DAY_MS;
  const finalSeats = cur ? Math.max(cur.seats, seats) : seats;
  db.prepare(
    `INSERT INTO premium_pass (user_id, seats, expires_at, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET seats = excluded.seats, expires_at = excluded.expires_at, source = excluded.source`,
  ).run(userId, finalSeats, expiresAt, source);
  return expiresAt;
}

/**
 * Spends a pass license on server `guildId`. Transactional (count-and-insert) so as not
 * to exceed the limit with two simultaneous clicks. Idempotent: reactivating the same server
 * returns 'already' without spending another license.
 */
export function activateSeat(
  db: Database.Database,
  userId: string,
  guildId: string,
  now: number,
): ActivateResult {
  const tx = db.transaction((): ActivateResult => {
    const pass = getPremiumPass(db, userId);
    if (!pass) return { status: 'no_pass' };
    if (pass.expiresAt <= now) return { status: 'expired', expiresAt: pass.expiresAt };
    const already = db
      .prepare('SELECT 1 FROM premium_pass_activation WHERE user_id = ? AND guild_id = ?')
      .get(userId, guildId);
    const used = countActiveSeats(db, userId);
    if (already) return { status: 'already', seats: pass.seats, used, expiresAt: pass.expiresAt };
    if (used >= pass.seats)
      return { status: 'no_seats', seats: pass.seats, used, expiresAt: pass.expiresAt };
    db.prepare(
      'INSERT INTO premium_pass_activation (user_id, guild_id, activated_at) VALUES (?, ?, ?)',
    ).run(userId, guildId, now);
    return { status: 'ok', seats: pass.seats, used: used + 1, expiresAt: pass.expiresAt };
  });
  return tx();
}

/** Releases the license of `guildId`. Returns true if there was an activation to remove. */
export function deactivateSeat(db: Database.Database, userId: string, guildId: string): boolean {
  const res = db
    .prepare('DELETE FROM premium_pass_activation WHERE user_id = ? AND guild_id = ?')
    .run(userId, guildId);
  return res.changes > 0;
}

// ── Premium status view (for the site's Premium Panel) ───────────────────────────
// Assembles, for ONE user, everything the panel shows: Plus (per-user) + Premium
// pass (licenses used/total, end, activated servers). PURE read function — the HTTP
// API (statusApi.ts) only calls it after validating the identity on Discord. Never by
// arbitrary ID: the caller must prove they own the token.

export interface PremiumStatusView {
  plus: { active: boolean; expiresAt: number | null };
  pass: {
    seats: number;
    used: number;
    expiresAt: number;
    active: boolean;
    guilds: string[];
  } | null;
}

/** Complete premium status of a user (for display in the panel). */
export function buildPremiumStatus(
  db: Database.Database,
  userId: string,
  now: number,
): PremiumStatusView {
  const plusExp = getUserPremiumExpiry(db, userId);
  const pass = getPremiumPass(db, userId);
  return {
    plus: { active: !!plusExp && plusExp > now, expiresAt: plusExp },
    pass: pass
      ? {
          seats: pass.seats,
          used: countActiveSeats(db, userId),
          expiresAt: pass.expiresAt,
          active: pass.expiresAt > now,
          guilds: listPassActivations(db, userId),
        }
      : null,
  };
}

// ── Ko-fi: HASH(email) -> Discord ID map (for renewals) ─────────────────────────
// The 1st purchase carries the Discord ID in the message; we store it indexed by the email HASH. The
// renewals do not resend the message, so we re-find the Discord ID by the hash of the
// payment email. The DB NEVER stores the email in clear (PII minimization) — the
// `emailHash` key is opaque (HMAC computed in the webhook, see hashKofiEmail in premium/kofi.ts).

/** Stores/updates the Discord ID associated with the HASH of a Ko-fi email. */
export function rememberKofiSupporter(
  db: Database.Database,
  emailHash: string,
  discordId: string,
  now: number,
): void {
  db.prepare(
    `INSERT INTO kofi_supporter (email_hash, discord_id, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(email_hash) DO UPDATE SET discord_id = excluded.discord_id, updated_at = excluded.updated_at`,
  ).run(emailHash, discordId, now);
}

/** Re-finds the Discord ID from the HASH of a Ko-fi email (or null). */
export function lookupKofiSupporter(db: Database.Database, emailHash: string): string | null {
  const row = db
    .prepare('SELECT discord_id FROM kofi_supporter WHERE email_hash = ?')
    .get(emailHash) as { discord_id: string } | undefined;
  return row ? row.discord_id : null;
}

/**
 * Records a Ko-fi transaction as processed (webhook idempotency). Returns true
 * the 1st time (the delivery must be applied) and false on a duplicate/retry (already processed
 * — the caller confirms 200 WITHOUT applying the grant again, which accumulates expiry).
 * The caller should wrap record+grant in a db.transaction so they are atomic:
 * if the grant fails, the record also reverts and a legitimate retry passes again.
 */
export function recordKofiTransaction(
  db: Database.Database,
  transactionId: string,
  now: number,
): boolean {
  const res = db
    .prepare('INSERT OR IGNORE INTO kofi_transaction (transaction_id, processed_at) VALUES (?, ?)')
    .run(transactionId, now);
  return res.changes > 0;
}

// ── Discord Premium Apps (entitlements) ──────────────────────────────────────
// When the operator enables Discord's native monetization (SKUs), purchases arrive
// as entitlements. Their current state is reconciled in discord_premium_entitlement,
// independently of durable Ko-fi/redeem/manual grants in premium_*. This keeps a Discord
// cancellation from revoking a separately purchased entitlement.

export interface EntitlementGrant {
  kind: PremiumKind;
  id: string; // guildId (guild) or userId (user)
  expiresAt: number; // unix ms
}

export interface EntitlementSyncResult {
  guildsActive: number;
  usersActive: number;
  revoked: number;
}

/**
 * Reconciles ALL active Discord entitlements with the current Discord state table.
 * `grants` must be the COMPLETE list of active entitlements (full fetch). Duplicate grants
 * for the same target collapse to their longest expiry. This never changes premium_* direct
 * purchase records. Transactional.
 */
export function syncDiscordEntitlements(
  db: Database.Database,
  grants: EntitlementGrant[],
): EntitlementSyncResult {
  const tx = db.transaction((): EntitlementSyncResult => {
    const active = new Map<string, EntitlementGrant>();
    for (const grant of grants) {
      const key = `${grant.kind}:${grant.id}`;
      const existing = active.get(key);
      if (!existing || grant.expiresAt > existing.expiresAt) active.set(key, grant);
    }

    const stored = db.prepare('SELECT kind, target_id FROM discord_premium_entitlement').all() as {
      kind: PremiumKind;
      target_id: string;
    }[];
    const stale = stored.filter((row) => !active.has(`${row.kind}:${row.target_id}`));
    const deleteEntitlement = db.prepare(
      'DELETE FROM discord_premium_entitlement WHERE kind = ? AND target_id = ?',
    );
    for (const row of stale) deleteEntitlement.run(row.kind, row.target_id);

    const upsertEntitlement = db.prepare(
      `INSERT INTO discord_premium_entitlement (kind, target_id, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT(kind, target_id) DO UPDATE SET expires_at = excluded.expires_at`,
    );
    for (const grant of active.values()) {
      upsertEntitlement.run(grant.kind, grant.id, grant.expiresAt);
    }
    return {
      guildsActive: [...active.values()].filter((g) => g.kind === 'guild').length,
      usersActive: [...active.values()].filter((g) => g.kind === 'user').length,
      revoked: stale.length,
    };
  });
  return tx();
}
