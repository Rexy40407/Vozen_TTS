import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { grantUserPremium, grantGuildPass, activateSeat } from '../src/store/premium';
import { createStatusApi } from '../src/premium/statusApi';

const DID = '123456789012345678';
const CLIENT_ID = '1523826014935842997';
const EMAIL = 'buyer@example.com';

/** Fake fetch: devolve o utilizador `id` para o token `goodToken`; 401 para o resto. */
function fakeFetch(goodToken: string, id: string, user: Record<string, unknown> = {}) {
  const fn = vi.fn(async (url: unknown, init?: { headers?: Record<string, string> }) => {
    const auth = init?.headers?.Authorization ?? '';
    const ok = auth === `Bearer ${goodToken}`;
    const isOauth = String(url).endsWith('/oauth2/@me');
    return {
      ok,
      status: ok ? 200 : 401,
      json: async () => {
        if (!ok) return { message: '401: Unauthorized' };
        return isOauth
          ? { application: { id: CLIENT_ID }, user: { id }, scopes: ['identify'] }
          : { id, username: 'buyer', ...user };
      },
    } as unknown as Response;
  });
  return fn as unknown as typeof fetch & typeof fn;
}

interface ActivationFetchOptions {
  applicationId?: string;
  oauthUserId?: string;
  scopes?: readonly string[];
  userId?: string;
  email?: string | null;
  verified?: boolean;
  oauthStatus?: number;
  userStatus?: number;
  throwOn?: 'oauth' | 'user';
}

function activationFetch(options: ActivationFetchOptions = {}) {
  const email = Object.prototype.hasOwnProperty.call(options, 'email') ? options.email : EMAIL;
  const {
    applicationId = CLIENT_ID,
    oauthUserId = DID,
    scopes = ['identify', 'email'],
    userId = DID,
    verified = true,
    oauthStatus = 200,
    userStatus = 200,
    throwOn,
  } = options;
  const fn = vi.fn(async (url: unknown) => {
    const isOauth = String(url).endsWith('/oauth2/@me');
    if (throwOn === (isOauth ? 'oauth' : 'user')) throw new Error('discord offline');
    const status = isOauth ? oauthStatus : userStatus;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () =>
        isOauth
          ? { application: { id: applicationId }, user: { id: oauthUserId }, scopes }
          : { id: userId, email, verified, username: 'buyer' },
    } as unknown as Response;
  });
  return fn as unknown as typeof fetch & typeof fn;
}

describe('statusApi — validação de token e montagem do estado', () => {
  let db: Database.Database;
  const now = 1_000_000;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('sem token -> 401 no_token (nem chama a Discord)', async () => {
    const fetchImpl = fakeFetch('tok', DID);
    const api = createStatusApi({ db, now: () => now, expectedClientId: CLIENT_ID, fetchImpl });
    const r = await api.getStatus(null);
    expect(r.code).toBe(401);
    expect((r.body as { error: string }).error).toBe('no_token');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('token inválido -> 401 invalid_token', async () => {
    const api = createStatusApi({
      db,
      now: () => now,
      expectedClientId: CLIENT_ID,
      fetchImpl: fakeFetch('tok', DID),
    });
    const r = await api.getStatus('mau-token');
    expect(r.code).toBe(401);
    expect((r.body as { error: string }).error).toBe('invalid_token');
  });

  it.each([
    [{ applicationId: 'another-app' }],
    [{ scopes: [] }],
    [{ userId: 'different-user' }],
  ] as const)('rejects an OAuth token that is not bound to this panel', async (overrides) => {
    const api = createStatusApi({
      db,
      now: () => now,
      expectedClientId: CLIENT_ID,
      fetchImpl: activationFetch(overrides),
    });

    await expect(api.getStatus('secret-token')).resolves.toEqual({
      code: 401,
      body: { error: 'invalid_token' },
    });
  });

  it('does not log a bearer token when status token validation fails', async () => {
    const logError = vi.fn();
    const api = createStatusApi({
      db,
      now: () => now,
      expectedClientId: CLIENT_ID,
      fetchImpl: (async () => {
        throw new Error('request failed for Bearer secret-token');
      }) as typeof fetch,
      logError,
    });

    await expect(api.getStatus('secret-token')).resolves.toEqual({
      code: 401,
      body: { error: 'invalid_token' },
    });
    expect(JSON.stringify(logError.mock.calls)).not.toContain('secret-token');
  });

  it('token válido sem premium -> 200 com plus inativo e passe null', async () => {
    const api = createStatusApi({
      db,
      now: () => now,
      expectedClientId: CLIENT_ID,
      fetchImpl: fakeFetch('tok', DID),
    });
    const r = await api.getStatus('tok');
    expect(r.code).toBe(200);
    const b = r.body as { user: { id: string }; plus: { active: boolean }; pass: unknown };
    expect(b.user.id).toBe(DID);
    expect(b.plus.active).toBe(false);
    expect(b.pass).toBeNull();
  });

  it('usa global_name quando existe', async () => {
    const api = createStatusApi({
      db,
      now: () => now,
      expectedClientId: CLIENT_ID,
      fetchImpl: fakeFetch('tok', DID, { global_name: 'Diogo' }),
    });
    const r = await api.getStatus('tok');
    expect((r.body as { user: { username: string } }).user.username).toBe('Diogo');
  });

  it('token válido com passe -> servidores com nomes resolvidos', async () => {
    grantUserPremium(db, DID, 30, 'kofi', now);
    grantGuildPass(db, DID, 3, 30, 'kofi', now);
    activateSeat(db, DID, 'g-1', now);
    const api = createStatusApi({
      db,
      now: () => now + 1000,
      expectedClientId: CLIENT_ID,
      fetchImpl: fakeFetch('tok', DID),
      resolveGuildName: (id) => (id === 'g-1' ? 'Meu Servidor' : null),
    });
    const r = await api.getStatus('tok');
    const b = r.body as {
      plus: { active: boolean };
      pass: { seats: number; used: number; servers: { id: string; name: string | null }[] };
    };
    expect(b.plus.active).toBe(true);
    expect(b.pass.seats).toBe(3);
    expect(b.pass.used).toBe(1);
    expect(b.pass.servers).toEqual([{ id: 'g-1', name: 'Meu Servidor' }]);
  });

  it('cacheia a identidade: 2 pedidos = 2 fetches à Discord', async () => {
    const fetchImpl = fakeFetch('tok', DID);
    const api = createStatusApi({ db, now: () => now, expectedClientId: CLIENT_ID, fetchImpl });
    await api.getStatus('tok');
    await api.getStatus('tok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('a cache expira após o TTL -> volta a chamar a Discord', async () => {
    const fetchImpl = fakeFetch('tok', DID);
    let clock = now;
    const api = createStatusApi({
      db,
      now: () => clock,
      expectedClientId: CLIENT_ID,
      fetchImpl,
      identityTtlMs: 1000,
    });
    await api.getStatus('tok');
    clock += 2000;
    await api.getStatus('tok');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('limita a cache de identidades para tokens inválidos não crescerem sem fim', async () => {
    const fetchImpl = fakeFetch('tok', DID);
    const api = createStatusApi({
      db,
      now: () => now,
      expectedClientId: CLIENT_ID,
      fetchImpl,
      identityCacheMaxEntries: 2,
    });

    await api.getStatus('mau-1');
    await api.getStatus('mau-2');
    await api.getStatus('mau-3');
    await api.getStatus('mau-1');

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  describe('resolveActivationIdentity', () => {
    it('accepts a verified email token minted for this application with both required scopes', async () => {
      const fetchImpl = activationFetch();
      const api = createStatusApi({
        db,
        now: () => now,
        expectedClientId: CLIENT_ID,
        fetchImpl,
      });

      await expect(api.resolveActivationIdentity('secret-token', CLIENT_ID)).resolves.toEqual({
        ok: true,
        identity: { id: DID, email: EMAIL },
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('rejects a valid Discord token minted for a different OAuth application', async () => {
      const api = createStatusApi({
        db,
        now: () => now,
        expectedClientId: CLIENT_ID,
        fetchImpl: activationFetch({ applicationId: 'different-app' }),
      });

      await expect(api.resolveActivationIdentity('secret-token', CLIENT_ID)).resolves.toEqual({
        ok: false,
        reason: 'wrong_audience',
      });
    });

    it('rejects a token without the email scope before requesting /users/@me', async () => {
      const fetchImpl = activationFetch({ scopes: ['identify'] });
      const api = createStatusApi({
        db,
        now: () => now,
        expectedClientId: CLIENT_ID,
        fetchImpl,
      });

      await expect(api.resolveActivationIdentity('secret-token', CLIENT_ID)).resolves.toEqual({
        ok: false,
        reason: 'no_email_scope',
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('fails closed when /oauth2/@me and /users/@me identify different users', async () => {
      const api = createStatusApi({
        db,
        now: () => now,
        expectedClientId: CLIENT_ID,
        fetchImpl: activationFetch({ userId: 'different-user' }),
      });

      await expect(api.resolveActivationIdentity('secret-token', CLIENT_ID)).resolves.toEqual({
        ok: false,
        reason: 'invalid_token',
      });
    });

    it.each([
      [{ email: null }, 'email_missing'],
      [{ email: undefined }, 'email_missing'],
      [{ verified: false }, 'email_unverified'],
    ] as const)('maps unusable Discord email data to %s', async (overrides, reason) => {
      const api = createStatusApi({
        db,
        now: () => now,
        expectedClientId: CLIENT_ID,
        fetchImpl: activationFetch(overrides),
      });

      await expect(api.resolveActivationIdentity('secret-token', CLIENT_ID)).resolves.toEqual({
        ok: false,
        reason,
      });
    });

    it.each([
      [{ oauthStatus: 401 }, 'invalid_token'],
      [{ userStatus: 403 }, 'invalid_token'],
      [{ oauthStatus: 429 }, 'discord_unavailable'],
      [{ userStatus: 500 }, 'discord_unavailable'],
      [{ throwOn: 'oauth' as const }, 'discord_unavailable'],
    ] as const)(
      'maps Discord failures without treating outages as expired tokens',
      async (overrides, reason) => {
        const api = createStatusApi({
          db,
          now: () => now,
          expectedClientId: CLIENT_ID,
          fetchImpl: activationFetch(overrides),
        });

        await expect(api.resolveActivationIdentity('secret-token', CLIENT_ID)).resolves.toEqual({
          ok: false,
          reason,
        });
      },
    );

    it('does not cache the activation email or leak token/email through the logger', async () => {
      const fetchImpl = activationFetch({ throwOn: 'user' });
      const logError = vi.fn();
      const api = createStatusApi({
        db,
        now: () => now,
        expectedClientId: CLIENT_ID,
        fetchImpl,
        logError,
      });

      await api.resolveActivationIdentity('secret-token', CLIENT_ID);
      await api.resolveActivationIdentity('secret-token', CLIENT_ID);

      expect(fetchImpl).toHaveBeenCalledTimes(4);
      const logged = JSON.stringify(logError.mock.calls);
      expect(logged).not.toContain('secret-token');
      expect(logged).not.toContain(EMAIL);
    });
  });
});
