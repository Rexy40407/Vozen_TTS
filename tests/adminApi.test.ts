import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { isUserPremium } from '../src/store/premium';
import { bumpTalk } from '../src/store/talkStats';
import { bumpTalkUsage } from '../src/store/talkUsage';
import { bumpGuildTalk } from '../src/store/guildTalkStreak';
import { signAdminSession } from '../src/premium/adminAuth';
import { createAdminApi, type AdminApi } from '../src/premium/adminApi';

// The admin console logic (plan 037). This is the money surface AND the whole security boundary
// (public repos), so the tests pin the exact ways it must refuse: a non-owner identity, a bare
// Discord token where a session is required, and inert-by-default when unconfigured.

const OWNER = '1523489275155583056';
const SECRET = 'sess-secret-abcdefghijklmnopqrstuvwxyz'; // >= 32 chars (fail-closed gate)
const CLIENT = '1526211106081734666'; // the console's OAuth app id (audience)

const NOW = 1_700_000_000_000;

/** Fake /oauth2/@me validation — returns WHICH user + WHICH app minted the token:
 *  'owner-token'     → owner, minted by the console's own app (the only accepted combo);
 *  'other-token'     → a different user, console app (wrong user);
 *  'wrong-app-token' → the owner, but minted by SOME OTHER app (audience-substitution attempt). */
const resolveAuthorization = async (token: string) => {
  if (token === 'owner-token') return { userId: OWNER, applicationId: CLIENT, scopes: [] };
  if (token === 'other-token')
    return { userId: '999999999999999999', applicationId: CLIENT, scopes: [] };
  if (token === 'wrong-app-token')
    return { userId: OWNER, applicationId: '999000999000999000', scopes: [] };
  return null;
};

function make(
  db: Database.Database,
  over: Partial<Parameters<typeof createAdminApi>[0]> = {},
): AdminApi {
  return createAdminApi({
    db,
    now: () => NOW,
    resolveAuthorization,
    adminSessionSecret: SECRET,
    ownerId: OWNER,
    adminClientId: CLIENT,
    logInfo: () => {},
    ...over,
  });
}

describe('adminApi — enabled / inert', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('is enabled only when the session secret, ownerId and adminClientId are present', () => {
    expect(make(db).enabled).toBe(true);
    expect(make(db, { adminSessionSecret: undefined }).enabled).toBe(false);
    expect(make(db, { ownerId: undefined }).enabled).toBe(false);
    expect(make(db, { adminClientId: undefined }).enabled).toBe(false);
  });

  it('when disabled, login and authorize always refuse', async () => {
    const api = make(db, { adminSessionSecret: undefined });
    expect(await api.login('owner-token')).toEqual({ ok: false });
    expect(api.authorize('anything')).toBeNull();
  });

  it('DISABLES the console (fail-closed) + warns when ADMIN_SESSION_SECRET is weak', () => {
    // A short HMAC secret is forgeable — worse on the money surface than a dark console. So a
    // <32-char secret fails closed (enabled=false) and logs why, instead of arming weak sigs.
    const weakLogs: string[] = [];
    const weak = make(db, { adminSessionSecret: 'short', logInfo: (m) => weakLogs.push(m) });
    expect(weak.enabled).toBe(false);
    expect(weakLogs.some((l) => l.includes('ADMIN_SESSION_SECRET'))).toBe(true);
    // A 32+ char secret is enabled and silent.
    const strongLogs: string[] = [];
    const strong = make(db, {
      adminSessionSecret: 'x'.repeat(32),
      logInfo: (m) => strongLogs.push(m),
    });
    expect(strong.enabled).toBe(true);
    expect(strongLogs.some((l) => l.includes('ADMIN_SESSION_SECRET'))).toBe(false);
  });
});

describe('adminApi — login', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('accepts the owner Discord token and mints a session authorize() accepts', async () => {
    const api = make(db);
    const res = await api.login('owner-token');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(api.authorize(res.token)).toBe(OWNER);
      expect(res.expiresAt).toBeGreaterThan(NOW);
    }
  });

  it('rejects a Discord identity that is NOT the owner', async () => {
    expect(await make(db).login('other-token')).toEqual({ ok: false });
  });

  it('rejects an owner token minted by a DIFFERENT OAuth app (audience binding)', async () => {
    // Core of the access-token-substitution fix: even a valid identify token for the OWNER is
    // refused unless it was minted by the console's own OAuth application (adminClientId).
    expect(await make(db).login('wrong-app-token')).toEqual({ ok: false });
  });

  it('rejects when the Discord token is missing or invalid', async () => {
    expect(await make(db).login(null)).toEqual({ ok: false });
    expect(await make(db).login('garbage')).toEqual({ ok: false });
  });
});

describe('adminApi — authorize (session only, owner only)', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('accepts a session signed for the owner', () => {
    const tok = signAdminSession(OWNER, SECRET, NOW);
    expect(make(db).authorize(tok)).toBe(OWNER);
  });

  it('rejects a session signed for a NON-owner id (defense in depth)', () => {
    const tok = signAdminSession('999999999999999999', SECRET, NOW);
    expect(make(db).authorize(tok)).toBeNull();
  });

  it('rejects a bare Discord token where a session is required', () => {
    // A Discord OAuth token is not an HMAC session — it must never authorize a mutation.
    expect(make(db).authorize('owner-token')).toBeNull();
  });

  it('rejects null / empty', () => {
    expect(make(db).authorize(null)).toBeNull();
    expect(make(db).authorize('')).toBeNull();
  });
});

describe('adminApi — grant / revoke / list', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('grants Plus and Premium via the tested store paths', () => {
    const api = make(db);
    const p = api.grant({ kind: 'plus', id: '111', days: 30 });
    expect(p.ok).toBe(true);
    expect(isUserPremium(db, '111', NOW)).toBe(true);

    const g = api.grant({ kind: 'premium', id: '222', days: 30, seats: 3 });
    expect(g.ok).toBe(true);
    // the pass exists; a seat can now be activated -> guild premium (covered elsewhere)
    expect(api.listPasses().passes.some((x) => x.userId === '222' && x.seats === 3)).toBe(true);
  });

  it('rejects malformed grant input', () => {
    const api = make(db);
    expect(api.grant({ kind: 'plus', id: 'not-a-snowflake', days: 30 }).ok).toBe(false);
    expect(api.grant({ kind: 'plus', id: '111', days: 0 }).ok).toBe(false);
    expect(api.grant({ kind: 'plus', id: '111', days: 99999 }).ok).toBe(false);
    expect(api.grant({ kind: 'premium', id: '111', days: 30, seats: 0 }).ok).toBe(false);
    expect(api.grant({ kind: 'premium', id: '111', days: 30, seats: 999 }).ok).toBe(false);
  });

  it('revokes Plus and Premium', () => {
    const api = make(db);
    api.grant({ kind: 'plus', id: '111', days: 30 });
    api.grant({ kind: 'premium', id: '222', days: 30, seats: 2 });
    expect(api.revoke({ kind: 'plus', id: '111' }).ok).toBe(true);
    expect(isUserPremium(db, '111', NOW)).toBe(false);
    expect(api.revoke({ kind: 'premium', id: '222' }).ok).toBe(true);
    expect(api.listPasses().passes).toEqual([]);
  });

  it('revoke rejects a non-snowflake id without touching the store or the log — SEC-01', () => {
    // grant() validates the id; revoke() must too. A forged id with a newline must never reach
    // the store or the log line (log-forging guard). Strong secret so SEC-02 does not warn here.
    const logs: string[] = [];
    const api = make(db, { adminSessionSecret: 'x'.repeat(32), logInfo: (m) => logs.push(m) });
    const res = api.revoke({ kind: 'plus', id: '111\n[admin] forged log line -> true' });
    expect(res.ok).toBe(false);
    expect(logs).toEqual([]);
  });

  it('listPasses returns active plus, passes and unclaimed pending', () => {
    const api = make(db);
    api.grant({ kind: 'plus', id: '111', days: 30 });
    const view = api.listPasses();
    expect(view.plus.some((x) => x.userId === '111')).toBe(true);
    expect(Array.isArray(view.pending)).toBe(true);
  });
});

describe('adminApi — listGuilds (servers tab)', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('is empty without a resolveGuilds source', () => {
    expect(make(db).listGuilds()).toEqual([]);
  });

  it('returns each guild with its stored usage, busiest first, and top speakers', () => {
    const now = new Date(NOW);
    // Guild A: 3 messages read (u1 twice, u2 once). Guild B: 1 message (u3).
    bumpTalk(db, 'A', 'u1', now);
    bumpTalk(db, 'A', 'u1', now);
    bumpTalk(db, 'A', 'u2', now);
    bumpTalk(db, 'B', 'u3', now);

    const api = make(db, {
      resolveGuilds: () => [
        { id: 'B', name: 'Beta', icon: null, memberCount: 5, joinedTimestamp: 1600000000000 },
        {
          id: 'A',
          name: 'Alpha',
          icon: 'https://cdn.discordapp.com/icons/A/x.png',
          memberCount: 10,
          joinedTimestamp: 1700000000000,
        },
      ],
    });
    const rows = api.listGuilds();

    // Busiest first: A (3 messages) before B (1) — regardless of resolveGuilds order.
    expect(rows.map((r) => r.id)).toEqual(['A', 'B']);
    expect(rows[0]).toMatchObject({
      id: 'A',
      name: 'Alpha',
      icon: 'https://cdn.discordapp.com/icons/A/x.png',
      memberCount: 10,
      messages: 3,
      speakers: 2,
      joinedTimestamp: 1700000000000,
    });
    // Stats come from talk_stats: u1 (2) is the top speaker of A.
    expect(rows[0].topSpeakers[0]).toEqual({ userId: 'u1', count: 2 });
    expect(rows[1]).toMatchObject({ id: 'B', messages: 1, speakers: 1 });
  });

  it('shows a guild the bot is in even with zero messages read yet', () => {
    const api = make(db, {
      resolveGuilds: () => [
        { id: 'C', name: 'Gamma', icon: null, memberCount: 3, joinedTimestamp: 1650000000000 },
      ],
    });
    const rows = api.listGuilds();
    expect(rows).toEqual([
      {
        id: 'C',
        name: 'Gamma',
        icon: null,
        memberCount: 3,
        messages: 0,
        speakers: 0,
        topSpeakers: [],
        joinedTimestamp: 1650000000000,
        streak: 0,
        bestStreak: 0,
      },
    ]);
  });

  it('includes the LIVE server streak per guild', () => {
    const now = new Date(NOW);
    const yesterday = new Date(NOW - 24 * 3600 * 1000);
    // Guild D: someone spoke yesterday and today -> server streak 2.
    bumpGuildTalk(db, 'D', yesterday);
    bumpGuildTalk(db, 'D', now);
    const api = make(db, {
      now: () => NOW,
      resolveGuilds: () => [
        { id: 'D', name: 'Delta', icon: null, memberCount: 8, joinedTimestamp: 1650000000000 },
      ],
    });
    const row = api.listGuilds()[0];
    expect(row.streak).toBe(2);
    expect(row.bestStreak).toBe(2);
  });
});

describe('adminApi — listTopTalkers (global top 10, identity+voice usage)', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('aggregates message count ACROSS servers, busiest first, capped at 10', async () => {
    const now = new Date(NOW);
    // u1: 2 in A + 1 in B = 3 (top). u2: 1 in A. u3: 2 in B.
    bumpTalk(db, 'A', 'u1', now);
    bumpTalk(db, 'A', 'u1', now);
    bumpTalk(db, 'B', 'u1', now);
    bumpTalk(db, 'A', 'u2', now);
    bumpTalk(db, 'B', 'u3', now);
    bumpTalk(db, 'B', 'u3', now);
    // 12 more distinct speakers, 1 message each, to prove the LIMIT 10.
    for (let i = 0; i < 12; i += 1) bumpTalk(db, 'A', `x${i}`, now);

    const rows = await make(db).listTopTalkers();
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({
      id: 'u1',
      total: 3,
      username: null,
      avatar: null,
      language: 'English (US)',
      engine: 'Padrão (local)',
      usageSamples: 0,
      usageSource: 'configured',
    });
    // u3 (2) ranks above u2 (1) and the 1-message crowd.
    expect(rows.map((r) => r.id).slice(0, 3)).toEqual(['u1', 'u3', 'u2']);
  });

  it('WITHOUT resolveUsers -> rows with null username/avatar (UI falls back to the id), NOT empty', async () => {
    bumpTalk(db, 'A', 'u1', new Date(NOW));
    const rows = await make(db).listTopTalkers();
    expect(rows).toEqual([
      {
        id: 'u1',
        total: 1,
        username: null,
        avatar: null,
        language: 'English (US)',
        engine: 'Padrão (local)',
        usageSamples: 0,
        usageSource: 'configured',
      },
    ]);
  });

  it('labels the legacy default engine from the actual runtime configuration', async () => {
    bumpTalk(db, 'A', 'u1', new Date(NOW));
    const [row] = await make(db, { defaultEngine: 'gtts' }).listTopTalkers();
    expect(row).toMatchObject({
      engine: 'Google (gTTS)',
      usageSource: 'configured',
    });
  });

  it('WITH resolveUsers -> merges name+avatar; an unresolved user stays id-only', async () => {
    bumpTalk(db, 'A', 'u1', new Date(NOW));
    bumpTalk(db, 'A', 'u2', new Date(NOW));
    bumpTalk(db, 'A', 'u2', new Date(NOW)); // u2 ranks first (2 msgs)
    const api = make(db, {
      // u2 resolves; u1 is unknown (left every server / rate-limited) -> omitted from the briefs.
      resolveUsers: async (ids: string[]) =>
        ids
          .filter((id) => id === 'u2')
          .map((id) => ({
            id,
            username: 'Duo',
            avatar: 'https://cdn.discordapp.com/avatars/u2/a.webp',
          })),
    });
    const rows = await api.listTopTalkers();
    expect(rows[0]).toEqual({
      id: 'u2',
      total: 2,
      username: 'Duo',
      avatar: 'https://cdn.discordapp.com/avatars/u2/a.webp',
      language: 'English (US)',
      engine: 'Padrão (local)',
      usageSamples: 0,
      usageSource: 'configured',
    });
    expect(rows[1]).toEqual({
      id: 'u1',
      total: 1,
      username: null,
      avatar: null,
      language: 'English (US)',
      engine: 'Padrão (local)',
      usageSamples: 0,
      usageSource: 'configured',
    });
  });

  it('a THROWING resolveUsers degrades to ids-only instead of failing the whole list', async () => {
    bumpTalk(db, 'A', 'u1', new Date(NOW));
    const api = make(db, {
      resolveUsers: async () => {
        throw new Error('discord REST down');
      },
    });
    const rows = await api.listTopTalkers();
    expect(rows).toEqual([
      {
        id: 'u1',
        total: 1,
        username: null,
        avatar: null,
        language: 'English (US)',
        engine: 'Padrão (local)',
        usageSamples: 0,
        usageSource: 'configured',
      },
    ]);
  });

  it('returns the independently most-used language and engine for each speaker', async () => {
    const now = new Date(NOW);
    for (let i = 0; i < 5; i += 1) bumpTalk(db, 'A', 'u1', now);
    bumpTalkUsage(db, 'A', 'u1', 'pt_PT-tugao-medium', 'piper');
    bumpTalkUsage(db, 'A', 'u1', 'pt_PT-tugao-medium', 'kokoro');
    bumpTalkUsage(db, 'A', 'u1', 'pt_PT-tugao-medium', 'kokoro');
    bumpTalkUsage(db, 'A', 'u1', 'en_US-amy-medium', 'kokoro');
    bumpTalkUsage(db, 'A', 'u1', 'en_US-amy-medium', 'kokoro');

    const [row] = await make(db).listTopTalkers();
    expect(row).toMatchObject({
      language: 'Português (Portugal)',
      engine: 'Kokoro',
      usageSamples: 5,
      usageSource: 'measured',
    });
  });
});
