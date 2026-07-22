import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { startKofiWebhook } from '../src/premium/kofiWebhook';
import { createDashboardApi } from '../src/premium/dashboardApi';
import { getGuildConfig } from '../src/store/guildConfig';
import { getChannelProfile } from '../src/store/channelProfiles';

const TOKEN = 'good-token';
const CLIENT_ID = '1523826014935842997';
const GUILD = '123123123123123123';
const OTHER = '456456456456456456';
const CHANNEL = '789789789789789789';
const VOICE = 'en_US-amy-medium';

function fakeFetch(): typeof fetch {
  return (async (url: string, init?: { headers?: Record<string, string> }) => {
    if (init?.headers?.Authorization !== `Bearer ${TOKEN}`) {
      return { ok: false, status: 401, json: async () => ({}) } as unknown as Response;
    }
    if (url.endsWith('/oauth2/@me')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ application: { id: CLIENT_ID }, scopes: ['identify', 'guilds'] }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => [
        { id: GUILD, name: 'Mine', icon: null, permissions: '0x20' },
        { id: OTHER, name: 'Other', icon: null, permissions: '0' },
      ],
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('/api/dashboard/* - HTTP routes', () => {
  let db: Database.Database;
  let server: Server | null = null;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    db.close();
  });

  async function start(): Promise<string> {
    const dashboardApi = createDashboardApi({
      db,
      now: () => 1_000,
      expectedClientId: CLIENT_ID,
      fetchImpl: fakeFetch(),
      botHasGuild: (id) => id === GUILD,
      resolveChannels: () => [{ id: CHANNEL, label: '#general' }],
      resolveVoiceChannels: () => [{ id: '888888888888888888', label: 'Lounge' }],
      availableModels: [VOICE],
    });
    server = startKofiWebhook({
      db,
      token: 'kofi',
      port: 0,
      now: () => 1_000,
      logInfo: () => {},
      logError: () => {},
      dashboardApi,
      apiOrigin: 'https://vozen.org',
    });
    if (!server) throw new Error('server did not start');
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    return `http://127.0.0.1:${address.port}`;
  }

  const auth = { authorization: `Bearer ${TOKEN}` };

  it('requires a valid token and only lists manageable guilds', async () => {
    const base = await start();
    expect((await fetch(`${base}/api/dashboard/guilds`)).status).toBe(401);
    expect(
      (
        await fetch(`${base}/api/dashboard/guilds`, {
          headers: { authorization: 'Bearer wrong' },
        })
      ).status,
    ).toBe(401);
    const res = await fetch(`${base}/api/dashboard/guilds`, { headers: auth });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guilds: { id: string }[] };
    expect(body.guilds.map((guild) => guild.id)).toEqual([GUILD]);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vozen.org');
  });

  it('GET returns config, capabilities and authoritative options only when authorized', async () => {
    const base = await start();
    const ok = await fetch(`${base}/api/dashboard/guild/${GUILD}`, { headers: auth });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('config');
    expect(body).toHaveProperty('capabilities');
    expect(body).toHaveProperty('options');
    expect((await fetch(`${base}/api/dashboard/guild/${OTHER}`, { headers: auth })).status).toBe(
      403,
    );
  });

  it('rejects malformed guild ids', async () => {
    const base = await start();
    expect((await fetch(`${base}/api/dashboard/guild/abc`, { headers: auth })).status).toBe(400);
  });

  it('POST persists valid channel and voice and returns authoritative state', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/dashboard/guild/${GUILD}`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ xsaid: false, ttsChannelId: CHANNEL, defaultVoice: VOICE }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { config: { ttsChannelId: string; autoread: boolean } };
    expect(body.config).toMatchObject({ ttsChannelId: CHANNEL, autoread: true });
    expect(getGuildConfig(db, GUILD)).toMatchObject({
      xsaid: false,
      ttsChannelId: CHANNEL,
      defaultVoice: VOICE,
      autoread: true,
    });
  });

  it.each([
    ['ttsChannelId', 'tampered'],
    ['defaultVoice', 'tampered'],
  ])('POST rejects tampered %s with HTTP 400', async (field, value) => {
    const base = await start();
    const res = await fetch(`${base}/api/dashboard/guild/${GUILD}`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_setting', field });
  });

  it('does not write a non-manageable guild and rejects invalid JSON', async () => {
    const base = await start();
    expect(
      (
        await fetch(`${base}/api/dashboard/guild/${OTHER}`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ xsaid: false }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${base}/api/dashboard/guild/${GUILD}`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: '{ not json',
        })
      ).status,
    ).toBe(400);
  });

  it('creates and deletes a channel profile through its scoped route', async () => {
    const base = await start();
    const profileUrl = `${base}/api/dashboard/guild/${GUILD}/profile/${CHANNEL}`;
    const saved = await fetch(profileUrl, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ autoRead: true, engine: 'piper', maxChars: 500 }),
    });
    expect(saved.status).toBe(200);
    expect(getChannelProfile(db, GUILD, CHANNEL)).toMatchObject({
      autoRead: true,
      engine: 'piper',
      maxChars: 500,
    });
    expect((await fetch(profileUrl, { method: 'DELETE', headers: auth })).status).toBe(204);
    expect(getChannelProfile(db, GUILD, CHANNEL)).toBeNull();
  });
});
