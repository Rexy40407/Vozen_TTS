// tests/adminRouter.test.ts — HTTP surface of the admin console (plan 037), driven end to end
// through startKofiWebhook. Pins the invariants that matter because the page and code are public:
// login mints a session; authenticated routes take the SESSION only (never a Discord token); a
// session for a non-owner is refused; the console is inert (404) until configured; CORS on the
// admin routes uses a DIFFERENT origin than the Premium panel and does not move the panel's own.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'node:http';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { startKofiWebhook } from '../src/premium/kofiWebhook';
import { createAdminApi, type AdminApi } from '../src/premium/adminApi';
import { signAdminSession } from '../src/premium/adminAuth';
import { isUserPremium } from '../src/store/premium';
import { bumpTalk } from '../src/store/talkStats';

const OWNER = '1523489275155583056';
const SECRET = 'router-sess-secret-abcdefghijklmnop'; // >= 32 chars (fail-closed gate)
const PANEL_ORIGIN = 'https://rexy40407.github.io';
const NOW = 1_000_000;

const CLIENT = '1526211106081734666'; // the console's OAuth app id (audience)
const resolveAuthorization = vi.fn(async (token: string) => {
  if (token === 'owner-token') return { userId: OWNER, applicationId: CLIENT, scopes: [] };
  if (token === 'other-token')
    return { userId: '222333444555666777', applicationId: CLIENT, scopes: [] };
  return null;
});

/** Minimal fake statusApi so /api/me/premium exists (for the CORS-scoping test). */
const statusApi = {
  getStatus: vi.fn(async () => ({ code: 200, body: {} })),
  resolveIdentity: vi.fn(async () => null),
};

function makeAdmin(db: Database.Database, enabled = true) {
  return createAdminApi({
    db,
    now: () => NOW,
    resolveAuthorization,
    adminSessionSecret: enabled ? SECRET : undefined,
    ownerId: OWNER,
    adminClientId: CLIENT,
    logInfo: () => {},
    resolveGuilds: () => [
      { id: 'G1', name: 'Test Server', icon: null, memberCount: 4, joinedTimestamp: 1680000000000 },
    ],
  });
}

describe('admin console — HTTP router', () => {
  let db: Database.Database;
  let server: Server | null = null;

  beforeEach(() => (db = initDb(':memory:')));
  afterEach(async () => {
    if (server) {
      await new Promise<void>((r) => server!.close(() => r()));
      server = null;
    }
    db.close();
  });

  async function start(enabled = true, adminApiOverride?: AdminApi): Promise<string> {
    server = startKofiWebhook({
      db,
      token: 'tok',
      port: 0,
      now: () => NOW,
      logInfo: () => {},
      logError: () => {},
      statusApi: statusApi as never,
      apiOrigin: 'https://vozen.org',
      adminApi: adminApiOverride ?? makeAdmin(db, enabled),
      adminPanelOrigin: PANEL_ORIGIN,
    });
    if (!server) throw new Error('no server');
    await new Promise<void>((r) => server!.once('listening', () => r()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    return `http://127.0.0.1:${addr.port}`;
  }

  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const get = (url: string, headers: Record<string, string> = {}) => fetch(url, { headers });

  it('login with the owner Discord token mints a session that unlocks /passes', async () => {
    const base = await start();
    const login = await post(
      `${base}/api/admin/login`,
      {},
      { authorization: 'Bearer owner-token' },
    );
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    expect(typeof token).toBe('string');

    const passes = await get(`${base}/api/admin/passes`, { authorization: `Bearer ${token}` });
    expect(passes.status).toBe(200);
  });

  it('login with a non-owner Discord identity -> 403 (indistinct)', async () => {
    const base = await start();
    const res = await post(`${base}/api/admin/login`, {}, { authorization: 'Bearer other-token' });
    expect(res.status).toBe(403);
  });

  it('login with no token -> 403', async () => {
    const base = await start();
    expect((await post(`${base}/api/admin/login`, {})).status).toBe(403);
  });

  it('a bare Discord token is NOT a session — /passes refuses it', async () => {
    const base = await start();
    const res = await get(`${base}/api/admin/passes`, { authorization: 'Bearer owner-token' });
    expect(res.status).toBe(403);
  });

  it('a session signed for a NON-owner id is refused', async () => {
    const base = await start();
    const forged = signAdminSession('222333444555666777', SECRET, NOW);
    const res = await get(`${base}/api/admin/passes`, { authorization: `Bearer ${forged}` });
    expect(res.status).toBe(403);
  });

  it('is inert (404) on every admin route when unconfigured', async () => {
    const base = await start(false); // adminApi.enabled === false
    expect((await post(`${base}/api/admin/login`, {})).status).toBe(404);
    expect((await get(`${base}/api/admin/passes`)).status).toBe(404);
  });

  it('grant then revoke Plus round-trips through HTTP', async () => {
    const base = await start();
    const session = signAdminSession(OWNER, SECRET, NOW);
    const h = { authorization: `Bearer ${session}` };

    const g = await post(
      `${base}/api/admin/grant`,
      { kind: 'plus', id: '424242424242424242', days: 30 },
      h,
    );
    expect(g.status).toBe(200);
    expect(isUserPremium(db, '424242424242424242', NOW)).toBe(true);

    const r = await post(`${base}/api/admin/revoke`, { kind: 'plus', id: '424242424242424242' }, h);
    expect(r.status).toBe(200);
    expect(isUserPremium(db, '424242424242424242', NOW)).toBe(false);
  });

  it('GET /api/admin/guilds returns the servers with a valid session, 403 without', async () => {
    const base = await start();
    // No session -> refused.
    expect((await get(`${base}/api/admin/guilds`)).status).toBe(403);
    // With a session -> the guild list (from resolveGuilds + talk_stats).
    const session = signAdminSession(OWNER, SECRET, NOW);
    const r = await get(`${base}/api/admin/guilds`, { authorization: `Bearer ${session}` });
    expect(r.status).toBe(200);
    const d = (await r.json()) as { guilds: Array<{ id: string; name: string }> };
    expect(d.guilds.some((x) => x.id === 'G1' && x.name === 'Test Server')).toBe(true);
  });

  it('rejects a malformed grant with 400 (bad snowflake)', async () => {
    const base = await start();
    const session = signAdminSession(OWNER, SECRET, NOW);
    const res = await post(
      `${base}/api/admin/grant`,
      { kind: 'plus', id: 'nope', days: 30 },
      {
        authorization: `Bearer ${session}`,
      },
    );
    expect(res.status).toBe(400);
  });

  it('CORS on admin routes uses the panel origin; the Premium panel keeps its own origin', async () => {
    const base = await start();
    const session = signAdminSession(OWNER, SECRET, NOW);
    const admin = await get(`${base}/api/admin/passes`, { authorization: `Bearer ${session}` });
    expect(admin.headers.get('access-control-allow-origin')).toBe(PANEL_ORIGIN);

    // The existing panel route must NOT have moved to the panel origin.
    const panel = await get(`${base}/api/me/premium`);
    expect(panel.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
  });

  it('a store error inside an admin route returns 500, not a process crash — BUG-01', async () => {
    // A better-sqlite3 throw (disk full / I/O) inside a SYNCHRONOUS admin route must become a
    // clean 500 — never escape the request listener to process.on('uncaughtException') -> exit(1),
    // which drops every live voice session. Every sibling route (Ko-fi, dashboard) already guards this.
    const boom: AdminApi = {
      enabled: true,
      login: async () => ({ ok: false }),
      authorize: (t) => (t ? OWNER : null),
      listPasses: () => {
        throw new Error('SQLITE_IOERR: disk I/O error');
      },
      listGuilds: () => [],
      listTopTalkers: async () => [],
      grant: () => ({ ok: true, expiresAt: 0 }),
      revoke: () => ({ ok: true }),
    };
    const base = await start(true, boom);
    const res = await get(`${base}/api/admin/passes`, { authorization: 'Bearer any' });
    expect(res.status).toBe(500);
  });

  it('GET /api/admin/toptalkers returns the global top talkers with a session, 403 without', async () => {
    const base = await start();
    // No session -> refused.
    expect((await get(`${base}/api/admin/toptalkers`)).status).toBe(403);
    // Seed one read message so there is a talker to rank.
    bumpTalk(db, 'G1', '424242424242424242', new Date());
    const session = signAdminSession(OWNER, SECRET, NOW);
    const r = await get(`${base}/api/admin/toptalkers`, { authorization: `Bearer ${session}` });
    expect(r.status).toBe(200);
    const d = (await r.json()) as {
      talkers: Array<{
        id: string;
        total: number;
        language: string;
        engine: string;
        usageSamples: number;
        usageSource: string;
      }>;
    };
    expect(d.talkers).toContainEqual(
      expect.objectContaining({
        id: '424242424242424242',
        total: 1,
        language: 'English (US)',
        engine: 'Padrão (local)',
        usageSamples: 0,
        usageSource: 'configured',
      }),
    );
  });

  it('an ASYNC store error inside /toptalkers returns 500, not a process crash', async () => {
    // listTopTalkers is async (identity resolution hits the REST). A rejected promise must become
    // a clean 500 — never escape to process.on('uncaughtException') -> exit(1), which the sibling
    // sync try/catch would NOT catch. This pins the .then/.catch guard on the async route.
    const boomAsync: AdminApi = {
      enabled: true,
      login: async () => ({ ok: false }),
      authorize: (t) => (t ? OWNER : null),
      listPasses: () => ({ plus: [], passes: [], pending: [] }) as never,
      listGuilds: () => [],
      listTopTalkers: async () => {
        throw new Error('SQLITE_IOERR: disk I/O error');
      },
      grant: () => ({ ok: true, expiresAt: 0 }),
      revoke: () => ({ ok: true }),
    };
    const base = await start(true, boomAsync);
    const res = await get(`${base}/api/admin/toptalkers`, { authorization: 'Bearer any' });
    expect(res.status).toBe(500);
  });

  it('login has its own tight bucket — the 7th attempt in the window is rate-limited', async () => {
    const base = await start();
    const attempt = () =>
      post(`${base}/api/admin/login`, {}, { authorization: 'Bearer other-token' });
    // 6 allowed (all 403 — non-owner), the 7th trips the limiter (429).
    for (let i = 0; i < 6; i += 1) {
      const r = await attempt();
      expect(r.status).toBe(403);
    }
    expect((await attempt()).status).toBe(429);
  });
});
