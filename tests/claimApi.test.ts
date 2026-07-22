// tests/claimApi.test.ts — HTTP POST /api/link endpoint (claim authenticated via Discord OAuth).
//
// The buyer, logged into the site with Discord (OAuth), pastes the receipt's transaction code. The
// endpoint validates the identity (statusApi.resolveIdentity), claims the pending grant and activates.
// Its own rate-limit (anti-brute-force on the code), single use, restricted CORS. A `code` with
// '@' (email) is rejected with 400 `use_receipt_code` — plan 021, the email is not accepted as
// proof of possession. See src/premium/kofiWebhook.ts.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'node:http';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { startKofiWebhook } from '../src/premium/kofiWebhook';
import { recordPendingGrant, findUnclaimedPendingByTx } from '../src/store/kofiPending';
import { hashKofiEmail } from '../src/premium/kofi';
import { isUserPremium } from '../src/store/premium';

const DID = '999888777666555444';

/** Fake statusApi: maps token->identity (null = invalid). */
function makeStatusApi(identityByToken: Record<string, { id: string } | null>) {
  return {
    getStatus: vi.fn(async () => ({ code: 200, body: {} })),
    resolveIdentity: vi.fn(async (token: string) => {
      const i = identityByToken[token];
      return i ? { id: i.id, username: 'u', avatar: null } : null;
    }),
  };
}

describe('POST /api/link — authenticated claim', () => {
  let db: Database.Database;
  let server: Server | null = null;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(async () => {
    if (server) {
      await new Promise<void>((r) => server!.close(() => r()));
      server = null;
    }
    db.close();
  });

  async function start(statusApi: unknown): Promise<string> {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
      statusApi: statusApi as never,
      apiOrigin: 'https://vozen.org',
    });
    if (!server) throw new Error('sem servidor');
    await new Promise<void>((r) => server!.once('listening', () => r()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('sem porta');
    return `http://127.0.0.1:${addr.port}/api/link`;
  }
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('no token -> 401', async () => {
    const url = await start(makeStatusApi({}));
    expect((await post(url, { code: 'x' })).status).toBe(401);
  });

  it('invalid token -> 401', async () => {
    const url = await start(makeStatusApi({ bom: { id: DID } }));
    const res = await post(url, { code: 'x' }, { authorization: 'Bearer mau' });
    expect(res.status).toBe(401);
  });

  it('no code in the body -> 400', async () => {
    const url = await start(makeStatusApi({ bom: { id: DID } }));
    const res = await post(url, {}, { authorization: 'Bearer bom' });
    expect(res.status).toBe(400);
  });

  it('valid code -> 200, activates Plus and marks as claimed', async () => {
    recordPendingGrant(
      db,
      { transactionId: 'tx-ok', emailHash: 'h', plan: 'plus', days: 30, seats: 3 },
      1,
    );
    const url = await start(makeStatusApi({ bom: { id: DID } }));
    const res = await post(url, { code: 'tx-ok' }, { authorization: 'Bearer bom' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; items: { plan: string }[] };
    expect(body.ok).toBe(true);
    expect(body.items[0].plan).toBe('plus');
    expect(isUserPremium(db, DID, 2_000_000)).toBe(true);
    expect(findUnclaimedPendingByTx(db, 'tx-ok')).toBeNull();
  });

  it('Ko-fi email -> 400 use_receipt_code (plan 021: email no longer activates anything)', async () => {
    const emailHash = hashKofiEmail('tok', 'buyer@example.com'); // 'tok' = webhook token in start()
    recordPendingGrant(
      db,
      { transactionId: 'tx-em', emailHash, plan: 'plus', days: 30, seats: 3 },
      1,
    );
    const url = await start(makeStatusApi({ bom: { id: DID } }));
    const res = await post(url, { code: 'buyer@example.com' }, { authorization: 'Bearer bom' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('use_receipt_code');
    expect(isUserPremium(db, DID, 2_000_000)).toBe(false);
    expect(findUnclaimedPendingByTx(db, 'tx-em')).not.toBeNull(); // still unclaimed
  });

  it('unknown code -> 404 (generic, no oracle)', async () => {
    const url = await start(makeStatusApi({ bom: { id: DID } }));
    const res = await post(url, { code: 'nada' }, { authorization: 'Bearer bom' });
    expect(res.status).toBe(404);
  });

  it('OPTIONS preflight -> 204 with CORS + POST allowed', async () => {
    const url = await start(makeStatusApi({}));
    const res = await fetch(url, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/POST/);
  });

  it('GET (wrong method) -> 405', async () => {
    const url = await start(makeStatusApi({}));
    expect((await fetch(url, { method: 'GET' })).status).toBe(405);
  });

  it('anti-brute-force rate-limit: 6th attempt from the same IP -> 429', async () => {
    const url = await start(makeStatusApi({ bom: { id: DID } }));
    for (let i = 0; i < 5; i++) {
      const r = await post(
        url,
        { code: 'nada' },
        { authorization: 'Bearer bom', 'x-forwarded-for': '5.5.5.5' },
      );
      expect(r.status).toBe(404); // not found, but counts toward the limit
    }
    const blocked = await post(
      url,
      { code: 'nada' },
      { authorization: 'Bearer bom', 'x-forwarded-for': '5.5.5.5' },
    );
    expect(blocked.status).toBe(429);
  });
});
