// src/premium/entitlements.ts
//
// Bridge between Discord's "entitlements" (Premium Apps purchases) and internal premium.
// Discord's Monetization Policy requires that paid features also be purchasable via
// Premium Apps; when the operator creates the SKUs and sets PREMIUM_GUILD_SKU_ID /
// PREMIUM_USER_SKU_ID, each active purchase becomes a reconciled Discord entitlement.
// WITHOUT those IDs configured, ALL of this stays INERT (the bot runs
// as it does today, only with /redeem codes) — so it is safe to have in production before
// the app is verified and native monetization is turned on.
//
// The logic is PURE and testable: it takes Entitlement-like objects (no dependency on discord.js).

import type { EntitlementGrant } from '../store/premium';

/** Configured SKUs (env). Absent => that type's mapping produces no grants. */
export interface EntitlementSkuConfig {
  guildSkuId?: string;
  userSkuId?: string;
}

/** Minimal shape of a Discord Entitlement that we need (subset of discord.js). */
export interface EntitlementLike {
  skuId: string;
  guildId?: string | null;
  userId?: string | null;
  /** End of the subscription (unix ms) or null = one-time/perpetual purchase. */
  endsTimestamp?: number | null;
  /** true when the entitlement has been removed (refund). */
  deleted?: boolean;
}

/**
 * One-time purchases (endsTimestamp null) are perpetual; we give them an expiry far in the
 * future (refreshed on each sync). ~100 years — in practice "forever" without date overflow.
 */
export const PERPETUAL_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/** true if the entitlement is ACTIVE now (not removed and not expired). */
export function isEntitlementActive(e: EntitlementLike, now: number): boolean {
  if (e.deleted) return false;
  const ends = e.endsTimestamp ?? null;
  return ends === null || ends > now;
}

/**
 * Translates the COMPLETE list of Discord entitlements into the active premium grants, per
 * the configured SKUs. Ignores inactive entitlements, those from unknown SKUs, or those
 * without the target id (guild/user). Pure function.
 */
export function activeEntitlementGrants(
  entitlements: EntitlementLike[],
  sku: EntitlementSkuConfig,
  now: number,
): EntitlementGrant[] {
  const grants: EntitlementGrant[] = [];
  for (const e of entitlements) {
    if (!isEntitlementActive(e, now)) continue;
    const expiresAt = e.endsTimestamp ?? now + PERPETUAL_MS;
    if (sku.guildSkuId && e.skuId === sku.guildSkuId && e.guildId) {
      grants.push({ kind: 'guild', id: e.guildId, expiresAt });
    } else if (sku.userSkuId && e.skuId === sku.userSkuId && e.userId) {
      grants.push({ kind: 'user', id: e.userId, expiresAt });
    }
  }
  return grants;
}

/** true if there is at least one configured SKU (otherwise the subsystem stays inert). */
export function entitlementsEnabled(sku: EntitlementSkuConfig): boolean {
  return !!(sku.guildSkuId || sku.userSkuId);
}

/**
 * Joins ALL pages of a cursor-based endpoint (Discord's `/entitlements` does NOT
 * auto-paginate: it returns at most `pageSize` per call). CRITICAL for reconciliation:
 * the sync deletes the 'discord' premium that does not come in the list, so the list MUST
 * be complete — otherwise, past `pageSize` subscriptions, we would revoke paying customers.
 * `fetchPage(after)` returns the next page (after the id `after`); we stop when a page comes
 * back incomplete (< pageSize) or empty. `maxPages` is an anti-loop guard.
 */
export async function collectPaged<T extends { id: string }>(
  fetchPage: (after: string | undefined) => Promise<T[]>,
  pageSize = 100,
  maxPages = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;
  for (let p = 0; p < maxPages; p++) {
    const page = await fetchPage(after);
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < pageSize) break;
    after = page[page.length - 1].id;
  }
  return all;
}
