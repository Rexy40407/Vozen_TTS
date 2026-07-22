import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { startKofiWebhook } from '../src/premium/kofiWebhook';
import { recordPendingGrant, findUnclaimedPendingByTx } from '../src/store/kofiPending';
import { hashKofiEmail } from '../src/premium/kofi';
import { ACTIVATION_TERMS_VERSION } from '../src/premium/claim';
import type { ActivationIdentityResult } from '../src/premium/statusApi';
import { isUserPremium } from '../src/store/premium';

const DID = '999888777666555444';
const CLIENT_ID = '1523826014935842997';
const EMAIL = 'buyer@example.com';
const KOFI_TOKEN = 'kofi-secret';

function makeStatusApi(result: ActivationIdentityResult) {
  return {
    getStatus: vi.fn(async () => ({ code: 200, body: {} })),
    resolveIdentity: vi.fn(),
    resolveAuthorization: vi.fn(),
    resolveActivationIdentity: vi.fn(async () => result),
  };
}

describe('POST /api/activate — verified Discord email activation', () => {
  let db: Database.Database;
  let server: Server | null = null;
  let logError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = initDb(':memory:');
    logError = vi.fn();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    db.close();
  });

  async function start(
    result: ActivationIdentityResult = {
      ok: true,
      identity: { id: DID, email: EMAIL },
    },
    token: string | null = KOFI_TOKEN,
  ): Promise<{ url: string; statusApi: ReturnType<typeof makeStatusApi> }> {
    const statusApi = makeStatusApi(result);
    server = startKofiWebhook({
      db,
      token: token ?? undefined,
      clientId: CLIENT_ID,
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError,
      statusApi: statusApi as never,
      apiOrigin: 'https://vozen.org',
    });
    if (!server) throw new Error('server did not start');
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server has no port');
    return { url: `http://127.0.0.1:${address.port}/api/activate`, statusApi };
  }

  const validBody = {
    termsAccepted: true,
    termsVersion: ACTIVATION_TERMS_VERSION,
  };

  function post(url: string, body: unknown, headers: Record<string, string> = {}) {
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer good', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  async function expectError(response: Response, status: number, error: string) {
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  }

  it('supports CORS preflight and disables caching', async () => {
    const { url } = await start();
    const response = await fetch(url, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a wrong method', async () => {
    const { url } = await start();
    expect((await fetch(url)).status).toBe(405);
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    const { url } = await start();
    await expectError(await post(url, '{not-json'), 400, 'bad_request');
    const oversized = await post(url, { padding: 'x'.repeat(4_100) });
    expect(oversized.status).toBe(413);
  });

  it.each([
    [{}, 'consent_required'],
    [{ termsAccepted: false, termsVersion: ACTIVATION_TERMS_VERSION }, 'consent_required'],
    [{ termsAccepted: 'true', termsVersion: ACTIVATION_TERMS_VERSION }, 'consent_required'],
    [{ termsAccepted: true, termsVersion: 'old-version' }, 'bad_terms_version'],
  ])('validates literal consent and the current terms version', async (body, error) => {
    const { url } = await start();
    await expectError(await post(url, body), 400, error);
  });

  it('requires a bearer token before contacting Discord', async () => {
    const { url, statusApi } = await start();
    const response = await post(url, validBody, { authorization: '' });
    await expectError(response, 401, 'no_token');
    expect(statusApi.resolveActivationIdentity).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_token', 401, 'invalid_token'],
    ['wrong_audience', 401, 'invalid_token'],
    ['no_email_scope', 403, 'no_email_scope'],
    ['email_missing', 422, 'email_missing'],
    ['email_unverified', 422, 'email_unverified'],
    ['discord_unavailable', 503, 'discord_unavailable'],
  ] as const)(
    'maps typed identity failure %s to its public contract',
    async (reason, status, error) => {
      const { url } = await start({ ok: false, reason });
      await expectError(await post(url, validBody), status, error);
    },
  );

  it('reports a clean 503 when Ko-fi hashing is unavailable', async () => {
    const { url } = await start(undefined, null);
    await expectError(await post(url, validBody), 503, 'kofi_unavailable');
  });

  it('returns generic not_found without creating consent when no purchase matches', async () => {
    const { url } = await start();
    await expectError(await post(url, validBody), 404, 'not_found');
    const count = db.prepare('SELECT COUNT(*) AS n FROM kofi_activation_consent').get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  it('activates all matches and returns only items plus a non-PII confirmation', async () => {
    const emailHash = hashKofiEmail(KOFI_TOKEN, EMAIL);
    recordPendingGrant(
      db,
      { transactionId: 'shop-1', emailHash, plan: 'plus', days: 30, seats: 3 },
      1,
    );
    const { url, statusApi } = await start();

    const response = await post(url, validBody);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    const body = JSON.parse(text) as {
      ok: boolean;
      items: Array<{ plan: string }>;
      confirmation: { id: string; acceptedAt: number; termsVersion: string; method: string };
    };
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.confirmation).toMatchObject({
      acceptedAt: 1_000_000,
      termsVersion: ACTIVATION_TERMS_VERSION,
      method: 'discord_email',
    });
    expect(statusApi.resolveActivationIdentity).toHaveBeenCalledWith('good', CLIENT_ID);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(emailHash);
    expect(text).not.toContain('good');
    expect(JSON.stringify(logError.mock.calls)).not.toContain(EMAIL);
    expect(isUserPremium(db, DID, 1_000_001)).toBe(true);
    expect(findUnclaimedPendingByTx(db, 'shop-1')).toBeNull();
  });

  it('uses a separate tight rate-limit bucket', async () => {
    const { url } = await start();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(url, validBody, { 'x-forwarded-for': '5.5.5.5' });
      expect(response.status).toBe(404);
    }
    await expectError(
      await post(url, validBody, { 'x-forwarded-for': '5.5.5.5' }),
      429,
      'rate_limited',
    );
  });
});
