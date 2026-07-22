import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

// Mock minimo de @discordjs/voice — nao e usado no caminho do /laugh (o player e
// injectado nas deps), mas o import de index.ts precisa de resolver.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setUserVoice } from '../src/store/userVoice';
import { setGuildConfig } from '../src/store/guildConfig';
import { laughterFor } from '../src/content/laughter';
import type Database from 'better-sqlite3';

const GUILD = 'g-laugh';
const USER = 'u-laugh';

const CYRILLIC = /[Ѐ-ӿ]/;

function makeDeps(
  db: Database.Database,
  player?: { say: ReturnType<typeof vi.fn> },
  overrides?: Partial<{ defaultVoice: string; availableModels: string[] }>,
): BotDeps {
  const deps = {
    client: { user: { id: 'bot-1' } },
    players: new Map<string, unknown>(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: overrides?.defaultVoice ?? 'en_US-amy-medium' },
    availableModels: overrides?.availableModels ?? ['en_US-amy-medium', 'ru_RU-dmitri-medium'],
    limiters: new Map(),
  } as unknown as BotDeps;
  if (player) {
    (deps.players as Map<string, unknown>).set(GUILD, player);
  }
  return deps;
}

function makeLaughInteraction() {
  const replies: string[] = [];
  return {
    commandName: 'laugh',
    guildId: GUILD,
    user: { id: USER },
    guild: {
      members: {
        me: { voice: { channelId: 'vc-1' } },
        cache: new Map([[USER, { voice: { channelId: 'vc-1' } }]]),
      },
    },
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    deferReply: async function (this: { deferred: boolean }) {
      this.deferred = true;
    },
    editReply: async (o: string | { content: string }) => {
      replies.push(messageText(o));
    },
    options: {
      getSubcommandGroup: (_r = false) => null,
      getSubcommand: () => {
        throw new Error('no subcommand');
      },
      getString: () => null,
      getNumber: () => null,
      getBoolean: () => null,
    },
  };
}

describe('/laugh', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('sem player ativo responde "join" e NAO chama say', async () => {
    const say = vi.fn();
    const deps = makeDeps(db); // sem player
    const i = makeLaughInteraction();

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /join/i.test(r))).toBe(true);
  });

  it('usa a voz GUARDADA do utilizador e envia o riso dessa lingua', async () => {
    // Utilizador com voz russa guardada -> o riso tem de sair em Cirilico e o
    // model do say() tem de ser exatamente a voz guardada.
    setUserVoice(db, GUILD, USER, 'ru_RU-dmitri-medium', 1.3);

    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeLaughInteraction();

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.model).toBe('ru_RU-dmitri-medium');
    expect(req.speed).toBe(1.3);
    expect(req.text).toBe(laughterFor('ru_'));
    expect(req.text).toMatch(CYRILLIC);
  });

  it('sem voz de user nem default de guild usa config.defaultVoice (.env)', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say }, { defaultVoice: 'en_US-amy-medium' });
    const i = makeLaughInteraction();

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.model).toBe('en_US-amy-medium');
    expect(req.text).toBe(laughterFor('en_'));
  });

  it('usa a default_voice da guild quando o user nao tem voz propria', async () => {
    setGuildConfig(db, GUILD, { defaultVoice: 'ru_RU-dmitri-medium' });

    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeLaughInteraction();

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.model).toBe('ru_RU-dmitri-medium');
    expect(req.text).toMatch(CYRILLIC);
  });

  it('quando say() devolve false (fila cheia) responde "busy"', async () => {
    const say = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(db, { say });
    const i = makeLaughInteraction();

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    expect(i.replies.some((r) => /busy/i.test(r))).toBe(true);
  });

  // ── rate-limit por-utilizador (mesmo limiter do /tts) ───────────────────────
  // ratePerMin=0 -> RateLimiter.allow devolve sempre false. Sem o guard, o /laugh
  // enfileirava sem limite (vetor de spam da fila de voz). Com o guard, responde
  // tts.tooFast e NAO chama say.
  it('quando o limiter nega responde tts.tooFast e NAO chama say', async () => {
    setGuildConfig(db, GUILD, { ratePerMin: 0 });
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeLaughInteraction();

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    // t('tts.tooFast', 'en') = "Whoa, slow down a little — try again in a moment."
    expect(i.replies.some((r) => /slow down/i.test(r))).toBe(true);
  });
});
