import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { ChannelType, Collection, type Guild } from 'discord.js';
import { initDb } from '../src/store/db';
import { getGuildConfig, setGuildConfig } from '../src/store/guildConfig';
import {
  createDashboardApi,
  DASHBOARD_FIELDS,
  listAuthorizedTextChannels,
  sanitizeChannelProfile,
  sanitizePatch,
} from '../src/premium/dashboardApi';
import { getChannelProfile } from '../src/store/channelProfiles';

const TOKEN = 'tok-abc';
const CLIENT_ID = '1523826014935842997';
const GUILD = '999999999999999999';
const CHANNEL = '777777777777777777';
const VOICE = 'en_US-amy-medium';
const MANAGE_GUILD = '0x20';
const NONE = '0';
const ADMIN = '0x8';

function fakeGuildsFetch(
  expected: string,
  guilds: unknown[],
  oauth: { applicationId?: string; scopes?: readonly string[] } = {},
): typeof fetch {
  return (async (url: string, init?: { headers?: Record<string, string> }) => {
    const auth = init?.headers?.Authorization ?? '';
    if (auth !== `Bearer ${expected}`) {
      return { ok: false, status: 401, json: async () => ({}) } as unknown as Response;
    }
    if (url.endsWith('/oauth2/@me')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          application: { id: oauth.applicationId ?? CLIENT_ID },
          scopes: oauth.scopes ?? ['identify', 'guilds'],
        }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => guilds } as unknown as Response;
  }) as unknown as typeof fetch;
}

function makeApi(
  db: Database.Database,
  guilds: unknown[],
  botGuilds: string[] = [GUILD],
  channels = [{ id: CHANNEL, label: 'general' }],
  oauth: { applicationId?: string; scopes?: readonly string[] } = {},
) {
  return createDashboardApi({
    db,
    now: () => 1_000,
    expectedClientId: CLIENT_ID,
    fetchImpl: fakeGuildsFetch(TOKEN, guilds, oauth),
    botHasGuild: (id) => botGuilds.includes(id),
    resolveChannels: () => channels,
    resolveVoiceChannels: () => [{ id: 'voice-channel-1', label: 'Lounge' }],
    resolveRoles: () => [{ id: 'role-1', label: 'Speakers' }],
    availableModels: [VOICE],
  });
}

describe('sanitizePatch - whitelist, validation and channel behaviour', () => {
  const options = { channelIds: new Set([CHANNEL]), voiceIds: new Set([VOICE]) };

  it('discards unknown fields and clamps numeric limits', () => {
    const result = sanitizePatch(
      { soundboard: 1, maxChars: 99999, ratePerMin: -3, enabled: false, foo: 1 },
      options,
      { ttsChannelId: null, autoread: false },
    );
    expect(result).toEqual({
      ok: true,
      patch: { soundboard: true, maxChars: 2000, ratePerMin: 1 },
    });
  });

  it('accepts a valid channel/model and enables Auto-read when channel is selected', () => {
    expect(
      sanitizePatch({ ttsChannelId: CHANNEL, defaultVoice: VOICE }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toEqual({
      ok: true,
      patch: { ttsChannelId: CHANNEL, defaultVoice: VOICE, autoread: true },
    });
  });

  it('respects an explicit Auto-read choice after selecting a channel', () => {
    expect(
      sanitizePatch({ ttsChannelId: CHANNEL, autoread: false }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toEqual({ ok: true, patch: { ttsChannelId: CHANNEL, autoread: false } });
  });

  it('clearing the channel disables Auto-read and the invariant also applies to standalone edits', () => {
    expect(
      sanitizePatch({ ttsChannelId: null, autoread: true }, options, {
        ttsChannelId: CHANNEL,
        autoread: true,
      }),
    ).toEqual({ ok: true, patch: { ttsChannelId: null, autoread: false } });
    expect(
      sanitizePatch({ autoread: true }, options, { ttsChannelId: null, autoread: false }),
    ).toEqual({ ok: true, patch: { autoread: false } });
  });

  it('rejects tampered channel and voice values with the field name', () => {
    expect(
      sanitizePatch({ ttsChannelId: 'tampered' }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toEqual({ ok: false, error: 'invalid_setting', field: 'ttsChannelId' });
    expect(
      sanitizePatch({ defaultVoice: 'tampered' }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toEqual({ ok: false, error: 'invalid_setting', field: 'defaultVoice' });
  });

  it('allows the global voice default and a supported locale', () => {
    expect(
      sanitizePatch({ defaultVoice: '', locale: 'pt' }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toEqual({ ok: true, patch: { defaultVoice: '', locale: 'pt' } });
  });

  it('all dashboard fields are declared', () => {
    expect(DASHBOARD_FIELDS).toContain('ttsChannelId');
    expect(DASHBOARD_FIELDS).toContain('defaultVoice');
    expect(DASHBOARD_FIELDS).toEqual(
      expect.arrayContaining([
        'priorityRoleId',
        'blockedRoleId',
        'translationEnabled',
        'votePromos',
        'stayInCall',
      ]),
    );
  });
});

describe('sanitizeChannelProfile - inherited overrides and authoritative options', () => {
  const options = {
    channelIds: new Set([CHANNEL]),
    voiceChannelIds: new Set(['voice-channel-1']),
    voiceIds: new Set([VOICE]),
  };

  it('accepts bounded nullable overrides and discards unknown fields', () => {
    expect(
      sanitizeChannelProfile(
        {
          autoRead: true,
          translationEnabled: false,
          defaultVoice: VOICE,
          engine: 'piper',
          speed: 1.25,
          maxChars: 450,
          readBots: true,
          voiceChannelId: 'voice-channel-1',
          owner: true,
        },
        options,
      ),
    ).toEqual({
      ok: true,
      patch: {
        autoRead: true,
        translationEnabled: false,
        defaultVoice: VOICE,
        engine: 'piper',
        speed: 1.25,
        maxChars: 450,
        readBots: true,
        voiceChannelId: 'voice-channel-1',
      },
    });
  });

  it('rejects tampered voices, channels and engines', () => {
    expect(sanitizeChannelProfile({ defaultVoice: 'bad' }, options)).toMatchObject({ ok: false });
    expect(sanitizeChannelProfile({ voiceChannelId: 'bad' }, options)).toMatchObject({ ok: false });
    expect(sanitizeChannelProfile({ engine: 'shell' }, options)).toMatchObject({ ok: false });
  });
});

describe('listAuthorizedTextChannels', () => {
  it('keeps only GuildText channels where the bot has all required permissions', () => {
    const member = {};
    const cache = new Collection<string, unknown>();
    cache.set('later', {
      id: 'later',
      name: 'later',
      type: ChannelType.GuildText,
      rawPosition: 2,
      permissionsFor: (target: unknown) => ({ has: () => target === member }),
    });
    cache.set('denied', {
      id: 'denied',
      name: 'denied',
      type: ChannelType.GuildText,
      rawPosition: 0,
      permissionsFor: () => ({ has: () => false }),
    });
    cache.set('voice', {
      id: 'voice',
      name: 'voice',
      type: ChannelType.GuildVoice,
      rawPosition: 0,
      permissionsFor: () => ({ has: () => true }),
    });
    cache.set('first', {
      id: 'first',
      name: 'first',
      type: ChannelType.GuildText,
      rawPosition: 1,
      permissionsFor: () => ({ has: () => true }),
    });
    const guild = { members: { me: member }, channels: { cache } } as unknown as Guild;

    expect(listAuthorizedTextChannels(guild)).toEqual([
      { id: 'first', label: '#first' },
      { id: 'later', label: '#later' },
    ]);
  });
});

describe('createDashboardApi - authorization and authoritative options', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => db.close());

  it('lists only manageable servers that contain the bot', async () => {
    const api = makeApi(
      db,
      [
        { id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD },
        { id: '111', name: 'Admin without bot', icon: null, permissions: ADMIN },
        { id: '222', name: 'No permission', icon: null, permissions: NONE },
      ],
      [GUILD],
    );
    expect((await api.listGuilds(TOKEN))?.map((g) => g.id)).toEqual([GUILD]);
    expect(await api.listGuilds('wrong-token')).toBeNull();
  });

  it('does not expose config or options to an unauthorized account', async () => {
    const api = makeApi(db, [{ id: GUILD, name: 'Mine', icon: null, permissions: NONE }]);
    expect(await api.getGuild(TOKEN, GUILD)).toBeNull();
  });

  it('does not expose config or options for an invalid token or after the bot leaves', async () => {
    const guilds = [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }];
    expect(await makeApi(db, guilds).getGuild('wrong-token', GUILD)).toBeNull();
    expect(await makeApi(db, guilds, []).getGuild(TOKEN, GUILD)).toBeNull();
  });

  it.each([[{ applicationId: 'another-app' }], [{ scopes: ['identify'] }]] as const)(
    'does not expose guilds or config for a token missing dashboard authorization',
    async (oauth) => {
      const api = makeApi(
        db,
        [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }],
        [GUILD],
        [{ id: CHANNEL, label: 'general' }],
        oauth,
      );
      await expect(api.listGuilds(TOKEN)).resolves.toBeNull();
      await expect(api.getGuild(TOKEN, GUILD)).resolves.toBeNull();
    },
  );

  it('does not log a bearer token when Discord validation fails', async () => {
    const logError = vi.fn();
    const api = createDashboardApi({
      db,
      now: () => 1_000,
      expectedClientId: CLIENT_ID,
      fetchImpl: (async () => {
        throw new Error(`request failed for Bearer ${TOKEN}`);
      }) as typeof fetch,
      botHasGuild: () => true,
      resolveChannels: () => [],
      availableModels: [],
      logError,
    });
    await expect(api.listGuilds(TOKEN)).resolves.toBeNull();
    expect(JSON.stringify(logError.mock.calls)).not.toContain(TOKEN);
  });

  it('returns config, capabilities and backend-generated channel, voice and locale options', async () => {
    const api = makeApi(db, [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }]);
    const payload = await api.getGuild(TOKEN, GUILD);
    expect(payload?.config.ttsChannelId).toBeNull();
    expect(payload?.config.defaultVoice).toBe('');
    expect(payload?.capabilities).toEqual({
      ttsChannelId: true,
      defaultVoice: true,
      channelProfiles: true,
    });
    expect(payload?.options.channels).toEqual([{ id: CHANNEL, label: 'general' }]);
    expect(payload?.options.voices[0]).toMatchObject({ id: VOICE });
    expect(payload?.options.locales).toContainEqual({ id: 'pt', label: expect.any(String) });
    expect(payload?.options.voiceChannels).toEqual([{ id: 'voice-channel-1', label: 'Lounge' }]);
    expect(payload?.options.roles).toEqual([{ id: 'role-1', label: 'Speakers' }]);
    expect(payload?.channelProfiles).toEqual([]);
  });

  it('creates and deletes a validated channel profile for an authorized manager', async () => {
    const api = makeApi(db, [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }]);
    const saved = await api.saveChannelProfile(TOKEN, GUILD, CHANNEL, {
      autoRead: true,
      translationEnabled: null,
      defaultVoice: VOICE,
      engine: 'piper',
      speed: 1.1,
      maxChars: 500,
      readBots: false,
      voiceChannelId: 'voice-channel-1',
    });
    expect(saved && 'channelProfiles' in saved ? saved.channelProfiles : []).toHaveLength(1);
    expect(getChannelProfile(db, GUILD, CHANNEL)?.engine).toBe('piper');
    expect(await api.deleteChannelProfile(TOKEN, GUILD, CHANNEL)).toBe(true);
    expect(getChannelProfile(db, GUILD, CHANNEL)).toBeNull();
  });

  it('rejects an unauthorized or tampered profile without writing it', async () => {
    const api = makeApi(db, [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }]);
    expect(await api.saveChannelProfile(TOKEN, GUILD, 'tampered', {})).toMatchObject({
      error: 'invalid_profile',
    });
    expect(await api.saveChannelProfile('wrong-token', GUILD, CHANNEL, {})).toBeNull();
    expect(getChannelProfile(db, GUILD, CHANNEL)).toBeNull();
  });

  it('saves valid settings and rejects tampered values without touching storage', async () => {
    const api = makeApi(db, [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }]);
    const saved = await api.saveConfig(TOKEN, GUILD, {
      xsaid: false,
      ttsChannelId: CHANNEL,
      defaultVoice: VOICE,
      priorityRoleId: 'role-1',
      blockedRoleId: null,
      translationEnabled: true,
    });
    expect(saved && 'config' in saved ? saved.config.ttsChannelId : null).toBe(CHANNEL);
    expect(getGuildConfig(db, GUILD).autoread).toBe(true);
    expect(getGuildConfig(db, GUILD).priorityRoleId).toBe('role-1');

    const rejected = await api.saveConfig(TOKEN, GUILD, { defaultVoice: 'tampered' });
    expect(rejected).toEqual({ error: 'invalid_setting', field: 'defaultVoice' });
    expect(getGuildConfig(db, GUILD).defaultVoice).toBe(VOICE);
  });

  it('rejects tampered queue roles and a role cannot be both priority and blocked', () => {
    const options = {
      channelIds: new Set([CHANNEL]),
      voiceIds: new Set([VOICE]),
      roleIds: new Set(['role-1']),
    };
    expect(
      sanitizePatch({ priorityRoleId: 'tampered' }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toMatchObject({ ok: false, field: 'priorityRoleId' });
    expect(
      sanitizePatch({ priorityRoleId: 'role-1', blockedRoleId: 'role-1' }, options, {
        ttsChannelId: null,
        autoread: false,
      }),
    ).toMatchObject({ ok: false, field: 'blockedRoleId' });
  });

  it('shows removed channels and models as disabled options without mutating storage on GET', async () => {
    setGuildConfig(db, GUILD, {
      ttsChannelId: 'removed-channel',
      defaultVoice: 'removed-model',
      autoread: true,
    });
    const api = makeApi(
      db,
      [{ id: GUILD, name: 'Mine', icon: null, permissions: MANAGE_GUILD }],
      [GUILD],
      [],
    );
    const before = getGuildConfig(db, GUILD);
    const payload = await api.getGuild(TOKEN, GUILD);
    expect(payload?.options.channels[0]).toEqual({
      id: 'removed-channel',
      label: 'removed-channel',
      unavailable: true,
    });
    expect(payload?.options.voices[0]).toEqual({
      id: 'removed-model',
      label: 'removed-model',
      unavailable: true,
    });
    expect(getGuildConfig(db, GUILD)).toEqual(before);
  });
});
