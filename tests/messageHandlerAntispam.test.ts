import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { DuplicateTracker } from '../src/moderation/antispam';

const GUILD = 'g-antispam';
const CHAN = 'chan-1';
const USER = 'user-1';

const AVAILABLE = ['en_US-amy-medium', 'pt_PT-tugao-medium'];

function makeDeps(db: Database.Database, say: ReturnType<typeof vi.fn>): BotDeps {
  const players = new Map<string, unknown>();
  players.set(GUILD, { say });
  return {
    client: { user: { id: 'bot-1' }, users: { cache: { get: () => undefined } } },
    db,
    players,
    limiters: new Map(),
    availableModels: AVAILABLE,
    config: { defaultVoice: 'de_DE-thorsten-medium', defaultSpeed: 1.0, messageLeadMs: 0 },
    dupTracker: new DuplicateTracker(),
  } as unknown as BotDeps;
}

function makeMsg(content: string): any {
  return {
    author: { bot: false, id: USER },
    guild: {
      members: { cache: { get: () => undefined }, me: { voice: { channelId: 'vc-1' } } },
      channels: { cache: { get: () => undefined } },
    },
    guildId: GUILD,
    channelId: CHAN,
    content,
    member: { voice: { channelId: 'vc-1' }, roles: { cache: { has: () => false } } },
    mentions: { has: () => false, repliedUser: null },
    reference: null,
  };
}

const SPAM = Array(39).fill('POKEBOLAS').join(' ');
const NORMAL = 'bom dia a todos espero que tenham um excelente fim de semana com muita saude';
// Large message (≥40 chars) and DIVERSE (not repetition-spam), to exercise the dup tracker.
const BIG = 'malta vamos jogar valorant hoje à noite por volta das nove horas quem alinha comigo';

describe('handleMessage — anti-spam (opt-in per guild)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
    setGuildConfig(db, GUILD, { autoread: true, ttsChannelId: CHAN, defaultVoice: '' });
  });
  afterEach(() => {
    db.close();
  });

  it('antispam ON: massive repetition ("POKEBOLAS" ×39) is NOT read', async () => {
    setGuildConfig(db, GUILD, { antispam: true });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleMessage(makeMsg(SPAM), makeDeps(db, say));
    expect(say).not.toHaveBeenCalled();
  });

  it('antispam OFF (default): the same repetition IS read', async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    await handleMessage(makeMsg(SPAM), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('antispam ON: a normal message IS read (no false positive)', async () => {
    setGuildConfig(db, GUILD, { antispam: true });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleMessage(makeMsg(NORMAL), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('antispam ON: the 2nd IDENTICAL large message in a row is suppressed (the 1st is read)', async () => {
    setGuildConfig(db, GUILD, { antispam: true });
    const say = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(db, say); // SAME dupTracker across both calls
    await handleMessage(makeMsg(BIG), deps);
    await handleMessage(makeMsg(BIG), deps);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('antispam OFF: two identical large messages are both read', async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(db, say);
    await handleMessage(makeMsg(BIG), deps);
    await handleMessage(makeMsg(BIG), deps);
    expect(say).toHaveBeenCalledTimes(2);
  });
});
