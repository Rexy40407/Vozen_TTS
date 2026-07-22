import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

// Minimal mock of @discordjs/voice — not used in the /tts path (the player is
// injected into the deps), but index.ts's import needs to resolve.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import type Database from 'better-sqlite3';

const GUILD = 'g-tts';
const USER = 'u-tts';

function makeDeps(db: Database.Database, player?: { say: ReturnType<typeof vi.fn> }): BotDeps {
  const deps = {
    client: { user: { id: 'bot-1' }, users: { cache: new Map() } },
    players: new Map<string, unknown>(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: '' },
    availableModels: ['en_US-amy-medium'],
    limiters: new Map(),
  } as unknown as BotDeps;
  if (player) {
    (deps.players as Map<string, unknown>).set(GUILD, player);
  }
  return deps;
}

function makeTtsInteraction(
  text: string,
  voice: { callerVoiceChannelId?: string; botVoiceChannelId?: string } = {},
) {
  const replies: string[] = [];
  const callerVoiceChannelId = voice.callerVoiceChannelId ?? 'vc-1';
  const botVoiceChannelId = voice.botVoiceChannelId ?? 'vc-1';
  return {
    commandName: 'tts',
    guildId: GUILD,
    user: { id: USER },
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
    // guild.members.cache / channels.cache used by the cleanText resolver.
    guild: {
      members: {
        cache: new Map([[USER, { voice: { channelId: callerVoiceChannelId } }]]),
        me: { voice: { channelId: botVoiceChannelId } },
      },
      channels: { cache: new Map() },
    },
    options: {
      getString: (name: string, _required?: boolean) => {
        if (name === 'text') return text;
        return null;
      },
      getNumber: () => null,
    },
  };
}

describe('/tts — full say() does not lie "queued"', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('when say() returns true responds "queued"', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('ola mundo');

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    // t('tts.queued', 'en') = "Got it — it's in the queue."
    expect(i.replies.some((r) => /queue/i.test(r))).toBe(true);
    expect(i.replies.some((r) => /busy/i.test(r))).toBe(false);
  });

  it('when say() returns false (queue full) responds "busy", NOT "queued"', async () => {
    const say = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('ola mundo');

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
    // t('tts.busy', 'en') = "I'm busy right now — try again in a moment."
    expect(i.replies.some((r) => /busy/i.test(r))).toBe(true);
    expect(i.replies.some((r) => /queue/i.test(r))).toBe(false);
  });

  it('caller outside Vozen’s voice channel is not synthesized and receives the existing voice guidance', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('ola mundo', {
      callerVoiceChannelId: 'vc-caller',
      botVoiceChannelId: 'vc-bot',
    });

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    expect(i.replies.join('')).toMatch(/voice|call/i);
  });
});

describe('/tts — empty guard (nothing readable -> does not synthesize)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  // ❤️ (U+2764 U+FE0F): before the fix the VS16 survived -> truthy residue passed
  // the `if (!cleaned)` guard -> Piper synthesized an empty clip. Now it is ignored.
  it('only emoji ❤️ (VS16) → nothingAfterClean, does NOT call say', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('❤️');

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    // t('tts.nothingAfterClean', 'en') mentions "nothing"/"read".
    expect(i.replies.some((r) => /nothing|read/i.test(r))).toBe(true);
  });

  it('only flag 🇦🇩 (regional indicators) → does NOT call say', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('🇦🇩');

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
  });

  // Isolates the guard change: cleanText('!!!') = '!!!' (truthy) -> the old guard
  // let it through; the new one requires \p{L}\p{N}.
  it('only punctuation ("!!!") → does NOT call say', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('!!!');

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
  });

  it('text with digits ("$100") → calls say (contains \\p{N})', async () => {
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('$100');

    await handleInteraction(i as any, deps);

    expect(say).toHaveBeenCalledOnce();
  });

  // Beginner-friendly: without a player, the message GUIDES the beginner (join a voice
  // channel AND run /join), instead of just stating the state.
  it('without a player responds with a message that GUIDES to join voice and run /join', async () => {
    const say = vi.fn();
    const deps = makeDeps(db); // sem player
    const i = makeTtsInteraction('Hello everyone!');

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    const text = i.replies.join('\n');
    expect(text).toMatch(/\/join/); // points to the command to run
    expect(text).toMatch(/voice channel/i); // tells to join a voice channel
  });

  // nothingAfterClean should be instructive (say what to do), not just terse.
  it('only emoji → nothingAfterClean asks for readable/normal text', async () => {
    const say = vi.fn();
    const deps = makeDeps(db, { say });
    const i = makeTtsInteraction('❤️');

    await handleInteraction(i as any, deps);

    expect(say).not.toHaveBeenCalled();
    const text = i.replies.join('\n');
    // still mentions "nothing/read" (compat) but now suggests normal text
    expect(text).toMatch(/nothing|read/i);
    expect(text).toMatch(/some text|letters|words|normal/i);
  });
});
