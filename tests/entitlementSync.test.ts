import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { Events } from 'discord.js';
import { startEntitlementSync } from '../src/premium/entitlementSync';
import { initDb } from '../src/store/db';
import { isGuildPremium, isUserPremium } from '../src/store/premium';

const NOW = 1_000_000;
const SKU = { guildSkuId: 'sku-guild', userSkuId: 'sku-user' };

function fakeClient(fetch: ReturnType<typeof vi.fn>) {
  const handlers = new Map<string, () => void>();
  return {
    application: { entitlements: { fetch } },
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
      return undefined;
    }),
    handlers,
  };
}

describe('startEntitlementSync', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('is inert when no Discord SKU is configured', () => {
    const fetch = vi.fn();
    const client = fakeClient(fetch);
    const logInfo = vi.fn();
    startEntitlementSync({
      client: client as never,
      db,
      sku: {},
      now: () => NOW,
      logInfo,
      logError: vi.fn(),
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(client.on).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('inactive'));
  });

  it('fetches and applies active guild and user purchases', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Map([
        [
          'ent-guild',
          {
            id: 'ent-guild',
            skuId: 'sku-guild',
            guildId: 'guild-1',
            userId: null,
            endsTimestamp: NOW + 10_000,
            deleted: false,
          },
        ],
        [
          'ent-user',
          {
            id: 'ent-user',
            skuId: 'sku-user',
            guildId: null,
            userId: 'user-1',
            endsTimestamp: NOW + 10_000,
            deleted: false,
          },
        ],
      ]),
    );
    const client = fakeClient(fetch);
    startEntitlementSync({
      client: client as never,
      db,
      sku: SKU,
      now: () => NOW,
      logInfo: vi.fn(),
      logError: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(isGuildPremium(db, 'guild-1', NOW)).toBe(true);
      expect(isUserPremium(db, 'user-1', NOW)).toBe(true);
    });
    expect(client.handlers.has(Events.EntitlementCreate)).toBe(true);
    expect(client.handlers.has(Events.EntitlementUpdate)).toBe(true);
    expect(client.handlers.has(Events.EntitlementDelete)).toBe(true);
  });

  it('serializes overlapping event refreshes so an older response cannot win', async () => {
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let concurrent = 0;
    let maxConcurrent = 0;
    const fetch = vi.fn(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      if (fetch.mock.calls.length === 1) await firstBlocked;
      concurrent--;
      return new Map();
    });
    const client = fakeClient(fetch);
    startEntitlementSync({
      client: client as never,
      db,
      sku: SKU,
      now: () => NOW,
      logInfo: vi.fn(),
      logError: vi.fn(),
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    client.handlers.get(Events.EntitlementCreate)?.();
    client.handlers.get(Events.EntitlementUpdate)?.();
    await Promise.resolve();
    expect(maxConcurrent).toBe(1);

    releaseFirst();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(maxConcurrent).toBe(1);
  });

  it('reports Discord API failures without leaking a rejected promise', async () => {
    const error = new Error('Discord unavailable');
    const client = fakeClient(vi.fn().mockRejectedValue(error));
    const logError = vi.fn();
    startEntitlementSync({
      client: client as never,
      db,
      sku: SKU,
      now: () => NOW,
      logInfo: vi.fn(),
      logError,
    });
    await vi.waitFor(() => expect(logError).toHaveBeenCalledWith(expect.any(String), error));
  });
});
