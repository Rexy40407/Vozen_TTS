import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { setOptOut } from '../src/store/optout';

const GUILD = 'g-optout';
const CHAN = 'chan-1';
const USER = 'user-1';

function makeDeps(db: Database.Database, say: ReturnType<typeof vi.fn>): BotDeps {
  const players = new Map<string, unknown>();
  players.set(GUILD, { say });
  return {
    client: { user: { id: 'bot-1' }, users: { cache: { get: () => undefined } } },
    db,
    players,
    limiters: new Map(),
    availableModels: ['en_US-amy-medium'],
    config: { defaultVoice: 'en_US-amy-medium', defaultSpeed: 1.0 },
  } as unknown as BotDeps;
}

// `mention` controla mentions.has → para distinguir leitura passiva do canal de uma
// accao explicita (mencao/reply) do utilizador.
function makeMessage(opts: { mention?: boolean }): any {
  const mention = opts.mention ?? false;
  return {
    author: { bot: false, id: USER },
    guild: {
      members: { cache: { get: () => undefined }, me: { voice: { channelId: 'vc-1' } } },
      channels: { cache: { get: () => undefined } },
    },
    guildId: GUILD,
    channelId: CHAN,
    content: 'ola mundo',
    member: { voice: { channelId: 'vc-1' }, roles: { cache: { has: () => false } } },
    mentions: {
      has: () => mention,
      repliedUser: null,
    },
    reference: null,
  };
}

describe('handleMessage — opt-out por utilizador na auto-leitura', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
    setGuildConfig(db, GUILD, { autoread: true, ttsChannelId: CHAN });
  });
  afterEach(() => {
    db.close();
  });

  it('opted-in (default): mensagem no canal de autoread e lida', async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    await handleMessage(makeMessage({}), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('opted-out: leitura passiva do canal de autoread e ignorada', async () => {
    setOptOut(db, GUILD, USER);
    const say = vi.fn().mockResolvedValue(undefined);
    await handleMessage(makeMessage({}), makeDeps(db, say));
    expect(say).not.toHaveBeenCalled();
  });

  it('opted-out mas com mencao ao bot: ainda e lido (accao explicita do utilizador)', async () => {
    setOptOut(db, GUILD, USER);
    const say = vi.fn().mockResolvedValue(undefined);
    await handleMessage(makeMessage({ mention: true }), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
  });
});
