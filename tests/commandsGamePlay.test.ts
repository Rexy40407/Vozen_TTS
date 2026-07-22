import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageText } from './messagePayload';

// Minimal mock of @discordjs/voice — /game play doesn't touch voice here (tictactoe is
// needsVoice:false), but the commands module imports it at the top.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { grantGuildPremium } from '../src/store/premium';
import type Database from 'better-sqlite3';

const GUILD = 'g-gameplay-test';

function makeDeps(db: Database.Database, games: unknown): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, channels: { cache: new Map(), fetch: async () => null } },
    players: new Map(),
    db,
    config: {},
    availableModels: ['en_US-amy-medium'],
    games,
  } as unknown as BotDeps;
}

/** Fake /game play interaction with deferReply/editReply and an ordering log. */
function makePlayInteraction(opts: { gameId?: string; channel?: unknown; calls?: string[] }) {
  const calls = opts.calls ?? [];
  const edits: string[] = [];
  const self = {
    commandName: 'game',
    guildId: GUILD,
    channelId: 'chan-1',
    channel: opts.channel ?? null,
    user: { id: 'u-1' },
    client: { channels: { cache: new Map(), fetch: async () => null } },
    calls,
    edits,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    deferReply: async () => {
      calls.push('defer');
      self.deferred = true;
    },
    editReply: async (content: unknown) => {
      calls.push('edit');
      edits.push(messageText(content));
    },
    reply: async () => {
      calls.push('reply'); // the play branch must NOT use this after the fix
    },
    options: {
      getSubcommand: () => 'play',
      getSubcommandGroup: () => null,
      getString: (name: string) => (name === 'game' ? (opts.gameId ?? 'tictactoe') : null),
    },
  };
  return self;
}

describe('/game play — deferReply before the REST + responses via editReply', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('happy path with thread: defer BEFORE createThread, success via editReply', async () => {
    const calls: string[] = [];
    const channel = {
      type: 0, // GuildText
      threads: {
        create: async () => {
          calls.push('createThread');
          return { id: 'thread-1' };
        },
      },
    };
    const games = { active: () => false, channelOf: () => null, start: () => 'started' };
    const i = makePlayInteraction({ channel, calls });
    await handleInteraction(i as any, makeDeps(db, games));

    // The ack (defer) must come BEFORE the REST call that creates the thread — that was the bug.
    expect(calls[0]).toBe('defer');
    expect(calls.indexOf('defer')).toBeLessThan(calls.indexOf('createThread'));
    expect(i.deferred).toBe(true);
    expect(i.edits.length).toBe(1);
    expect(calls).not.toContain('reply'); // never uses i.reply after the defer
  });

  it('already-active responds via editReply (without i.reply)', async () => {
    const games = { active: () => true, channelOf: () => 'chan-9', start: () => 'started' };
    const i = makePlayInteraction({
      channel: { type: 0, threads: { create: async () => ({ id: 't' }) } },
    });
    await handleInteraction(i as any, makeDeps(db, games));
    expect(i.edits.length).toBe(1);
    expect(i.edits[0].length).toBeGreaterThan(0);
    expect(i.calls).not.toContain('reply');
  });

  it('without a thread (voice channel) plays in the channel itself and responds via editReply', async () => {
    // Typed params (guildId, channelId, ...) so the typecheck can read calls[0][1].
    const start = vi.fn(
      (_guildId: string, _channelId: string, ..._rest: unknown[]) => 'started' as const,
    );
    const games = { active: () => false, channelOf: () => null, start };
    // type:2 = GuildVoice -> createGameThread returns null -> plays in chan-1
    const i = makePlayInteraction({ channel: { type: 2 } });
    await handleInteraction(i as any, makeDeps(db, games));
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1]).toBe('chan-1'); // gameChannelId = invoking channel
    expect(i.edits.length).toBe(1);
    expect(i.calls).not.toContain('reply');
  });

  it('unknown game responds via editReply (converted early-return)', async () => {
    const games = { active: () => false, channelOf: () => null, start: () => 'started' };
    const i = makePlayInteraction({ gameId: 'nope', channel: { type: 0 } });
    await handleInteraction(i as any, makeDeps(db, games));
    expect(i.edits.length).toBe(1);
    expect(i.calls).not.toContain('reply');
  });
});

describe('/game play — Premium gate (wordle, word-chain, chess)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  const freeGames = () => {
    const start = vi.fn((_g: string, _c: string, ..._r: unknown[]) => 'started' as const);
    return { games: { active: () => false, channelOf: () => null, start }, start };
  };

  for (const gameId of ['wordle', 'word-chain']) {
    it(`Premium game (${gameId}) WITHOUT Premium -> responds locked and does NOT start`, async () => {
      const { games, start } = freeGames();
      const i = makePlayInteraction({ gameId, channel: { type: 0 } });
      await handleInteraction(i as any, makeDeps(db, games));
      expect(start).not.toHaveBeenCalled();
      expect(i.edits.length).toBe(1);
      expect(/Premium/i.test(i.edits[0])).toBe(true);
    });
  }

  it('Premium game (wordle) WITH server Premium -> starts', async () => {
    grantGuildPremium(db, GUILD, 30, 'test', Date.now());
    const { games, start } = freeGames();
    const i = makePlayInteraction({ gameId: 'wordle', channel: { type: 2 } });
    await handleInteraction(i as any, makeDeps(db, games));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('FREE game (tictactoe) WITHOUT Premium -> starts normally (unaffected)', async () => {
    const { games, start } = freeGames();
    const i = makePlayInteraction({ gameId: 'tictactoe', channel: { type: 2 } });
    await handleInteraction(i as any, makeDeps(db, games));
    expect(start).toHaveBeenCalledTimes(1);
  });
});
