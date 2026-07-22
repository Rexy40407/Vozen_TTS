import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction, handleAutocomplete, filterJokeLanguages } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { setUserVoice } from '../src/store/userVoice';
import { laughterFor } from '../src/content/laughter';
import { JOKE_LANGUAGES } from '../src/content/jokes';
import type Database from 'better-sqlite3';

const GUILD = 'g-joke';
const USER = 'u-joke';

const CYRILLIC = /[Ѐ-ӿ]/;

function makeDeps(
  db: Database.Database,
  player?: { say: ReturnType<typeof vi.fn> },
  availableModels?: string[],
): BotDeps {
  const deps = {
    client: { user: { id: 'bot-1' } },
    players: new Map<string, unknown>(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: 'en_US-amy-medium' },
    availableModels: availableModels ?? [
      'en_US-amy-medium',
      'ru_RU-dmitri-medium',
      'fr_FR-siwis-medium',
    ],
    limiters: new Map(),
  } as unknown as BotDeps;
  if (player) {
    (deps.players as Map<string, unknown>).set(GUILD, player);
  }
  return deps;
}

function makeJokeInteraction(opts: { idioma: string | null; risos: boolean | null }) {
  const replies: string[] = [];
  return {
    commandName: 'joke',
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
      getString: (name: string, _req?: boolean) => (name === 'language' ? opts.idioma : null),
      getBoolean: (name: string, _req?: boolean) => (name === 'laughter' ? opts.risos : null),
      getNumber: () => null,
    },
  };
}

describe('/joke', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('with no active player responds "join" and does NOT call say', async () => {
    const say = vi.fn();
    const deps = makeDeps(db); // no player
    const i = makeJokeInteraction({ idioma: 'en', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /join/i.test(r))).toBe(true);
  });

  it('unknown language responds with an error and does NOT call say', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'xx-nao-existe', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    expect(i.replies.length).toBeGreaterThan(0);
  });

  it('picks the voice whose model matches the chosen language prefix', async () => {
    // Russian language -> the model must start with 'ru_', and the joke in Cyrillic.
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'ru', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.model.startsWith('ru_')).toBe(true);
    expect(req.text).toMatch(CYRILLIC);
  });

  it('laughter:true enqueues TWO utterances: the joke, then the laugh with a pause (leadSilenceMs:1000)', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'ru', risos: true });

    await handleInteraction(i as any, deps);

    // Two separate utterances: the joke (immediate) and the laugh (with 1s of silence in front).
    expect(say).toHaveBeenCalledTimes(2);

    // 1st utterance: ONLY the joke, WITHOUT laugh and WITHOUT leadSilenceMs.
    const jokeReq = say.mock.calls[0][0];
    expect(jokeReq.text.endsWith(laughterFor('ru_'))).toBe(false);
    expect(jokeReq.leadSilenceMs).toBeUndefined();

    // 2nd utterance: the language's laugh, with 1000ms of silence in front (the real pause).
    const laughReq = say.mock.calls[1][0];
    expect(laughReq.text).toBe(laughterFor('ru_'));
    expect(laughReq.leadSilenceMs).toBe(1000);
    // Same voice as the joke.
    expect(laughReq.model).toBe(jokeReq.model);
  });

  it('laughter:false enqueues just ONE utterance: the joke, without laugh', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'en', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.text.endsWith(laughterFor('en_'))).toBe(false);
    expect(req.leadSilenceMs).toBeUndefined();
  });

  it('laughter:true with a full queue (say false on the joke): does NOT enqueue the laugh and responds busy', async () => {
    // The joke did not enter the queue (cap) -> no point enqueuing the laugh. Just one
    // call to say, and the response is busy (not "playing").
    const say = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'ru', risos: true });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    expect(i.replies.some((r) => /busy/i.test(r))).toBe(true);
  });

  it('with no model installed for the language falls back to the default (.env)', async () => {
    // availableModels without 'ka_' -> the voice falls back to config.defaultVoice.
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say }, ['en_US-amy-medium']);
    const i = makeJokeInteraction({ idioma: 'ka', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.model).toBe('en_US-amy-medium');
  });

  it('say() false (full queue) responds "busy"', async () => {
    const say = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'en', risos: false });

    await handleInteraction(i as any, deps);

    expect(i.replies.some((r) => /busy/i.test(r))).toBe(true);
  });

  // ── per-user rate-limit (same limiter as /tts) ───────────────────────
  // ratePerMin=0 -> RateLimiter.allow always returns false. Without the guard, /joke
  // would enqueue without limit (voice-queue spam vector). VALID language ('en')
  // so the test fails because of the limiter and not because of unknownLang.
  it('when the limiter denies, responds tts.tooFast and does NOT call say', async () => {
    setGuildConfig(db, GUILD, { ratePerMin: 0 });
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'en', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    // t('tts.tooFast', 'en') = "Whoa, slow down a little — try again in a moment."
    expect(i.replies.some((r) => /slow down/i.test(r))).toBe(true);
  });
});

describe('filterJokeLanguages (language autocomplete)', () => {
  it('filters by substring of the English display name', () => {
    const out = filterJokeLanguages('russ');
    expect(out).toEqual([{ name: 'Russian', value: 'ru' }]);
  });

  it('is case-insensitive and ignores spaces', () => {
    expect(filterJokeLanguages('  ARAB ')).toEqual([{ name: 'Arabic', value: 'ar' }]);
  });

  it('empty query returns at most 25 (Discord cap), even though there are 34 languages', () => {
    expect(JOKE_LANGUAGES.length).toBeGreaterThan(25);
    expect(filterJokeLanguages('').length).toBe(25);
  });

  it('query with no match returns []', () => {
    expect(filterJokeLanguages('zzzz')).toEqual([]);
  });
});

// Bug-hunt 2026-07: /joke built the SynthRequest WITHOUT `engine`, so a Piper user
// heard the jokes on Google (unlike /laugh and /voice preview, which follow the
// chosen engine). The MODEL follows the language; the ENGINE must follow the user.
describe('/joke — follows the ENGINE chosen by the user (google/piper)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('user with engine:piper -> the joke AND the laugh are synthesized with engine:piper', async () => {
    setUserVoice(db, GUILD, USER, 'en_US-amy-medium', 1.0, 'piper');
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'en', risos: true });

    await handleInteraction(i as any, deps);

    // Two utterances: joke + laugh. Both with engine:piper.
    expect(say).toHaveBeenCalledTimes(2);
    for (const call of say.mock.calls) {
      expect(call[0].engine).toBe('piper');
    }
  });

  it('default user (no choice) -> engine undefined (= Google), unchanged behavior', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeJokeInteraction({ idioma: 'en', risos: false });

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].engine).toBeUndefined();
  });
});

describe('handleAutocomplete — language', () => {
  const deps = { availableModels: ['en_US-amy-medium'] } as any;

  it('focused "language" option: responds with the filtered languages', async () => {
    const respond = vi.fn();
    const i = {
      options: { getFocused: () => ({ name: 'language', value: 'french' }) },
      respond,
    } as any;
    await handleAutocomplete(i, deps);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith([{ name: 'French', value: 'fr' }]);
  });
});
