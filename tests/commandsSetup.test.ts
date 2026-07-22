import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';
import { PermissionFlagsBits, ChannelType } from 'discord.js';

// Mock of @discordjs/voice — /setup now JOINS voice (reuses the /join logic) when
// the invoker is in a voice channel with Connect+Speak, so the happy-path tests build
// a REAL GuildVoicePlayer. This mock (copied from commandsJoin.test.ts) provides
// enough for the player constructor: a fake AudioPlayer, a resolved entersState and a
// connection with subscribe/on/destroy.
const joinVoiceChannel = vi.fn();
const getVoiceConnection = vi.fn();
vi.mock('@discordjs/voice', async () => {
  const { EventEmitter } = await import('node:events');
  class FakeAudioPlayer extends EventEmitter {
    play(): void {}
    stop(): void {}
  }
  return {
    joinVoiceChannel: (...args: unknown[]) => joinVoiceChannel(...args),
    getVoiceConnection: (...args: unknown[]) => getVoiceConnection(...args),
    createAudioPlayer: () => new FakeAudioPlayer(),
    createAudioResource: (path: string) => ({ path }),
    entersState: () => Promise.resolve(),
    AudioPlayerStatus: { Idle: 'idle' },
    VoiceConnectionStatus: {
      Disconnected: 'disconnected',
      Signalling: 'signalling',
      Connecting: 'connecting',
      Ready: 'ready',
    },
    StreamType: { Arbitrary: 'arbitrary' },
  };
});

import { handleInteraction, commandDefs } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { getGuildConfig } from '../src/store/guildConfig';
import type Database from 'better-sqlite3';

const GUILD = 'g-setup-test';

// Fake connection returned by joinVoiceChannel — only needs subscribe/on/destroy
// because the real GuildVoicePlayer is built in the handler when /setup joins voice.
// Reset before EACH test (/setup only joins on the happy path).
beforeEach(() => {
  joinVoiceChannel.mockReset();
  getVoiceConnection.mockReset();
  joinVoiceChannel.mockReturnValue({
    subscribe: () => {},
    on: () => {},
    destroy: () => {},
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

function makeSetupDeps(db: Database.Database): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map(),
    db,
    // queueCap is read by GuildVoicePlayer when /setup joins voice successfully.
    config: { queueCap: 10 },
    availableModels: ['en_US-amy-medium'],
  } as unknown as BotDeps;
}

// Builds a "complete" text channel like the one that lives in guild.channels.cache:
// it has .permissionsFor(me) returning { has(flag) }. `granted` is the set of flags
// the bot has in that channel.
function makeTextChannel(id: string, granted: bigint[]): unknown {
  return {
    id,
    type: ChannelType.GuildText,
    permissionsFor: () => ({ has: (flag: bigint) => granted.includes(flag) }),
  };
}

// Voice channel where the invoker is (member.voice.channel). `granted` are the
// bot's flags in that voice channel.
function makeVoiceChannel(id: string, name: string, granted: bigint[]): unknown {
  return {
    id,
    name,
    type: ChannelType.GuildVoice,
    permissionsFor: () => ({ has: (flag: bigint) => granted.includes(flag) }),
  };
}

interface FakeInteraction {
  commandName: string;
  guildId: string;
  replies: string[];
  reply: (opts: {
    content?: string;
    embeds?: { data?: { description?: string } }[];
  }) => Promise<void>;
  isRepliable: () => boolean;
  replied: boolean;
  deferred: boolean;
  member: unknown;
  guild: unknown;
  channel: unknown;
  options: unknown;
}

function makeSetupInteraction(opts: {
  admin?: boolean;
  // channel passed in the "channel" option (partial APIChannel) or null/omitted
  optionChannel?: { id: string } | null;
  // interaction channel (fallback when the option is omitted)
  interactionChannel?: unknown;
  // voice channel where the invoker is (or null if not in voice)
  voiceChannel?: unknown;
  // "complete" channels indexed by id (simulates guild.channels.cache)
  guildChannels?: Record<string, unknown>;
  testVoice?: boolean;
}): FakeInteraction {
  const replies: string[] = [];
  const admin = opts.admin ?? true;
  const cache = opts.guildChannels ?? {};
  return {
    commandName: 'setup',
    guildId: GUILD,
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content?: string; embeds?: { data?: { description?: string } }[] }) => {
      // /setup now uses an embed — record text OR the embed's description.
      const fromEmbeds = (o.embeds ?? []).map((e) => e?.data?.description ?? '').join('\n');
      replies.push(messageText(o) || fromEmbeds);
    },
    member: {
      permissions: { has: () => admin },
      voice: { channel: opts.voiceChannel ?? null },
    },
    guild: {
      // voiceAdapterCreator is used by joinVoiceChannel when /setup joins voice
      // on the happy path.
      voiceAdapterCreator: {},
      channels: {
        cache: { get: (id: string) => cache[id] },
      },
    },
    channel: opts.interactionChannel ?? null,
    options: {
      getChannel: (_name: string) => opts.optionChannel ?? null,
      getBoolean: (name: string) => (name === 'test-voice' ? (opts.testVoice ?? false) : null),
    },
  };
}

// ── (a) all present + invoker in VC → success ─────────────────────────────────

describe('/setup — happy path (all perms + in VC)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('saves ttsChannelId + autoread and replies success', async () => {
    const textCh = makeTextChannel('ch-text', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const i = makeSetupInteraction({
      interactionChannel: textCh,
      guildChannels: { 'ch-text': textCh },
      voiceChannel: makeVoiceChannel('vc-1', 'Sala', [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ]),
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    const cfg = getGuildConfig(db, GUILD);
    expect(cfg.ttsChannelId).toBe('ch-text');
    expect(cfg.autoread).toBe(true);

    const text = i.replies.join('\n');
    expect(text).toMatch(/ch-text/); // mentions the target channel
    // Migrado PT->EN (P16.2): "Auto-read: on"
    expect(text).toMatch(/auto-?read|auto-?leitura/i);
    // checklist with OK marks (no "missing"/"falta" on the three perms)
    expect(text).toMatch(/ViewChannel/i);
    expect(text).toMatch(/Connect/i);
    expect(text).toMatch(/Speak/i);
    expect(text).not.toMatch(/missing|falta/i);

    // /setup now JOINS voice already on the happy path (reuses the /join logic):
    // confirm it joined and clean up the player so it doesn't leave timers behind.
    expect(joinVoiceChannel).toHaveBeenCalledTimes(1);
    expect(text).toMatch(/Sala/); // mentions the voice channel it joined

    // ONBOARDING (beginner-friendly): /setup must tell the MEMBERS the next step
    // (not just the admin) — the 3-step flow join voice -> /join -> type.
    // We assert the distinctive markers of that "members guide".
    expect(text).toMatch(/members|membros/i); // section dedicated to members
    expect(text).toMatch(/\/join/i);
    // mentions "type"/"escrever" as the final step for members
    expect(text).toMatch(/type|escrev/i);

    deps.players.get(GUILD)?.destroy();
  });

  it('queues a short local voice diagnostic only when test-voice is requested', async () => {
    const textCh = makeTextChannel('ch-text', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const i = makeSetupInteraction({
      interactionChannel: textCh,
      guildChannels: { 'ch-text': textCh },
      voiceChannel: makeVoiceChannel('vc-1', 'Voice', [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ]),
      testVoice: true,
    });
    const deps = makeSetupDeps(db);
    deps.engine = { synth: vi.fn(async () => 'voice-test.wav') };

    await handleInteraction(i as any, deps);

    await vi.waitFor(() => expect(deps.engine.synth).toHaveBeenCalledOnce());
    expect(deps.engine.synth).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Vozen is ready.', engine: 'piper' }),
    );
    expect(i.replies.join('\n')).toContain('Voice test queued');
    deps.players.get(GUILD)?.destroy();
  });
});

// ── (b) Connect/Speak missing → warns BUT saves channel+autoread ─────────────

describe('/setup — voice perms missing', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('lists what is missing but saves channel+autoread anyway', async () => {
    const textCh = makeTextChannel('ch-text', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const i = makeSetupInteraction({
      interactionChannel: textCh,
      guildChannels: { 'ch-text': textCh },
      // bot has neither Connect nor Speak in the invoker's voice channel
      voiceChannel: makeVoiceChannel('vc-1', 'Sala', []),
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    // Config saved despite the missing voice perms
    const cfg = getGuildConfig(db, GUILD);
    expect(cfg.ttsChannelId).toBe('ch-text');
    expect(cfg.autoread).toBe(true);

    const text = i.replies.join('\n');
    // Migrado PT->EN (P16.2): "❌ {label} — missing"
    expect(text).toMatch(/missing/i); // reports what is missing
    // Assert the MISSING MARKER next to each label (the label appearing is not enough:
    // it is printed in any state). `[^\n]*` confines it to one line.
    expect(text).toMatch(/❌[^\n]*Connect|Connect[^\n]*missing/i);
    expect(text).toMatch(/❌[^\n]*Speak|Speak[^\n]*missing/i);

    // RECONCILIATION /setup vs /join: without Connect/Speak, /setup must NOT join
    // voice (only warns in the checklist). If the 'ok && ok' guard regressed and setup
    // always joined, this would catch it.
    expect(joinVoiceChannel).not.toHaveBeenCalled();
    expect(deps.players.get(GUILD)).toBeUndefined();
  });
});

// ── (b2) SendMessages missing in the text channel → warns BUT saves ──────────

describe('/setup — SendMessages missing in the text channel', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('marks the text perm as missing but saves channel+autoread', async () => {
    // ViewChannel present, SendMessages absent: each text perm has its own checklist
    // line (contract 3a). It saves anyway (minimum-friction policy). This is the case
    // that proves P8.1's precision: only SendMessages may appear missing — ViewChannel
    // must NOT be marked wrongly.
    const textCh = makeTextChannel('ch-text', [PermissionFlagsBits.ViewChannel]);
    const i = makeSetupInteraction({
      interactionChannel: textCh,
      guildChannels: { 'ch-text': textCh },
      voiceChannel: makeVoiceChannel('vc-1', 'Sala', [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ]),
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    // Saved despite the missing text perm
    const cfg = getGuildConfig(db, GUILD);
    expect(cfg.ttsChannelId).toBe('ch-text');
    expect(cfg.autoread).toBe(true);

    // Checklist reports SendMessages as missing — and ViewChannel NOT missing.
    // `[^\n]*` confines the match to one line: if ViewChannel regressed to
    // "❌ ViewChannel — falta", there would be no ✅ before ViewChannel on that line and
    // the assert would fail (this is the real regression guard of P8.1).
    const text = i.replies.join('\n');
    // Migrado PT->EN (P16.2): "❌ {label} — missing"
    expect(text).toMatch(/missing/i);
    expect(text).toMatch(/❌[^\n]*SendMessages|SendMessages[^\n]*missing/i);
    expect(text).toMatch(/✅[^\n]*ViewChannel/i);

    // Connect+Speak present in voice -> /setup joined; clean up the player.
    deps.players.get(GUILD)?.destroy();
  });
});

// ── (c) invoker NOT in VC → saves + notes that voice was not checked ──────────

describe('/setup — invoker outside a voice channel', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('saves channel+autoread and notes that voice will be checked on /join', async () => {
    const textCh = makeTextChannel('ch-text', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const i = makeSetupInteraction({
      interactionChannel: textCh,
      guildChannels: { 'ch-text': textCh },
      voiceChannel: null, // not in voice
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    const cfg = getGuildConfig(db, GUILD);
    expect(cfg.ttsChannelId).toBe('ch-text');
    expect(cfg.autoread).toBe(true);

    const text = i.replies.join('\n');
    // "not checked" state (not "missing"): mentions /join
    // Migrado PT->EN (P16.2): "… not checked yet (I'll verify it on /join)"
    expect(text).toMatch(/\/join/i);
    expect(text).toMatch(/verify|checked/i);

    // RECONCILIATION /setup vs /join: outside a voice channel there is no way to check
    // Connect/Speak, so /setup does NOT join (leaves that to /join).
    expect(joinVoiceChannel).not.toHaveBeenCalled();
    expect(deps.players.get(GUILD)).toBeUndefined();
  });
});

// ── (d) "channel" option used → uses that channel, not the interaction's ─────

describe('/setup — explicit channel option', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('uses the option channel (resolved via cache) and ignores the interaction one', async () => {
    // the option channel arrives as a partial (id only); the complete channel comes from the cache
    const fullOptCh = makeTextChannel('ch-option', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const interactionCh = makeTextChannel('ch-interaction', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const i = makeSetupInteraction({
      optionChannel: { id: 'ch-option' },
      interactionChannel: interactionCh,
      guildChannels: { 'ch-option': fullOptCh, 'ch-interaction': interactionCh },
      voiceChannel: makeVoiceChannel('vc-1', 'Sala', [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ]),
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    expect(getGuildConfig(db, GUILD).ttsChannelId).toBe('ch-option');
    expect(i.replies.join('\n')).toMatch(/ch-option/);
    expect(i.replies.join('\n')).not.toMatch(/ch-interaction/);

    // Invoker in voice with Connect+Speak -> /setup also joined; clean up player.
    deps.players.get(GUILD)?.destroy();
  });
});

// ── (e) target channel is not text → clear error, no crash, no save ──────────

describe('/setup — target channel is not text', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('rejects with a clear message and saves nothing', async () => {
    const voiceAsTarget = {
      id: 'ch-voice',
      type: ChannelType.GuildVoice,
      permissionsFor: () => ({ has: () => true }),
    };
    const i = makeSetupInteraction({
      interactionChannel: voiceAsTarget,
      guildChannels: { 'ch-voice': voiceAsTarget },
      voiceChannel: null,
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    // Migrado PT->EN (P16.2): "… has to be a text channel …"
    expect(i.replies.some((r) => /text channel|texto/i.test(r))).toBe(true);
    // nothing saved
    expect(getGuildConfig(db, GUILD).ttsChannelId).toBeNull();
    expect(getGuildConfig(db, GUILD).autoread).toBe(false);
  });

  it('does not blow up when there is no channel at all (option omitted and no interaction channel)', async () => {
    const i = makeSetupInteraction({
      interactionChannel: null,
      voiceChannel: null,
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    expect(i.replies.length).toBeGreaterThan(0);
    // the handler's real message: asks to indicate a text channel
    // Migrado PT->EN (P16.2): "I couldn't tell which channel to use. …"
    expect(i.replies.join('\n')).toMatch(/which channel|text channel|canal de texto/i);
    // nothing saved: neither channel nor autoread
    expect(getGuildConfig(db, GUILD).ttsChannelId).toBeNull();
    expect(getGuildConfig(db, GUILD).autoread).toBe(false);
  });
});

// ── (f) non-admin → rejected by the in-handler guard, no save ────────────────

describe('/setup — admin gating', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('rejects non-admin and does not save config', async () => {
    const textCh = makeTextChannel('ch-text', [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    const i = makeSetupInteraction({
      admin: false,
      interactionChannel: textCh,
      guildChannels: { 'ch-text': textCh },
      voiceChannel: makeVoiceChannel('vc-1', 'Sala', [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ]),
    });
    const deps = makeSetupDeps(db);
    await handleInteraction(i as any, deps);

    expect(i.replies.some((r) => /Gerir Servidor|permiss/i.test(r))).toBe(true);
    expect(getGuildConfig(db, GUILD).ttsChannelId).toBeNull();
    expect(getGuildConfig(db, GUILD).autoread).toBe(false);
  });
});

// ── command registration ──────────────────────────────────────────────────────

describe('/setup — command definition', () => {
  it('is registered in commandDefs as a top-level admin-only command', () => {
    const def = commandDefs.find((c) => c.name === 'setup');
    expect(def).toBeDefined();
    // ManageGuild = bit 0x20 = "32" (string) no campo default_member_permissions
    expect(def?.default_member_permissions).toBe(PermissionFlagsBits.ManageGuild.toString());
  });

  it('has an optional "channel" (English) option of type text channel', () => {
    const def = commandDefs.find((c) => c.name === 'setup');
    const opt = def?.options?.find((o) => o.name === 'channel');
    expect(opt).toBeDefined();
    expect(opt?.required ?? false).toBe(false);
    // Commands/options are ONLY in ENGLISH for everyone: the pt-BR name_localizations
    // were REMOVED (otherwise a Portuguese Discord client would see "/cala-te", "canal"…).
    // The localization of the bot's REPLIES (t()/i18n) remains intact — this is just the name.
    expect(opt?.name).toBe('channel');
    expect(opt?.name_localizations).toBeUndefined();
  });

  it('has an optional test-voice diagnostic toggle', () => {
    const def = commandDefs.find((c) => c.name === 'setup');
    const opt = def?.options?.find((o) => o.name === 'test-voice');
    expect(opt?.type).toBe(5);
    expect(opt?.required ?? false).toBe(false);
  });
});
