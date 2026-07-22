import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType } from 'discord.js';
import { messageText } from './messagePayload';

// Minimal @discordjs/voice mock — not used in /config, but the import resolves it.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { getGuildConfig, setGuildConfig } from '../src/store/guildConfig';
import { getBlocklist, addBlockword } from '../src/store/blocklist';
import type Database from 'better-sqlite3';

const GUILD = 'g-config-test';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeConfigDeps(db: Database.Database): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map(),
    db,
    config: {},
    availableModels: ['en_US-amy-medium', 'pt_PT-tugão-medium'],
  } as unknown as BotDeps;
}

interface FakeInteraction {
  commandName: string;
  guildId: string;
  replies: string[];
  reply: (opts: { content: string }) => Promise<void>;
  isRepliable: () => boolean;
  replied: boolean;
  deferred: boolean;
  member: unknown;
  guild: unknown;
  options: unknown;
}

function makeConfigInteraction(opts: {
  sub?: string;
  group?: string | null;
  optionsMap?: Record<string, unknown>;
  guild?: unknown;
}): FakeInteraction {
  const replies: string[] = [];
  const optionsMap = opts.optionsMap ?? {};
  return {
    commandName: 'config',
    guildId: GUILD,
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: unknown) => {
      replies.push(messageText(o));
    },
    member: {
      permissions: { has: () => true }, // admin by default
    },
    guild: opts.guild ?? null,
    options: {
      getSubcommandGroup: (_required = false) => opts.group ?? null,
      getSubcommand: () => opts.sub ?? '',
      getInteger: (name: string) => (optionsMap[name] as number) ?? null,
      getString: (name: string) => (optionsMap[name] as string) ?? '',
      getBoolean: (name: string) => (optionsMap[name] as boolean) ?? false,
      getChannel: (name: string) => (optionsMap[name] as unknown) ?? null,
      getRole: (name: string) => (optionsMap[name] as unknown) ?? null,
    },
  };
}

// ── max-chars ────────────────────────────────────────────────────────────────

describe('/config max-chars — range validation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('rejects value 0 with a clear message and does not apply', async () => {
    const i = makeConfigInteraction({ sub: 'max-chars', optionsMap: { value: 0 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /max-chars|entre|1.*2000|2000.*1/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).maxChars).toBe(300); // default intact
  });

  it('rejects value 2001 with a clear message and does not apply', async () => {
    const i = makeConfigInteraction({ sub: 'max-chars', optionsMap: { value: 2001 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /max-chars|entre|1.*2000|2000.*1/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).maxChars).toBe(300);
  });

  it('rejects value 9999 (well above the maximum) and does not persist', async () => {
    const i = makeConfigInteraction({ sub: 'max-chars', optionsMap: { value: 9999 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /max-chars|entre|1.*2000|2000.*1/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).maxChars).toBe(300); // default intact
  });

  it('accepts value 500 and persists', async () => {
    const i = makeConfigInteraction({ sub: 'max-chars', optionsMap: { value: 500 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /500/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).maxChars).toBe(500);
  });

  it('accepts boundary value 1 and persists', async () => {
    const i = makeConfigInteraction({ sub: 'max-chars', optionsMap: { value: 1 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(getGuildConfig(db, GUILD).maxChars).toBe(1);
  });

  it('accepts boundary value 2000 and persists', async () => {
    const i = makeConfigInteraction({ sub: 'max-chars', optionsMap: { value: 2000 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(getGuildConfig(db, GUILD).maxChars).toBe(2000);
  });
});

// ── rate-limit ───────────────────────────────────────────────────────────────

describe('/config rate-limit — range validation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('rejects value 0 with a clear message and does not apply', async () => {
    const i = makeConfigInteraction({ sub: 'rate-limit', optionsMap: { value: 0 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /rate-limit|entre|1.*120|120.*1/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ratePerMin).toBe(8); // default intact
  });

  it('rejects value 121 with a clear message and does not apply', async () => {
    const i = makeConfigInteraction({ sub: 'rate-limit', optionsMap: { value: 121 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /rate-limit|entre|1.*120|120.*1/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ratePerMin).toBe(8);
  });

  it('rejects value 9999 (well above the maximum) and does not persist', async () => {
    const i = makeConfigInteraction({ sub: 'rate-limit', optionsMap: { value: 9999 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /rate-limit|entre|1.*120|120.*1/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ratePerMin).toBe(8); // default intact
  });

  it('accepts value 10 and persists', async () => {
    const i = makeConfigInteraction({ sub: 'rate-limit', optionsMap: { value: 10 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /10/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ratePerMin).toBe(10);
  });

  it('accepts boundary value 1 and persists', async () => {
    const i = makeConfigInteraction({ sub: 'rate-limit', optionsMap: { value: 1 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(getGuildConfig(db, GUILD).ratePerMin).toBe(1);
  });

  it('accepts boundary value 120 and persists', async () => {
    const i = makeConfigInteraction({ sub: 'rate-limit', optionsMap: { value: 120 } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(getGuildConfig(db, GUILD).ratePerMin).toBe(120);
  });
});

// ── tts-channel ──────────────────────────────────────────────────────────────

describe('/config tts-channel — type and access validation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('rejects a voice channel (wrong type) with a clear message', async () => {
    const fakeChannel = { id: 'ch-voice', type: ChannelType.GuildVoice };
    const i = makeConfigInteraction({
      sub: 'tts-channel',
      optionsMap: { channel: fakeChannel },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "Pick a text channel (not a voice channel or a category)."
    expect(
      i.replies.some((r) => /text channel|voice channel|category|texto|voz|categoria/i.test(r)),
    ).toBe(true);
    expect(getGuildConfig(db, GUILD).ttsChannelId).toBeNull();
  });

  it('rejects a text channel without ViewChannel permission', async () => {
    const fakeChannel = { id: 'ch-noaccess', type: ChannelType.GuildText };
    const guild = {
      channels: {
        cache: {
          get: () => ({
            permissionsFor: () => ({ has: () => false }),
          }),
        },
      },
    };
    const i = makeConfigInteraction({
      sub: 'tts-channel',
      optionsMap: { channel: fakeChannel },
      guild,
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /acesso|permiss/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ttsChannelId).toBeNull();
  });

  it('accepts an accessible text channel and persists', async () => {
    const fakeChannel = { id: 'ch-ok', type: ChannelType.GuildText };
    const guild = {
      channels: {
        cache: {
          get: () => ({
            permissionsFor: () => ({ has: () => true }),
          }),
        },
      },
    };
    const i = makeConfigInteraction({
      sub: 'tts-channel',
      optionsMap: { channel: fakeChannel },
      guild,
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /ch-ok/.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ttsChannelId).toBe('ch-ok');
  });
});

// ── role (gating por role) ────────────────────────────────────────────────────

describe('/config role — set and clear', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('sets the ttsRoleId when a role is provided', async () => {
    const fakeRole = { id: 'role-99', name: 'Leitores' };
    const i = makeConfigInteraction({ sub: 'role', optionsMap: { role: fakeRole } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /role-99|restrit/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ttsRoleId).toBe('role-99');
  });

  it('clears the ttsRoleId when the role is omitted', async () => {
    // First set, then clear (role omitted → getRole returns null).
    setGuildConfig(db, GUILD, { ttsRoleId: 'role-99' });
    const i = makeConfigInteraction({ sub: 'role', optionsMap: {} });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /remov|sem restricao|todos/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ttsRoleId).toBeNull();
  });
});

// ── blockword add/remove ─────────────────────────────────────────────────────

describe('/config block-word — empty-word validation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('blockword add: rejects an empty string with a clear message', async () => {
    const i = makeConfigInteraction({
      group: 'block-word',
      sub: 'add',
      optionsMap: { word: '' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "The word can't be empty."
    expect(i.replies.some((r) => /empty|word|vazia|vazio|palavra/i.test(r))).toBe(true);
    expect(getBlocklist(db, GUILD)).toHaveLength(0);
  });

  it('blockword add: rejects a whitespace-only string (after trim)', async () => {
    const i = makeConfigInteraction({
      group: 'block-word',
      sub: 'add',
      optionsMap: { word: '   ' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "The word can't be empty."
    expect(i.replies.some((r) => /empty|word|vazia|vazio|palavra/i.test(r))).toBe(true);
    expect(getBlocklist(db, GUILD)).toHaveLength(0);
  });

  it('blockword add: accepts a valid word, stores it trimmed', async () => {
    const i = makeConfigInteraction({
      group: 'block-word',
      sub: 'add',
      optionsMap: { word: '  spam  ' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /spam/i.test(r))).toBe(true);
    expect(getBlocklist(db, GUILD)).toContain('spam');
    // Does not store with spaces
    expect(getBlocklist(db, GUILD)).not.toContain('  spam  ');
  });

  it('blockword remove: rejects an empty string with a clear message', async () => {
    const i = makeConfigInteraction({
      group: 'block-word',
      sub: 'remove',
      optionsMap: { word: '' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "The word can't be empty."
    expect(i.replies.some((r) => /empty|word|vazia|vazio|palavra/i.test(r))).toBe(true);
  });

  it('blockword remove: accepts a valid word', async () => {
    // Pre-add directly via blocklist so it can then be removed
    const { addBlockword } = await import('../src/store/blocklist.js');
    addBlockword(db, GUILD, 'spam');

    const i = makeConfigInteraction({
      group: 'block-word',
      sub: 'remove',
      optionsMap: { word: 'spam' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "Unblocked: spam."
    expect(i.replies.some((r) => /unblocked/i.test(r))).toBe(true);
    expect(getBlocklist(db, GUILD)).not.toContain('spam');
  });
});

// NB: the /config pronunciation tests were removed with the feature (plan v4) —
// pronunciations are now personal via /pronunciation; see tests/pronunciationUser.test.ts.

// ── enabled (kill-switch) ─────────────────────────────────────────────────────

describe('/config enabled — server kill-switch', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('turns TTS off (enabled=false) and persists', async () => {
    const i = makeConfigInteraction({ sub: 'enabled', optionsMap: { active: false } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "TTS is now **off** for this server."
    expect(i.replies.some((r) => /off|disabled|desativ|deslig/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).enabled).toBe(false);
  });

  it('turns TTS on (enabled=true) and persists', async () => {
    // First turn it off to confirm it turns back on.
    setGuildConfig(db, GUILD, { enabled: false });
    const i = makeConfigInteraction({ sub: 'enabled', optionsMap: { active: true } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Migrated PT->EN (P16.2): "TTS is now **on** for this server."
    expect(i.replies.some((r) => /\bon\b|enabled|ativ|lig/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).enabled).toBe(true);
  });
});

// ── default-voice ─────────────────────────────────────────────────────────────

describe('/config default-voice — validates an available model', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('accepts an available model and persists the guild default_voice', async () => {
    const i = makeConfigInteraction({
      sub: 'default-voice',
      optionsMap: { model: 'pt_PT-tugão-medium' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // Keeps the raw copy-pasteable id in the reply...
    expect(i.replies.some((r) => /pt_PT-tugão-medium/.test(r))).toBe(true);
    // ...and leads with the friendly name of the chosen voice (beginner-friendly).
    expect(i.replies.some((r) => /Português \(Portugal\) — Tugão/.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).defaultVoice).toBe('pt_PT-tugão-medium');
  });

  it('rejects an unknown model with a clear message and does not apply', async () => {
    const i = makeConfigInteraction({
      sub: 'default-voice',
      optionsMap: { model: 'xx_XX-naoexiste' },
    });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(i.replies.some((r) => /desconhecido|list/i.test(r))).toBe(true);
    // the guild default_voice stays empty (not set)
    expect(getGuildConfig(db, GUILD).defaultVoice).toBe('');
  });
});

// ── /config show ──────────────────────────────────────────────────────────────

describe('/config show — shows the current server config', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('shows the stored values (not the defaults)', async () => {
    // Set non-default values to confirm they come from the store, not hard-coded
    setGuildConfig(db, GUILD, {
      ttsChannelId: 'ch-show-test',
      autoread: true,
      ttsRoleId: 'role-show-test',
      enabled: false,
      defaultVoice: 'pt_PT-tugão-medium',
      maxChars: 123,
      ratePerMin: 7,
    });
    addBlockword(db, GUILD, 'spam');
    addBlockword(db, GUILD, 'flood');

    const i = makeConfigInteraction({ sub: 'show' });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);

    const text = i.replies.join('\n');
    expect(text).toMatch(/ch-show-test/);
    // Migrated PT->EN (P16.2): "Auto-read: on" / "Enabled: off"
    expect(text).toMatch(/auto-?read.*on|on.*auto-?read/i);
    expect(text).toMatch(/role-show-test/);
    expect(text).toMatch(/enabled.*off|off.*enabled/i);
    expect(text).toMatch(/pt_PT-tugão-medium/);
    expect(text).toMatch(/123/);
    expect(text).toMatch(/7/);
    expect(text).toMatch(/2/); // 2 words in the blocklist
  });

  it('shows (none) for an unset channel and anyone for an unset role', async () => {
    // No config set — defaults
    const i = makeConfigInteraction({ sub: 'show' });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);

    const text = i.replies.join('\n');
    // Migrated PT->EN (P16.2): channel "(none)", role "anyone", voice "(auto-detect)"
    expect(text).toMatch(/\(none\)|nenhum/i);
    expect(text).toMatch(/anyone|qualquer/i);
    expect(text).toMatch(/auto-?detect|dete/i);
  });

  it('shows auto-detect for an empty defaultVoice', async () => {
    setGuildConfig(db, GUILD, { defaultVoice: '' });
    const i = makeConfigInteraction({ sub: 'show' });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);

    const text = i.replies.join('\n');
    // Migrated PT->EN (P16.2): "(auto-detect)"
    expect(text).toMatch(/auto-?detect|dete/i);
  });
});

// ── /config reset ─────────────────────────────────────────────────────────────

describe('/config reset — restores config to defaults', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('restores the config to defaults after setting non-default values', async () => {
    // Set non-default values
    setGuildConfig(db, GUILD, {
      ttsChannelId: 'ch-reset-test',
      autoread: true,
      ttsRoleId: 'role-reset-test',
      enabled: false,
      defaultVoice: 'pt_PT-tugão-medium',
      maxChars: 999,
      ratePerMin: 42,
    });

    const i = makeConfigInteraction({ sub: 'reset' });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);

    // Clear confirmation reply
    expect(i.replies.some((r) => /reposta|defeito|default/i.test(r))).toBe(true);

    // Config goes back to defaults
    const cfg = getGuildConfig(db, GUILD);
    expect(cfg.ttsChannelId).toBeNull();
    expect(cfg.autoread).toBe(false);
    expect(cfg.ttsRoleId).toBeNull();
    expect(cfg.enabled).toBe(true);
    expect(cfg.defaultVoice).toBe('');
    expect(cfg.maxChars).toBe(300);
    expect(cfg.ratePerMin).toBe(8);
  });

  it('blocklist is kept after reset', async () => {
    // Add data to the blocklist
    addBlockword(db, GUILD, 'spam');
    // Set something non-default to confirm the reset is of the base config
    setGuildConfig(db, GUILD, { maxChars: 999 });

    const i = makeConfigInteraction({ sub: 'reset' });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);

    // Base config restored
    expect(getGuildConfig(db, GUILD).maxChars).toBe(300);
    // Blocklist kept — not destroyed by the reset
    expect(getBlocklist(db, GUILD)).toContain('spam');
  });

  it('reset on a guild with no prior config does not blow up', async () => {
    // No prior setGuildConfig — deleting a row that does not exist is a no-op
    const i = makeConfigInteraction({ sub: 'reset' });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);

    expect(i.replies.some((r) => /reposta|defeito|default/i.test(r))).toBe(true);
    // Getconfig still returns defaults
    expect(getGuildConfig(db, GUILD).maxChars).toBe(300);
  });
});

// ── /config language — switching the interface language ──────────────────────

describe('/config language — switching the interface language', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('set pt: persists locale="pt" and confirms ALREADY in Portuguese', async () => {
    // Guild starts at the default 'en'; a PT confirmation proves the reply comes out
    // in the NEW language (the handler passes `chosen`, not the current locale, to t()).
    const i = makeConfigInteraction({ sub: 'language', optionsMap: { locale: 'pt' } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(getGuildConfig(db, GUILD).locale).toBe('pt');
    // t('config.language.set', 'pt') = "Idioma da interface definido para Português."
    expect(i.replies.join('\n')).toMatch(/idioma da interface/i);
    expect(i.replies.join('\n')).toMatch(/Português/);
    // and NOT the English version
    expect(i.replies.join('\n')).not.toMatch(/interface language set/i);
  });

  it('set en: starting from pt, goes back to en, persists and confirms in English', async () => {
    // Pre-set pt to prove the switch in BOTH directions.
    setGuildConfig(db, GUILD, { locale: 'pt' });
    const i = makeConfigInteraction({ sub: 'language', optionsMap: { locale: 'en' } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    expect(getGuildConfig(db, GUILD).locale).toBe('en');
    // t('config.language.set', 'en') = "Interface language set to English."
    expect(i.replies.join('\n')).toMatch(/interface language set to english/i);
    expect(i.replies.join('\n')).not.toMatch(/idioma da interface/i);
  });

  it('invalid locale: friendly error and does NOT persist (stays at default en)', async () => {
    // 'xx' is not in SUPPORTED_LOCALES — the choices would prevent this in Discord,
    // but the handler's defensive validation has to catch it anyway.
    const i = makeConfigInteraction({ sub: 'language', optionsMap: { locale: 'xx' } });
    const deps = makeConfigDeps(db);
    await handleInteraction(i as any, deps);
    // t('config.language.unsupported', 'en') = "That language isn't supported yet."
    expect(i.replies.join('\n')).toMatch(/isn't supported|not supported|nao e suportado/i);
    // Nothing persisted: still at default 'en'.
    expect(getGuildConfig(db, GUILD).locale).toBe('en');
  });
});

// ── locale wiring: the SAME reply comes out in PT when the guild has locale='pt' ──

describe('/config — locale wiring (PT when locale="pt")', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('EN by default: "reset" replies in English', async () => {
    const i = makeConfigInteraction({ sub: 'reset' });
    await handleInteraction(i as any, makeConfigDeps(db));
    // t('config.reset', 'en') = "Config reset to defaults. …"
    expect(i.replies.join('\n')).toMatch(/reset to defaults/i);
  });

  it('PT: with locale="pt" the same reply comes out in Portuguese', async () => {
    // Proves the wiring: the handler reads getGuildConfig(guildId).locale and passes it to t().
    // 'config.reset' has a `pt` value, so the fallback to `en` does NOT apply —
    // if the locale wiring were broken, `en` would come out and the assert would fail.
    setGuildConfig(db, GUILD, { locale: 'pt' });
    const i = makeConfigInteraction({ sub: 'reset' });
    await handleInteraction(i as any, makeConfigDeps(db));
    // t('config.reset', 'pt') = "Config reposta aos valores por defeito. …"
    expect(i.replies.join('\n')).toMatch(/reposta aos valores por defeito/i);
    // and NOT the English version
    expect(i.replies.join('\n')).not.toMatch(/reset to defaults/i);
  });
});

// ── always-on (24/7 in-call) ──────────────────────────────────────────────────

describe('/config always-on — toggle 24/7 in-call (default OFF)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('default OFF (even without touching anything)', () => {
    expect(getGuildConfig(db, GUILD).stayInCall).toBe(false);
  });

  it('turning on persists stayInCall=true and warns that Premium is required', async () => {
    const i = makeConfigInteraction({ sub: 'always-on', optionsMap: { active: true } });
    await handleInteraction(i as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).stayInCall).toBe(true);
    expect(i.replies.join('\n')).toMatch(/Premium/i);
  });

  it('turning off persists stayInCall=false', async () => {
    setGuildConfig(db, GUILD, { stayInCall: true });
    const i = makeConfigInteraction({ sub: 'always-on', optionsMap: { active: false } });
    await handleInteraction(i as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).stayInCall).toBe(false);
  });
});

// ── streaks (streak announcement 🔥) ─────────────────────────────────────────

describe('/config streaks — streak announcement toggle (default ON)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('default ON (even without touching anything)', () => {
    expect(getGuildConfig(db, GUILD).streakAnnounce).toBe(true);
  });

  it('turning off persists streakAnnounce=false', async () => {
    const i = makeConfigInteraction({ sub: 'streaks', optionsMap: { active: false } });
    await handleInteraction(i as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).streakAnnounce).toBe(false);
  });

  it('turning back on persists streakAnnounce=true', async () => {
    setGuildConfig(db, GUILD, { streakAnnounce: false });
    const i = makeConfigInteraction({ sub: 'streaks', optionsMap: { active: true } });
    await handleInteraction(i as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).streakAnnounce).toBe(true);
  });
});

describe('/config vote-reminders — admin opt-in (default OFF)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('is disabled by default', () => {
    expect(getGuildConfig(db, GUILD).votePromos).toBe(false);
  });

  it('an admin can turn reminders on persistently', async () => {
    const i = makeConfigInteraction({
      sub: 'vote-reminders',
      optionsMap: { active: true },
    });
    await handleInteraction(i as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).votePromos).toBe(true);
    expect(i.replies.join('\n')).toMatch(/Top\.gg/i);
  });

  it('an admin can turn reminders back off', async () => {
    setGuildConfig(db, GUILD, { votePromos: true });
    const i = makeConfigInteraction({
      sub: 'vote-reminders',
      optionsMap: { active: false },
    });
    await handleInteraction(i as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).votePromos).toBe(false);
  });
});

describe('/config queue roles — Manage Server configuration', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('persists and clears the priority role', async () => {
    const set = makeConfigInteraction({
      sub: 'priority-role',
      optionsMap: { role: { id: 'priority' } },
    });
    await handleInteraction(set as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).priorityRoleId).toBe('priority');

    const clear = makeConfigInteraction({ sub: 'priority-role' });
    await handleInteraction(clear as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).priorityRoleId).toBeNull();
  });

  it('persists the blocked role and rejects assigning the same role to both policies', async () => {
    const blocked = makeConfigInteraction({
      sub: 'blocked-role',
      optionsMap: { role: { id: 'blocked' } },
    });
    await handleInteraction(blocked as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).blockedRoleId).toBe('blocked');

    const invalid = makeConfigInteraction({
      sub: 'priority-role',
      optionsMap: { role: { id: 'blocked' } },
    });
    await handleInteraction(invalid as any, makeConfigDeps(db));
    expect(getGuildConfig(db, GUILD).priorityRoleId).toBeNull();
    expect(invalid.replies.join('\n')).toMatch(/different role/i);
  });
});
