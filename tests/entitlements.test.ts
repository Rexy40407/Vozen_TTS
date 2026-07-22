// tests/entitlements.test.ts — Discord Premium Apps (Phase 3 compliance).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  activeEntitlementGrants,
  isEntitlementActive,
  entitlementsEnabled,
  collectPaged,
  PERPETUAL_MS,
  type EntitlementLike,
} from '../src/premium/entitlements';
import {
  isGuildPremium,
  isUserPremium,
  grantGuildPremium,
  grantUserPremium,
  effectiveGuildPremiumExpiry,
  getUserPremiumExpiry,
  syncDiscordEntitlements,
} from '../src/store/premium';

const SKU = { guildSkuId: 'sku-guild', userSkuId: 'sku-user' };
const NOW = 1_000_000;

describe('entitlements — pure mapping', () => {
  it('active entitlement from guild SKU -> guild grant', () => {
    const ents: EntitlementLike[] = [
      { skuId: 'sku-guild', guildId: 'g1', endsTimestamp: NOW + 100_000 },
    ];
    expect(activeEntitlementGrants(ents, SKU, NOW)).toEqual([
      { kind: 'guild', id: 'g1', expiresAt: NOW + 100_000 },
    ]);
  });

  it('endsTimestamp null (one-time purchase) -> perpetual expiry', () => {
    const ents: EntitlementLike[] = [{ skuId: 'sku-user', userId: 'u1', endsTimestamp: null }];
    const grants = activeEntitlementGrants(ents, SKU, NOW);
    expect(grants[0]).toEqual({ kind: 'user', id: 'u1', expiresAt: NOW + PERPETUAL_MS });
  });

  it('ignores expired, removed, or unknown-SKU entitlements', () => {
    const ents: EntitlementLike[] = [
      { skuId: 'sku-guild', guildId: 'g-old', endsTimestamp: NOW - 1 }, // expired
      { skuId: 'sku-user', userId: 'u-refund', endsTimestamp: NOW + 1, deleted: true }, // refund
      { skuId: 'sku-desconhecido', guildId: 'g-x', endsTimestamp: NOW + 1 }, // unconfigured SKU
    ];
    expect(activeEntitlementGrants(ents, SKU, NOW)).toEqual([]);
  });

  it('ignores an entitlement missing the target id', () => {
    const ents: EntitlementLike[] = [{ skuId: 'sku-guild', guildId: null, endsTimestamp: NOW + 1 }];
    expect(activeEntitlementGrants(ents, SKU, NOW)).toEqual([]);
  });

  it('only the configured SKU counts (no userSku -> ignores user entitlements)', () => {
    const ents: EntitlementLike[] = [{ skuId: 'sku-user', userId: 'u1', endsTimestamp: NOW + 1 }];
    expect(activeEntitlementGrants(ents, { guildSkuId: 'sku-guild' }, NOW)).toEqual([]);
  });

  it('isEntitlementActive: null=active, future=active, past/removed=inactive', () => {
    expect(isEntitlementActive({ skuId: 's', endsTimestamp: null }, NOW)).toBe(true);
    expect(isEntitlementActive({ skuId: 's', endsTimestamp: NOW + 1 }, NOW)).toBe(true);
    expect(isEntitlementActive({ skuId: 's', endsTimestamp: NOW - 1 }, NOW)).toBe(false);
    expect(isEntitlementActive({ skuId: 's', endsTimestamp: NOW + 1, deleted: true }, NOW)).toBe(
      false,
    );
  });

  it('entitlementsEnabled: false with no SKUs, true with at least one', () => {
    expect(entitlementsEnabled({})).toBe(false);
    expect(entitlementsEnabled({ guildSkuId: 'x' })).toBe(true);
    expect(entitlementsEnabled({ userSkuId: 'y' })).toBe(true);
  });
});

describe('collectPaged — /entitlements does NOT auto-paginate (cap 100/page)', () => {
  it('joins ALL pages (150 entitlements in pages of 100 + 50)', async () => {
    const all = Array.from({ length: 150 }, (_, k) => ({ id: `e${String(k).padStart(3, '0')}` }));
    const pages: (string | undefined)[] = [];
    const got = await collectPaged(async (after) => {
      pages.push(after);
      const start = after ? all.findIndex((x) => x.id === after) + 1 : 0;
      return all.slice(start, start + 100);
    }, 100);
    expect(got.length).toBe(150); // without pagination it would stop at 100 -> revoke 50 paying users
    expect(pages).toEqual([undefined, 'e099']); // 2 calls: 1st and cursor after the 100th
  });

  it('a single incomplete page -> one call, stops', async () => {
    const got = await collectPaged(async () => [{ id: 'a' }, { id: 'b' }], 100);
    expect(got.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('empty page -> empty list', async () => {
    expect(await collectPaged(async () => [], 100)).toEqual([]);
  });

  it('maxPages caps an endpoint that never shrinks (anti-loop guard)', async () => {
    let calls = 0;
    const got = await collectPaged(
      async () => {
        calls++;
        return [{ id: `x${calls}` }, { id: `y${calls}` }]; // always "full" (pageSize=2)
      },
      2,
      3, // maxPages
    );
    expect(calls).toBe(3);
    expect(got.length).toBe(6);
  });
});

describe('syncDiscordEntitlements — reconciliation with premium_*', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('grants premium to active guild and user', () => {
    const res = syncDiscordEntitlements(db, [
      { kind: 'guild', id: 'g1', expiresAt: NOW + 100_000 },
      { kind: 'user', id: 'u1', expiresAt: NOW + 100_000 },
    ]);
    expect(res).toEqual({ guildsActive: 1, usersActive: 1, revoked: 0 });
    expect(isGuildPremium(db, 'g1', NOW)).toBe(true);
    expect(isUserPremium(db, 'u1', NOW)).toBe(true);
  });

  it('revokes an entitlement that is no longer active (refund/cancellation)', () => {
    syncDiscordEntitlements(db, [{ kind: 'guild', id: 'g1', expiresAt: NOW + 100_000 }]);
    expect(isGuildPremium(db, 'g1', NOW)).toBe(true);
    // Next sync without g1 -> revoke.
    const res = syncDiscordEntitlements(db, []);
    expect(res.revoked).toBe(1);
    expect(isGuildPremium(db, 'g1', NOW)).toBe(false);
  });

  it('does NOT revoke premium from another source (redeem) — only source=discord rows', () => {
    // Redeem gives the guild long premium.
    grantGuildPremium(db, 'g-redeem', 365, 'redeem', NOW);
    // A discord sync WITHOUT g-redeem must not touch it.
    syncDiscordEntitlements(db, []);
    expect(isGuildPremium(db, 'g-redeem', NOW)).toBe(true);
  });

  it('never SHORTENS: a longer redeem survives a shorter discord entitlement', () => {
    grantGuildPremium(db, 'g1', 365, 'redeem', NOW); // ~1 year
    syncDiscordEntitlements(db, [{ kind: 'guild', id: 'g1', expiresAt: NOW + 1000 }]); // short
    // Expiry stays at the MAXIMUM (the redeem one) and the row remains premium.
    expect(isGuildPremium(db, 'g1', NOW + 2000)).toBe(true); // still premium well after discord
  });

  it('keeps a direct entitlement when the overlapping Discord entitlement is cancelled', () => {
    const directExpiry = grantGuildPremium(db, 'g-direct', 1, 'redeem', NOW);
    const discordExpiry = directExpiry + 100_000;
    syncDiscordEntitlements(db, [{ kind: 'guild', id: 'g-direct', expiresAt: discordExpiry }]);
    expect(effectiveGuildPremiumExpiry(db, 'g-direct', NOW)).toBe(discordExpiry);
    syncDiscordEntitlements(db, []);
    expect(effectiveGuildPremiumExpiry(db, 'g-direct', NOW)).toBe(directExpiry);
    expect(isGuildPremium(db, 'g-direct', directExpiry - 1)).toBe(true);
  });

  it('continues access when direct user access expires while Discord remains active', () => {
    const directExpiry = grantUserPremium(db, 'u-direct', 1, 'manual', NOW);
    const discordExpiry = directExpiry + 100_000;
    syncDiscordEntitlements(db, [{ kind: 'user', id: 'u-direct', expiresAt: discordExpiry }]);
    expect(isUserPremium(db, 'u-direct', directExpiry + 1)).toBe(true);
    expect(getUserPremiumExpiry(db, 'u-direct')).toBe(discordExpiry);
  });

  it('collapses duplicate Discord grants to the longest expiry and removes only Discord rows', () => {
    grantGuildPremium(db, 'paid', 1, 'kofi', NOW);
    syncDiscordEntitlements(db, [
      { kind: 'guild', id: 'g1', expiresAt: NOW + 10 },
      { kind: 'guild', id: 'g1', expiresAt: NOW + 100 },
      { kind: 'user', id: 'u1', expiresAt: NOW + 50 },
    ]);
    expect(effectiveGuildPremiumExpiry(db, 'g1', NOW)).toBe(NOW + 100);
    const res = syncDiscordEntitlements(db, [{ kind: 'user', id: 'u1', expiresAt: NOW + 50 }]);
    expect(res).toEqual({ guildsActive: 0, usersActive: 1, revoked: 1 });
    expect(isGuildPremium(db, 'g1', NOW)).toBe(false);
    expect(isGuildPremium(db, 'paid', NOW)).toBe(true);
  });
});
