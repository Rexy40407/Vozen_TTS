import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'node:http';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  getPremiumPass,
  isUserPremium,
  recordKofiTransaction,
  rememberKofiSupporter,
} from '../src/store/premium';
import {
  parseKofiPayload,
  verifyKofiToken,
  extractDiscordId,
  mapKofiToGrant,
  parseShopMap,
  hashKofiEmail,
  PREMIUM_PASS_SEATS,
  PREMIUM_MAX_SEATS,
} from '../src/premium/kofi';
import { applyKofiGrant, resolveKofiDiscordId } from '../src/premium/kofiWebhook';
import { startKofiWebhook } from '../src/premium/kofiWebhook';
import { findUnclaimedPendingByTx } from '../src/store/kofiPending';

const DID = '123456789012345678'; // 18 digits
const EMAIL = 'buyer@example.com';
const TOKEN = 'kofi-webhook-secret-xyz'; // HMAC key of the email in tests

function kofiJson(over: Record<string, unknown>): string {
  return JSON.stringify({
    verification_token: 'tok',
    type: 'Subscription',
    message: `Discord: ${DID}`,
    is_subscription_payment: true,
    tier_name: 'Vozen Premium — Monthly',
    email: EMAIL,
    ...over,
  });
}

describe('kofi — payload parsing', () => {
  it('form-encoded (data=<json>) is read', () => {
    const raw = 'data=' + encodeURIComponent(kofiJson({}));
    const e = parseKofiPayload(raw);
    expect(e?.verificationToken).toBe('tok');
    expect(e?.tierName).toBe('Vozen Premium — Monthly');
    expect(e?.message).toContain(DID);
  });
  it('plain JSON too (useful in tests)', () => {
    expect(parseKofiPayload(kofiJson({}))?.type).toBe('Subscription');
  });
  it('garbage -> null', () => {
    expect(parseKofiPayload('nonsense{')).toBeNull();
  });
  it('shop_items -> concatenated shopItemsText', () => {
    const raw = kofiJson({
      type: 'Shop Order',
      tier_name: null,
      shop_items: [{ variation_name: 'Vozen Premium Annual', direct_link_code: 'abc' }],
    });
    expect(parseKofiPayload(raw)?.shopItemsText).toMatch(/Premium Annual/);
  });

  // Plan 035 needs to tell a subscription's FIRST payment from its renewals: the first one
  // must pend and be claimed (the buyer picks the account and consents), renewals must keep
  // applying themselves or a paying subscriber loses the service by forgetting to claim.
  it('is_first_subscription_payment: true -> isFirstSubscriptionPayment true', () => {
    const raw = kofiJson({ is_subscription_payment: true, is_first_subscription_payment: true });
    expect(parseKofiPayload(raw)?.isFirstSubscriptionPayment).toBe(true);
  });

  it('is_first_subscription_payment: false (a renewal) -> false', () => {
    const raw = kofiJson({ is_subscription_payment: true, is_first_subscription_payment: false });
    expect(parseKofiPayload(raw)?.isFirstSubscriptionPayment).toBe(false);
  });

  // Absent must NOT read as "first". The routing treats "renewal" as the only auto-apply path
  // and demands both signals, so an absent field degrades to pending — never to activating
  // without consent.
  it('field absent -> false (never guesses "first")', () => {
    expect(parseKofiPayload(kofiJson({}))?.isFirstSubscriptionPayment).toBe(false);
  });
});

describe('kofi — token and Discord ID', () => {
  it('verifyKofiToken: equal passes, different/empty fails', () => {
    const e = parseKofiPayload(kofiJson({}))!;
    expect(verifyKofiToken(e, 'tok')).toBe(true);
    expect(verifyKofiToken(e, 'outro')).toBe(false);
    expect(verifyKofiToken(e, undefined)).toBe(false);
    expect(verifyKofiToken(e, '')).toBe(false);
  });
  it('extractDiscordId: catches 17–20 digits, otherwise null', () => {
    expect(extractDiscordId(`o meu id é ${DID} obrigado`)).toBe(DID);
    expect(extractDiscordId('sem id')).toBeNull();
    expect(extractDiscordId(null)).toBeNull();
    expect(extractDiscordId('123')).toBeNull();
  });
});

// Ko-fi Shop Orders do NOT carry the product name: the payload only has
// `direct_link_code` and `variation_name`, and variations exist ONLY for PHYSICAL
// products — a digital item (our annual passes) sends an EMPTY variation_name. So the
// keyword matching used for membership tiers can never recognize a shop purchase; an
// explicit code->product map is the only reliable route.
describe('kofi — shop map (annual passes bought as Shop items)', () => {
  const now = 1_000_000;
  /** A REAL digital Shop Order: no variation_name, only the direct_link_code. */
  const shopOrder = (code: string): string =>
    kofiJson({
      type: 'Shop Order',
      tier_name: null,
      is_subscription_payment: false,
      shop_items: [{ direct_link_code: code, variation_name: '' }],
    });

  it('parses the payload codes so an exact match is possible', () => {
    expect(parseKofiPayload(shopOrder('abc123'))?.shopItemCodes).toEqual(['abc123']);
  });

  it('WITHOUT a map, a digital annual Shop Order is silently ignored (the real-world gap)', () => {
    expect(mapKofiToGrant(parseKofiPayload(shopOrder('abc123'))!, now)).toBeNull();
  });

  it('WITH the map, the SAME order grants 365 days of Plus (and keeps the Discord ID)', () => {
    const map = parseShopMap('abc123:plus:365');
    const g = mapKofiToGrant(parseKofiPayload(shopOrder('abc123'))!, now, map)!;
    expect(g.plan).toBe('plus');
    expect(g.days).toBe(365);
    expect(g.discordId).toBe(DID);
  });

  it('a premium code carries its licence count', () => {
    const map = parseShopMap('def456:premium:365:8');
    const g = mapKofiToGrant(parseKofiPayload(shopOrder('def456'))!, now, map)!;
    expect(g.plan).toBe('premium');
    expect(g.seats).toBe(8);
    expect(g.days).toBe(365);
  });

  it('an UNKNOWN code stays null — never a wrong grant from a guess', () => {
    const map = parseShopMap('abc123:plus:365');
    expect(mapKofiToGrant(parseKofiPayload(shopOrder('nope999'))!, now, map)).toBeNull();
  });

  it('the map does NOT break membership tiers (regression)', () => {
    const map = parseShopMap('abc123:plus:365');
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({}))!, now, map)!;
    expect(g.plan).toBe('premium'); // still read from tier_name
    expect(g.days).toBe(30);
  });

  describe('parseShopMap', () => {
    it('reads several entries, tolerates spaces, defaults the seats', () => {
      const m = parseShopMap(' abc:plus:365 , def:premium:365 ');
      expect(m.get('abc')).toEqual({ plan: 'plus', days: 365, seats: PREMIUM_PASS_SEATS });
      expect(m.get('def')?.seats).toBe(PREMIUM_PASS_SEATS);
    });
    it('empty/undefined -> empty map (feature simply off)', () => {
      expect(parseShopMap(undefined).size).toBe(0);
      expect(parseShopMap('').size).toBe(0);
    });
    it('skips malformed entries instead of crashing the webhook', () => {
      const m = parseShopMap('good:plus:365, garbage, bad:wrongplan:30, nodays:plus');
      expect(m.size).toBe(1);
      expect(m.has('good')).toBe(true);
    });
    it('rejects absurd days/seats (cheap defense against a typo in the env)', () => {
      expect(parseShopMap('x:plus:0').size).toBe(0);
      expect(parseShopMap('x:plus:99999').size).toBe(0);
      expect(parseShopMap('x:premium:365:0').size).toBe(0);
      expect(parseShopMap('x:premium:365:9999').size).toBe(0);
    });
  });
});

describe('kofi — product -> grant mapping', () => {
  const now = 1_000_000;
  it('monthly Premium -> premium, 30 days, 2 licenses', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({}))!, now)!;
    expect(g.plan).toBe('premium');
    expect(g.days).toBe(30);
    expect(g.seats).toBe(PREMIUM_PASS_SEATS);
    expect(g.discordId).toBe(DID);
  });
  it('annual Premium -> 365 days', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium — Annual' }))!,
      now,
    )!;
    expect(g.days).toBe(365);
  });
  it('Plus -> plus plan', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({ tier_name: 'Vozen Plus' }))!, now)!;
    expect(g.plan).toBe('plus');
  });
  it('monthly Premium Max -> premium, 30 days, 8 licenses (big deal = 8 servers)', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium Max' }))!, now)!;
    expect(g.plan).toBe('premium');
    // Product decision 2026-07-11: the big deal went from 10 to 8 servers.
    expect(PREMIUM_MAX_SEATS).toBe(8);
    expect(g.seats).toBe(PREMIUM_MAX_SEATS);
    expect(g.days).toBe(30);
  });
  it('annual Premium Max -> 8 licenses, 365 days', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium Max — Annual' }))!,
      now,
    )!;
    expect(g.seats).toBe(PREMIUM_MAX_SEATS);
    expect(g.days).toBe(365);
  });
  it('Premium WITHOUT "max" keeps 3 licenses (is not mis-mapped to Max)', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium' }))!, now)!;
    expect(g.seats).toBe(PREMIUM_PASS_SEATS);
  });
  // REAL product names on Ko-fi (2026-07): the number of servers comes from the
  // "(N servers)" name, no longer from the word "max" (which was removed from the products).
  // Since 2026-07-11 the big deal is "(8 servers)"; "(10 servers)" is tested
  // as grandfathering (renewals of old purchases keep the 10 licenses).
  it('real product: "Premium (8 servers) 1 month" -> 8 licenses, 30 days', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium (8 servers) 1 month' }))!,
      now,
    )!;
    expect(g.plan).toBe('premium');
    expect(g.seats).toBe(8);
    expect(g.days).toBe(30);
  });
  it('real product: "Premium (8 servers) 1 year" -> 8 licenses, 365 days', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium (8 servers) 1 year' }))!,
      now,
    )!;
    expect(g.seats).toBe(8);
    expect(g.days).toBe(365);
  });
  it('grandfathering: "Premium (10 servers) 1 month" -> still gives 10 licenses', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium (10 servers) 1 month' }))!,
      now,
    )!;
    expect(g.plan).toBe('premium');
    expect(g.seats).toBe(10);
    expect(g.days).toBe(30);
  });
  it('real product: "Premium (3 servers) 1 year" -> 3 licenses, 365 days', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium (3 servers) 1 year' }))!,
      now,
    )!;
    expect(g.seats).toBe(3);
    expect(g.days).toBe(365);
  });
  it('grandfathering: "Premium (10 servers) 1 year" -> still gives 10 licenses', () => {
    const g = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Premium (10 servers) 1 year' }))!,
      now,
    )!;
    expect(g.seats).toBe(10);
    expect(g.days).toBe(365);
  });
  it('real product: "Plus 1 year" -> plus, 365 days; "Plus 1 month" -> 30 days', () => {
    const yr = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Plus 1 year' }))!,
      now,
    )!;
    expect(yr.plan).toBe('plus');
    expect(yr.days).toBe(365);
    const mo = mapKofiToGrant(
      parseKofiPayload(kofiJson({ tier_name: 'Vozen Plus 1 month' }))!,
      now,
    )!;
    expect(mo.plan).toBe('plus');
    expect(mo.days).toBe(30);
  });
  it('annual via shop_items (variation_name)', () => {
    const raw = kofiJson({
      type: 'Shop Order',
      tier_name: null,
      shop_items: [{ variation_name: 'Vozen Plus Annual' }],
    });
    const g = mapKofiToGrant(parseKofiPayload(raw)!, now)!;
    expect(g.plan).toBe('plus');
    expect(g.days).toBe(365);
  });
  it('one-off donation (no premium/plus) -> null (ignored)', () => {
    const raw = kofiJson({ type: 'Donation', tier_name: null, message: 'obrigado!' });
    expect(mapKofiToGrant(parseKofiPayload(raw)!, now)).toBeNull();
  });
});

describe('kofi — applying the grant in the store', () => {
  let db: Database.Database;
  const now = 1_000_000;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('premium -> 2-license pass on the buyer', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({}))!, now)!;
    const exp = applyKofiGrant(db, g, now);
    expect(exp).toBe(now + 30 * 86_400_000);
    const pass = getPremiumPass(db, DID)!;
    expect(pass.seats).toBe(3);
    expect(pass.source).toBe('kofi');
  });
  it('plus -> Vozen Plus on the user', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({ tier_name: 'Vozen Plus' }))!, now)!;
    applyKofiGrant(db, g, now);
    expect(isUserPremium(db, DID, now + 1000)).toBe(true);
  });
  it('no Discord ID -> does not apply, returns null (manual grant)', () => {
    const g = mapKofiToGrant(parseKofiPayload(kofiJson({ message: 'sem id aqui' }))!, now)!;
    expect(g.discordId).toBeNull();
    expect(applyKofiGrant(db, g, now)).toBeNull();
    expect(getPremiumPass(db, DID)).toBeNull();
  });
});

describe('kofi — hashKofiEmail (PII minimization)', () => {
  it('deterministic and case/space-insensitive (same person -> same hash)', () => {
    expect(hashKofiEmail(TOKEN, EMAIL)).toBe(hashKofiEmail(TOKEN, EMAIL));
    expect(hashKofiEmail(TOKEN, '  Buyer@Example.COM ')).toBe(hashKofiEmail(TOKEN, EMAIL));
  });
  it('is 64-char hex and NEVER reveals the email', () => {
    const h = hashKofiEmail(TOKEN, EMAIL);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain('buyer');
    expect(h).not.toContain('example');
  });
  it('depends on the token (webhook secret = HMAC key)', () => {
    expect(hashKofiEmail('token-A', EMAIL)).not.toBe(hashKofiEmail('token-B', EMAIL));
  });
});

describe('kofi — renewals (email -> Discord ID)', () => {
  let db: Database.Database;
  const now = 1_000_000;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('parse carries the buyer email', () => {
    expect(parseKofiPayload(kofiJson({}))?.email).toBe(EMAIL);
  });

  it('1st purchase: the Discord ID from the message is remembered by email', () => {
    const e = parseKofiPayload(kofiJson({}))!;
    const g = mapKofiToGrant(e, now)!;
    expect(resolveKofiDiscordId(db, e, g, now, TOKEN)).toBe(DID);
  });

  it('renewal WITHOUT message: re-finds the Discord ID by email', () => {
    // 1st purchase remembers
    const e1 = parseKofiPayload(kofiJson({}))!;
    resolveKofiDiscordId(db, e1, mapKofiToGrant(e1, now)!, now, TOKEN);
    // renewal: no Discord ID in the message, same email
    const e2 = parseKofiPayload(kofiJson({ message: 'Renewal' }))!;
    const g2 = mapKofiToGrant(e2, now)!;
    expect(g2.discordId).toBeNull(); // the message no longer carries it
    const resolvedId = resolveKofiDiscordId(db, e2, g2, now, TOKEN);
    expect(resolvedId).toBe(DID); // ...but the email re-finds it
    // and the grant applies and extends the pass
    const exp = applyKofiGrant(db, { ...g2, discordId: resolvedId }, now + 30 * 86_400_000);
    expect(exp).not.toBeNull();
    expect(getPremiumPass(db, DID)).not.toBeNull();
  });

  it('renewal from an unknown email -> null (falls into manual grant)', () => {
    const e = parseKofiPayload(kofiJson({ message: 'no id', email: 'stranger@x.com' }))!;
    const g = mapKofiToGrant(e, now)!;
    expect(resolveKofiDiscordId(db, e, g, now, TOKEN)).toBeNull();
  });

  it('SEC: the DB does NOT store the email in clear — only the HMAC hash (PII minimization)', () => {
    const e = parseKofiPayload(kofiJson({}))!;
    resolveKofiDiscordId(db, e, mapKofiToGrant(e, now)!, now, TOKEN);
    // Scans ALL columns of all rows: the email in clear must not appear.
    const rows = db.prepare('SELECT * FROM kofi_supporter').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain(EMAIL); // neither the email...
    expect(dump).not.toContain('example.com'); // ...nor the domain
    expect(dump).toContain(hashKofiEmail(TOKEN, EMAIL)); // stores the hash
  });
});

describe('kofiWebhook — API Premium HTTP', () => {
  let db: Database.Database;
  let server: Server | null = null;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    db.close();
  });

  // HTTP glue of the panel endpoint: preflight, method, 200 wiring + CORS header.
  async function startApi(
    getStatus: () => Promise<{ code: number; body: unknown }>,
  ): Promise<string> {
    const statusApi = {
      getStatus: vi.fn(getStatus),
      resolveIdentity: vi.fn(),
      resolveAuthorization: vi.fn(),
      resolveActivationIdentity: vi.fn(),
    };
    server = startKofiWebhook({
      db,
      token: undefined,
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
      statusApi,
      apiOrigin: 'https://vozen.org',
    });
    if (!server) throw new Error('servidor não arrancou');
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('porta efémera indisponível');
    return `http://127.0.0.1:${addr.port}/api/me/premium`;
  }

  it('OPTIONS -> 204 with CORS + Allow-Methods (browser preflight)', async () => {
    const url = await startApi(async () => ({ code: 200, body: {} }));
    const res = await fetch(url, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/GET/);
  });

  it('non-GET/OPTIONS method (e.g. PUT) -> 405 with CORS header', async () => {
    const url = await startApi(async () => ({ code: 200, body: {} }));
    const res = await fetch(url, { method: 'PUT' });
    expect(res.status).toBe(405);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
  });

  it('GET with a valid token -> 200 with the statusApi body + Content-Type + CORS', async () => {
    const url = await startApi(async () => ({ code: 200, body: { premium: true, plan: 'plus' } }));
    const res = await fetch(url, { headers: { Authorization: 'Bearer bom' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.json()).toEqual({ premium: true, plan: 'plus' });
  });

  it('limits the per-IP rate-limit map so it does not grow without bound', async () => {
    const statusApi = {
      getStatus: vi.fn(async () => ({ code: 401, body: { error: 'invalid_token' } })),
      resolveIdentity: vi.fn(),
      resolveAuthorization: vi.fn(),
      resolveActivationIdentity: vi.fn(),
    };
    server = startKofiWebhook({
      db,
      token: undefined,
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
      statusApi,
      apiOrigin: 'https://vozen.org',
      apiRateMaxEntries: 2,
    });
    expect(server).not.toBeNull();
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    const addr = server!.address();
    if (!addr || typeof addr === 'string') throw new Error('porta efémera indisponível');
    const url = `http://127.0.0.1:${addr.port}/api/me/premium`;
    const req = (ip: string) =>
      fetch(url, {
        headers: { Authorization: 'Bearer mau', 'X-Forwarded-For': ip },
      });

    for (let i = 0; i < 30; i++) {
      expect((await req('10.0.0.1')).status).toBe(401);
    }
    expect((await req('10.0.0.1')).status).toBe(429);

    expect((await req('10.0.0.2')).status).toBe(401);
    expect((await req('10.0.0.3')).status).toBe(401);
    expect((await req('10.0.0.1')).status).toBe(401);
  });

  it('XFF forged on the left does NOT rotate buckets (identity = last element)', async () => {
    const statusApi = {
      getStatus: vi.fn(async () => ({ code: 401, body: { error: 'invalid_token' } })),
      resolveIdentity: vi.fn(),
      resolveAuthorization: vi.fn(),
      resolveActivationIdentity: vi.fn(),
    };
    server = startKofiWebhook({
      db,
      token: undefined,
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
      statusApi,
      apiOrigin: 'https://vozen.org',
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    const addr = server!.address();
    if (!addr || typeof addr === 'string') throw new Error('porta efémera indisponível');
    const url = `http://127.0.0.1:${addr.port}/api/me/premium`;

    // 30 requests with a DIFFERENT forged prefix but the same real IP at the end -> same window.
    for (let i = 0; i < 30; i++) {
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer mau', 'X-Forwarded-For': `1.2.3.${i}, 10.9.9.9` },
      });
      expect(res.status).toBe(401);
    }
    const blocked = await fetch(url, {
      headers: { Authorization: 'Bearer mau', 'X-Forwarded-For': '9.9.9.9, 10.9.9.9' },
    });
    expect(blocked.status).toBe(429);
  });
});

describe('kofi — webhook idempotency (Ko-fi retries do not duplicate the grant)', () => {
  let db: Database.Database;
  let server: Server | null = null;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    db.close();
  });

  it('recordKofiTransaction: 1st time true, duplicate false', () => {
    expect(recordKofiTransaction(db, 'tx-a', 1000)).toBe(true);
    expect(recordKofiTransaction(db, 'tx-a', 2000)).toBe(false);
    expect(recordKofiTransaction(db, 'tx-b', 3000)).toBe(true);
  });

  async function startAndPost(payload: string): Promise<number> {
    const res = await fetch(urlOf(server!), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    return res.status;
  }
  function urlOf(s: Server): string {
    const addr = s.address();
    if (!addr || typeof addr === 'string') throw new Error('porta efémera indisponível');
    return `http://127.0.0.1:${addr.port}/`;
  }

  it('same delivery 2x (same kofi_transaction_id) -> the expiry only extends ONCE', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    expect(server).not.toBeNull();
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Plan 035: renewal is the only path that still applies without a claim, so bind the
    // email and send renewals. What is under test (idempotency, tx ids) is unchanged.
    rememberKofiSupporter(db, hashKofiEmail('tok', EMAIL), DID, 1_000);
    const payload = kofiJson({
      message: null,
      is_subscription_payment: true,
      is_first_subscription_payment: false,
      kofi_transaction_id: 'tx-dup-1',
    });
    expect(await startAndPost(payload)).toBe(200);
    const passAfter1 = getPremiumPass(db, DID);
    expect(passAfter1).not.toBeNull();

    // Ko-fi retry: SAME tx id -> 200 (ack) but WITHOUT re-applying the grant.
    expect(await startAndPost(payload)).toBe(200);
    const passAfter2 = getPremiumPass(db, DID);
    expect(passAfter2?.expiresAt).toBe(passAfter1?.expiresAt);
  });

  it('legitimate renewal (DIFFERENT tx id) -> extends again', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Plan 035: renewal is the only path that still applies without a claim, so bind the
    // email and send renewals. What is under test (idempotency, tx ids) is unchanged.
    rememberKofiSupporter(db, hashKofiEmail('tok', EMAIL), DID, 1_000);
    const renew = (tx: string): string =>
      kofiJson({
        message: null,
        is_subscription_payment: true,
        is_first_subscription_payment: false,
        kofi_transaction_id: tx,
      });
    expect(await startAndPost(renew('tx-r1'))).toBe(200);
    const after1 = getPremiumPass(db, DID)!.expiresAt;
    expect(await startAndPost(renew('tx-r2'))).toBe(200);
    const after2 = getPremiumPass(db, DID)!.expiresAt;
    expect(after2).toBeGreaterThan(after1);
  });

  it('payload WITHOUT tx id (atypical) -> processes anyway (does not get blocked)', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Plan 035: renewal is the only path that still applies without a claim, so bind the
    // email and send renewals. What is under test (idempotency, tx ids) is unchanged.
    rememberKofiSupporter(db, hashKofiEmail('tok', EMAIL), DID, 1_000);
    expect(
      await startAndPost(
        kofiJson({
          message: null,
          is_subscription_payment: true,
          is_first_subscription_payment: false,
          kofi_transaction_id: null,
        }),
      ),
    ).toBe(200);
    expect(getPremiumPass(db, DID)).not.toBeNull();
  });

  // Production incident 2026-07-12 00:41: an annual Shop Order arrived, was not in
  // KOFI_SHOP_MAP (unset), and was dropped with only an INFO line. Nobody noticed for four
  // days. Ko-fi does not send the product name, so the direct_link_code is the ONLY thing
  // identifying what was paid for — it has to reach the operator, at error level.
  it('Shop Order absent from the map -> logs at ERROR with the direct_link_code', async () => {
    const errors: string[] = [];
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: (m) => errors.push(m),
      // shopMap deliberately empty: reproduces the .env with no KOFI_SHOP_MAP.
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    const status = await startAndPost(
      JSON.stringify({
        verification_token: 'tok',
        type: 'Shop Order',
        message: null,
        is_subscription_payment: false,
        tier_name: null,
        // A real digital Shop Order: variation_name is empty, only the code identifies it.
        shop_items: [{ direct_link_code: 'a1b2c3' }],
        email: EMAIL,
        kofi_transaction_id: 'tx-unmapped-1',
      }),
    );

    // Still 200: Ko-fi must not retry — we cannot map it, and a retry would not help.
    expect(status).toBe(200);
    // But the operator has to be able to SEE it, and the message must carry the fix.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('a1b2c3');
    expect(errors[0]).toContain('tx-unmapped-1');
    expect(errors[0]).toContain('KOFI_SHOP_MAP');
  });

  // A plain donation is NOT a dropped purchase — it is legitimately not a product. It must
  // stay at info level, or the error channel fills with noise and real drops get buried.
  it('donation without a product -> stays quiet (info, not error)', async () => {
    const errors: string[] = [];
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: (m) => errors.push(m),
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    const status = await startAndPost(
      JSON.stringify({
        verification_token: 'tok',
        type: 'Donation',
        message: 'keep it up!',
        is_subscription_payment: false,
        tier_name: null,
        email: EMAIL,
        kofi_transaction_id: 'tx-donation-1',
      }),
    );
    expect(status).toBe(200);
    expect(errors).toHaveLength(0);
  });

  // ── Plan 035: new purchases pend, renewals stay automatic ──────────────────────────────────
  // On 2026-07-17 02:03 a monthly membership was bought with an email already bound to a
  // Discord account, and the webhook granted it on the spot: no claim, no choice of account,
  // and — the part that matters — no 14-day consent, which is only collected at the claim step.
  // These lock in the inversion.
  const BOUND_EMAIL_HASH = () => hashKofiEmail('tok', EMAIL);

  it('first membership payment with the email ALREADY bound -> PENDS (does not auto-apply)', async () => {
    rememberKofiSupporter(db, BOUND_EMAIL_HASH(), DID, 1_000);
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    const status = await startAndPost(
      kofiJson({
        message: null, // the subscription checkout has no message box
        is_subscription_payment: true,
        is_first_subscription_payment: true,
        kofi_transaction_id: 'tx-first-1',
      }),
    );
    expect(status).toBe(200);
    // Nothing applied; it waits to be claimed, flagged as a subscription.
    expect(getPremiumPass(db, DID)).toBeNull();
    const pending = findUnclaimedPendingByTx(db, 'tx-first-1');
    expect(pending).not.toBeNull();
    expect(pending?.isSubscription).toBe(true);
  });

  it('renewal with the email bound -> applies itself (subscriber never loses the service)', async () => {
    rememberKofiSupporter(db, BOUND_EMAIL_HASH(), DID, 1_000);
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    const status = await startAndPost(
      kofiJson({
        message: null,
        is_subscription_payment: true,
        is_first_subscription_payment: false, // a renewal
        kofi_transaction_id: 'tx-renew-1',
      }),
    );
    expect(status).toBe(200);
    expect(getPremiumPass(db, DID)).not.toBeNull(); // granted, no claim needed
    expect(findUnclaimedPendingByTx(db, 'tx-renew-1')).toBeNull();
  });

  it('a Discord ID in the message no longer grants directly -> still PENDS', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // The message carries a valid Discord ID (kofiJson's default) — that path used to grant on
    // the spot, skipping consent. It must pend like everything else new.
    const status = await startAndPost(kofiJson({ kofi_transaction_id: 'tx-msg-1' }));
    expect(status).toBe(200);
    expect(getPremiumPass(db, DID)).toBeNull();
    expect(findUnclaimedPendingByTx(db, 'tx-msg-1')).not.toBeNull();
  });

  it('Shop order with the email bound -> PENDS (annual passes are never auto-applied)', async () => {
    rememberKofiSupporter(db, BOUND_EMAIL_HASH(), DID, 1_000);
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
      shopMap: parseShopMap('shopcode1:plus:365'),
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    const status = await startAndPost(
      kofiJson({
        type: 'Shop Order',
        tier_name: null,
        message: null,
        is_subscription_payment: false,
        shop_items: [{ direct_link_code: 'shopcode1' }],
        kofi_transaction_id: 'tx-shop-1',
      }),
    );
    expect(status).toBe(200);
    expect(isUserPremium(db, DID, 1_000_001)).toBe(false);
    const pending = findUnclaimedPendingByTx(db, 'tx-shop-1');
    expect(pending).not.toBeNull();
    // A Shop order is never a subscription: it must not travel with, or rebind, anything.
    expect(pending?.isSubscription).toBe(false);
  });

  it('renewal with the email NOT bound -> pends (nothing to resolve it to)', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    const status = await startAndPost(
      kofiJson({
        message: null,
        is_subscription_payment: true,
        is_first_subscription_payment: false,
        kofi_transaction_id: 'tx-renew-orphan',
      }),
    );
    expect(status).toBe(200);
    expect(findUnclaimedPendingByTx(db, 'tx-renew-orphan')?.isSubscription).toBe(true);
  });

  it('POST error branches: wrong token 401 (no grant), garbage 400, body >64KB 413', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Wrong verification token -> 401 and NOTHING is applied in the store.
    expect(await startAndPost(kofiJson({ verification_token: 'errado' }))).toBe(401);
    expect(getPremiumPass(db, DID)).toBeNull();

    // Unreadable payload -> 400.
    expect(await startAndPost('nonsense{')).toBe(400);

    // Body above the 64KB cap -> aborted early: either 413, or the socket is destroyed
    // mid-upload (the fetch sees ECONNRESET). Both prove the anti-DoS guard.
    const oversized = await startAndPost('x'.repeat(65 * 1024)).then(
      (status) => status,
      () => 'reset' as const,
    );
    expect([413, 'reset']).toContain(oversized);

    // And after the errors, a valid POST still works. Uses a renewal: since plan 035 that is the
    // only path that applies without a claim.
    rememberKofiSupporter(db, hashKofiEmail('tok', EMAIL), DID, 1_000);
    expect(
      await startAndPost(
        kofiJson({
          message: null,
          is_subscription_payment: true,
          is_first_subscription_payment: false,
          kofi_transaction_id: 'tx-ok',
        }),
      ),
    ).toBe(200);
    expect(getPremiumPass(db, DID)).not.toBeNull();
  });

  it('DB failure on the grant -> 503 (Ko-fi retries), not 200 which would lose the purchase', async () => {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Simulates a write failure (SQLITE_BUSY, disk full, I/O) DURING the grant
    // transaction — the payload is valid, only persistence blows up. Ko-fi only retries on
    // non-2xx, so responding 200 here would silently lose the paid purchase.
    (db as { transaction: unknown }).transaction = () => () => {
      throw new Error('SQLITE_BUSY: simulado');
    };

    const status = await startAndPost(kofiJson({ kofi_transaction_id: 'tx-db-fail' }));
    expect(status).toBe(503);
  });

  it('purchase WITHOUT Discord ID -> stores a claimable PENDING (tx id + email hash)', async () => {
    // Regression of the real flow (production logs): the Ko-fi subscription has no message
    // box, so the purchase arrives without a Discord ID. Instead of just logging, we store a
    // pending for the buyer to claim on the site. Indexed by the tx id (receipt) and the email
    // hash (renewals), NEVER the email in clear.
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Message without a Discord ID (but with the buyer email, as the real Ko-fi sends).
    expect(
      await startAndPost(kofiJson({ message: 'obrigado!', kofi_transaction_id: 'tx-pend-1' })),
    ).toBe(200);
    const p = findUnclaimedPendingByTx(db, 'tx-pend-1')!;
    expect(p).not.toBeNull();
    expect(p.plan).toBe('premium'); // kofiJson default tier is "Vozen Premium — Monthly"
    expect(p.seats).toBe(PREMIUM_PASS_SEATS);
    expect(p.days).toBe(30);
    expect(p.emailHash).toBe(hashKofiEmail('tok', EMAIL)); // hash, never the email
    // And it did NOT activate anything directly (there is no Discord ID yet).
    expect(getPremiumPass(db, DID)).toBeNull();
  });

  // Deliberately removed by plan 035: "purchase WITH Discord ID -> activates directly and does
  // NOT create a pending" asserted the very behaviour this plan takes away — a Discord ID in the
  // message granting on the spot, skipping the 14-day consent that only the claim step collects.
  // Its replacement is "a Discord ID in the message no longer grants directly -> still PENDS"
  // above. Kept as a note so the deletion reads as a decision, not an oversight.

  // This is about PII, not about log levels — so it watches BOTH channels. Plan 035 moved the
  // pending line from error to info (pending is now the normal path for a new purchase); the
  // buyer's name must be absent either way, and the tx id present either way.
  it('a pending purchase does NOT log the buyer name (PII), only the tx id', async () => {
    const logs: string[] = [];
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: (msg: string) => {
        logs.push(msg);
      },
      logError: (msg: string) => {
        logs.push(msg);
      },
    });
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));

    // Purchase without a resolvable Discord ID (message without id + unknown email) -> the
    // MANUAL grant path, where the buyer name (PII) used to be logged.
    const status = await startAndPost(
      kofiJson({
        message: 'obrigado!',
        email: 'stranger@example.com',
        from_name: 'João Comprador',
        kofi_transaction_id: 'tx-anon',
      }),
    );
    expect(status).toBe(200);
    const joined = logs.join('\n');
    expect(joined).toContain('tx-anon'); // the purchase can be reconciled on Ko-fi...
    expect(joined).not.toContain('João Comprador'); // ...but the name NEVER enters the log.
  });
});
