import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction, handleAutocomplete } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { setUserVoice } from '../src/store/userVoice';
import { grantGuildPremium } from '../src/store/premium';
import type Database from 'better-sqlite3';

const GUILD = 'g-rizz';
const USER = 'u-rizz';
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
  if (player) (deps.players as Map<string, unknown>).set(GUILD, player);
  return deps;
}

function makeRizzInteraction(opts: { language: string | null; sound: boolean | null }) {
  const replies: string[] = [];
  return {
    commandName: 'rizz',
    guildId: GUILD,
    user: { id: USER },
    guild: {
      members: {
        me: { voice: { channelId: 'vc-1' } },
        cache: new Map([[USER, { voice: { channelId: 'vc-1' } }]]),
      },
    },
    replies,
    deferReply: async () => {},
    editReply: async (o: string | { content: string }) => {
      replies.push(messageText(o));
    },
    options: {
      getSubcommandGroup: () => null,
      getString: (name: string) => (name === 'language' ? opts.language : null),
      getBoolean: (name: string) => (name === 'sound' ? opts.sound : null),
      getNumber: () => null,
    },
  };
}

describe('/rizz', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
    // /rizz is Premium — most tests exercise the happy path, so the
    // server has Premium by default. The gate test removes it.
    grantGuildPremium(db, GUILD, 30, 'test', Date.now());
  });
  afterEach(() => {
    db.close();
  });

  it('without Premium (neither Plus nor server Premium) -> responds locked and does NOT call say', async () => {
    db.prepare('DELETE FROM premium_guild WHERE guild_id = ?').run(GUILD);
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'en', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /Premium/i.test(r))).toBe(true);
  });

  it('with no active player responds "join" and does NOT call say', async () => {
    const say = vi.fn();
    const i = makeRizzInteraction({ language: 'en', sound: false });
    await handleInteraction(i as any, makeDeps(db));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /join/i.test(r))).toBe(true);
  });

  it('unknown language responds with an error and does NOT call say', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'xx-nao-existe', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.length).toBeGreaterThan(0);
  });

  it('picks the voice by the language prefix and speaks the phrase in that language (ru -> Cyrillic)', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'ru', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).toHaveBeenCalledOnce();
    const req = say.mock.calls[0][0];
    expect(req.model.startsWith('ru_')).toBe(true);
    expect(req.text).toMatch(CYRILLIC);
  });

  it('sound:true enqueues TWO utterances: the phrase, then the sound effect (assetPath)', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'en', sound: true });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).toHaveBeenCalledTimes(2);
    // 1st utterance: the pick-up line, without assetPath.
    expect(say.mock.calls[0][0].assetPath).toBeUndefined();
    expect(say.mock.calls[0][0].text.length).toBeGreaterThan(0);
    // 2nd utterance: the sound effect — assetPath points to rizz.wav and the text is empty.
    const sfx = say.mock.calls[1][0];
    expect(String(sfx.assetPath)).toMatch(/rizz\.wav$/);
    expect(sfx.text).toBe('');
  });

  it('sound:false enqueues just ONE utterance (without sound effect)', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'en', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).toHaveBeenCalledOnce();
    expect(say.mock.calls[0][0].assetPath).toBeUndefined();
  });

  it('sound:true with a full queue (say false): does NOT enqueue the effect and responds busy', async () => {
    const say = vi.fn().mockResolvedValue(false);
    const i = makeRizzInteraction({ language: 'ru', sound: true });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).toHaveBeenCalledOnce();
    expect(i.replies.some((r) => /busy/i.test(r))).toBe(true);
  });

  it('with no model installed for the language falls back to the default (.env)', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'ka', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }, ['en_US-amy-medium']));
    expect(say.mock.calls[0][0].model).toBe('en_US-amy-medium');
  });

  it('follows the ENGINE chosen by the user (engine:piper)', async () => {
    setUserVoice(db, GUILD, USER, 'en_US-amy-medium', 1.0, 'piper');
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'en', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say.mock.calls[0][0].engine).toBe('piper');
  });

  it('when the limiter denies, responds tts.tooFast and does NOT call say', async () => {
    setGuildConfig(db, GUILD, { ratePerMin: 0 });
    const say = vi.fn().mockResolvedValue(true);
    const i = makeRizzInteraction({ language: 'en', sound: false });
    await handleInteraction(i as any, makeDeps(db, { say }));
    expect(say).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /slow down/i.test(r))).toBe(true);
  });
});

describe('/rizz — language autocomplete (reuses the /joke one)', () => {
  it('the /rizz "language" option responds with the filtered languages', async () => {
    const respond = vi.fn();
    const i = {
      commandName: 'rizz',
      options: { getFocused: () => ({ name: 'language', value: 'french' }) },
      respond,
    } as any;
    await handleAutocomplete(i, { availableModels: ['en_US-amy-medium'] } as any);
    expect(respond).toHaveBeenCalledWith([{ name: 'French', value: 'fr' }]);
  });
});
