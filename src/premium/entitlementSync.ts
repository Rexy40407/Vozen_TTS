// src/premium/entitlementSync.ts
//
// Connects Discord Premium App entitlements to Vozen's internal Premium records. The
// subsystem is inert without configured SKUs. Every refresh fetches the complete active
// set so cancellation and refund reconciliation cannot drift.

import { type Client, Events } from 'discord.js';
import type Database from 'better-sqlite3';
import {
  activeEntitlementGrants,
  collectPaged,
  entitlementsEnabled,
  type EntitlementLike,
  type EntitlementSkuConfig,
} from './entitlements';
import { syncDiscordEntitlements } from '../store/premium';

/** Maximum accepted page size for Discord's entitlements endpoint. */
const ENTITLEMENT_PAGE = 100;

export interface EntitlementSyncDeps {
  client: Client;
  db: Database.Database;
  sku: EntitlementSkuConfig;
  now: () => number;
  logInfo: (msg: string) => void;
  logError: (msg: string, err: unknown) => void;
}

/** Starts entitlement synchronization after the Discord client is ready. */
export function startEntitlementSync(deps: EntitlementSyncDeps): void {
  const { client, db, sku, now, logInfo, logError } = deps;
  if (!entitlementsEnabled(sku)) {
    logInfo('[premium] Discord Premium Apps inactive: no PREMIUM_*_SKU_ID configured.');
    return;
  }

  const refreshOnce = async (): Promise<void> => {
    try {
      const app = client.application;
      if (!app) return;
      // Pagination is mandatory. Reconciliation removes Discord grants missing from the
      // fetched set, so a partial first page could incorrectly revoke paying customers.
      const list = await collectPaged<EntitlementLike & { id: string }>(async (after) => {
        const page = await app.entitlements.fetch({ limit: ENTITLEMENT_PAGE, after });
        return [...page.values()].map((e) => ({
          id: e.id,
          skuId: e.skuId,
          guildId: e.guildId ?? null,
          userId: e.userId ?? null,
          endsTimestamp: e.endsTimestamp ?? null,
          deleted: e.deleted ?? false,
        }));
      }, ENTITLEMENT_PAGE);
      const grants = activeEntitlementGrants(list, sku, now());
      const res = syncDiscordEntitlements(db, grants);
      logInfo(
        `[premium] entitlements synchronized: ${res.guildsActive} guild(s), ${res.usersActive} active user(s), ${res.revoked} revoked.`,
      );
    } catch (err) {
      logError('[premium] entitlement synchronization failed; keeping the previous state', err);
    }
  };

  // Coalesce events while a refresh is running. Without this single-flight guard, a slow
  // older response could finish after a newer one and revoke a just-created entitlement.
  let activeRefresh: Promise<void> | undefined;
  let refreshQueued = false;
  const refresh = (): Promise<void> => {
    if (activeRefresh) {
      refreshQueued = true;
      return activeRefresh;
    }
    activeRefresh = (async () => {
      do {
        refreshQueued = false;
        await refreshOnce();
      } while (refreshQueued);
    })().finally(() => {
      activeRefresh = undefined;
    });
    return activeRefresh;
  };

  // Reconcile immediately and after purchases, renewals, cancellations, and refunds.
  void refresh();
  client.on(Events.EntitlementCreate, () => void refresh());
  client.on(Events.EntitlementUpdate, () => void refresh());
  client.on(Events.EntitlementDelete, () => void refresh());
}
