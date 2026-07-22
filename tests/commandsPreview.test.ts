import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

// Minimal mock of @discordjs/voice — not used in /voice preview, but the import
// from index.ts resolves it.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setUserVoice } from '../src/store/userVoice';
import { setGuildConfig } from '../src/store/guildConfig';
import type Database from 'better-sqlite3';

const GUILD = 'g-preview';
const USER = 'u-preview';
// Migrated PT->EN (P16.2): the sample phrase spoken by /voice preview now defaults
// to English (t('preview.sample', 'en')).
const SAMPLE = "Hi, I'm Vozen. type it, hear it.";

function makeDeps(db: Database.Database, player?: { say: ReturnType<typeof vi.fn> }): BotDeps {
  const deps = {
    client: { user: { id: 'bot-1' } },
    players: new Map<string, unknown>(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: '' },
    availableModels: ['en_US-amy-medium', 'pt_PT-tugão-medium'],
    limiters: new Map(),
  } as unknown as BotDeps;
  if (player) {
    (deps.players as Map<string, unknown>).set(GUILD, player);
  }
  return deps;
}

function makePreviewInteraction(opts: { model?: string | null } = {}) {
  const replies: string[] = [];
  // model === undefined → option not provided (getString returns null)
  // model === null    → idem (explicitly forced)
  // model === 'xxx'   → option provided with value 'xxx'
  const modelValue = opts.model !== undefined ? opts.model : null;
  return {
    commandName: 'voice',
    guildId: GUILD,
    user: { id: USER },
    guild: {
      members: {
        me: { voice: { channelId: 'vc-preview' } },
        cache: {
          get: (id: string) =>
            id === USER
              ? { voice: { channelId: 'vc-preview' }, roles: { cache: new Map<string, unknown>() } }
              : undefined,
        },
      },
    },
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content: string }) => {
      replies.push(messageText(o));
    },
    options: {
      getSubcommandGroup: (_required = false) => null,
      getSubcommand: () => 'preview',
      getString: (name: string, _required?: boolean) => {
        if (name === 'model') return modelValue;
        return null;
      },
      getNumber: () => null,
    },
  };
}

describe('/voice preview', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('with a valid model calls player.say with the sample phrase and the correct model', async () => {
    // say() returns true (queued) -> the response is "playing a sample".
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makePreviewInteraction({ model: 'pt_PT-tugão-medium' });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.text).toBe(SAMPLE);
    expect(req.model).toBe('pt_PT-tugão-medium');
    // Migrated PT->EN: "Playing a sample…"
    expect(i.replies.some((r) => /sample/i.test(r))).toBe(true);
  });

  it('when say() returns false (queue full) responds "busy", NOT "sample"', async () => {
    // P18.1: queue at cap -> say() resolves false -> the preview responds tts.busy
    // instead of lying "playing a sample".
    const say = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(db, { say });
    const i = makePreviewInteraction({ model: 'en_US-amy-medium' });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    // t('tts.busy', 'en') = "I'm busy right now — try again in a moment."
    expect(i.replies.some((r) => /busy/i.test(r))).toBe(true);
    expect(i.replies.some((r) => /sample/i.test(r))).toBe(false);
  });

  it('invalid model responds with an error message and does NOT call say', async () => {
    const say = vi.fn();
    const deps = makeDeps(db, { say });
    const i = makePreviewInteraction({ model: 'modelo-inexistente' });

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /desconhecido|voice list/i.test(r))).toBe(true);
  });

  it('with no active player responds "use /join" and does NOT call say', async () => {
    const say = vi.fn();
    // deps WITHOUT a player
    const deps = makeDeps(db);
    const i = makePreviewInteraction({ model: 'en_US-amy-medium' });

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /join/i.test(r))).toBe(true);
  });

  it('with no model uses the user saved voice', async () => {
    // Save a specific voice for the user before calling the command.
    setUserVoice(db, GUILD, USER, 'pt_PT-tugão-medium', 1.2);

    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    // model === null → no option provided
    const i = makePreviewInteraction({ model: null });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.text).toBe(SAMPLE);
    expect(req.model).toBe('pt_PT-tugão-medium');
    expect(req.speed).toBe(1.2);
  });

  // ABUSE-03: /voice preview had NO rate-limit — it could be spammed without limit,
  // monopolizing the guild's queue (1 worker) and forcing cache-misses by cycling `model:`.
  // Same pattern as /laugh (getLimiter().allow() before building the SynthRequest).
  it('rate-limit: quick 2nd invocation (ratePerMin:1) responds tts.tooFast and does NOT call say again', async () => {
    setGuildConfig(db, GUILD, { ratePerMin: 1 });
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });

    // 1st invocation: consumes the only token -> plays the sample normally.
    const i1 = makePreviewInteraction({ model: 'en_US-amy-medium' });
    await handleInteraction(i1 as any, deps);
    expect(say).toHaveBeenCalledOnce();

    // 2nd invocation (same user, same minute): limiter blocks BEFORE say.
    const i2 = makePreviewInteraction({ model: 'en_US-amy-medium' });
    await handleInteraction(i2 as any, deps);
    expect(say).toHaveBeenCalledOnce(); // still 1 — the 2nd never got queued
    // t('tts.tooFast', 'en') = "Whoa, slow down a little — try again in a moment."
    expect(i2.replies.some((r) => /slow down/i.test(r))).toBe(true);
  });
});
