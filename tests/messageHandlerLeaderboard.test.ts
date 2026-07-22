import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { messageText } from './messagePayload';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { bumpTalk, getTopSpeakers } from '../src/store/talkStats';
import { CountGate } from '../src/moderation/countGate';
import type { CommunityPromoKind } from '../src/votePromo';

const GUILD = 'g-lb';
const CHAN = 'chan-tts';
const USER = 'user-1';
const AVAILABLE = ['en_US-amy-medium', 'pt_PT-tugao-medium'];

function makeDeps(
  db: Database.Database,
  say: ReturnType<typeof vi.fn>,
  opts: {
    record: boolean;
    lbSend: ReturnType<typeof vi.fn>;
    promoRecord?: CommunityPromoKind | null;
  },
): BotDeps {
  const players = new Map<string, unknown>();
  players.set(GUILD, { say });
  const ttsChannel = { send: opts.lbSend };
  return {
    client: {
      user: { id: 'bot-1' },
      users: { cache: { get: () => undefined } },
      channels: { cache: { get: (id: string) => (id === CHAN ? ttsChannel : undefined) } },
    },
    db,
    players,
    limiters: new Map(),
    availableModels: AVAILABLE,
    config: {
      clientId: '1523826014935842997',
      supportUrl: 'https://discord.gg/4kYw2WUbNN',
      defaultVoice: 'de_DE-thorsten-medium',
      defaultSpeed: 1.0,
      messageLeadMs: 0,
    },
    leaderboardPoster: { record: vi.fn().mockReturnValue(opts.record) },
    votePromoPoster:
      opts.promoRecord === undefined
        ? undefined
        : { record: vi.fn().mockReturnValue(opts.promoRecord) },
  } as unknown as BotDeps;
}

function makeMsg(): any {
  return {
    author: { bot: false, id: USER, username: 'Ana' },
    guild: {
      members: { cache: { get: () => undefined }, me: { voice: { channelId: 'vc-1' } } },
      channels: { cache: { get: () => undefined } },
    },
    guildId: GUILD,
    channelId: CHAN,
    channel: { send: vi.fn().mockResolvedValue(undefined) }, // msg channel (streak); irrelevant here
    content: 'ola malta tudo bem por aqui hoje neste servidor',
    member: {
      displayName: 'Ana',
      voice: { channelId: 'vc-1' },
      roles: { cache: { has: () => false } },
    },
    mentions: { has: () => false, repliedUser: null },
    reference: null,
  };
}

function measuredUsage(db: Database.Database): number {
  return (
    db
      .prepare('SELECT COALESCE(SUM(spoken_count), 0) AS n FROM talk_usage WHERE user_id = ?')
      .get(USER) as { n: number }
  ).n;
}

describe('handleMessage — automatic leaderboard (F2)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
    setGuildConfig(db, GUILD, { autoread: true, ttsChannelId: CHAN, defaultVoice: '' });
    // Seed talkers so getTopSpeakers returns rows.
    bumpTalk(db, GUILD, 'top-user', new Date());
  });
  afterEach(() => {
    db.close();
  });

  it('poster decides to post -> sends the leaderboard in the /setup channel, WITHOUT pinging', async () => {
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    await handleMessage(makeMsg(), makeDeps(db, say, { record: true, lbSend }));
    expect(say).toHaveBeenCalledTimes(1);
    expect(measuredUsage(db)).toBe(1);
    expect(lbSend).toHaveBeenCalledTimes(1);
    const payload = lbSend.mock.calls[0][0];
    expect(messageText(payload)).toContain('Top talkers');
    expect(payload.allowedMentions).toEqual({ parse: [] }); // pings no one
  });

  it('poster decides NOT to post -> sends nothing', async () => {
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    await handleMessage(makeMsg(), makeDeps(db, say, { record: false, lbSend }));
    expect(say).toHaveBeenCalledTimes(1);
    expect(lbSend).not.toHaveBeenCalled();
  });

  it('vote promo wins -> posts the localized one-time 48h reward without pinging', async () => {
    setGuildConfig(db, GUILD, { votePromos: true });
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, say, { record: false, promoRecord: 'vote', lbSend });
    await handleMessage(makeMsg(), deps);
    expect(lbSend).toHaveBeenCalledTimes(1);
    const payload = lbSend.mock.calls[0][0];
    expect(messageText(payload)).toContain('48h of Plus free');
    expect(messageText(payload)).toContain('top.gg');
    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect((deps.votePromoPoster as any).record).toHaveBeenCalledWith(GUILD);
  });

  it('support promo wins -> posts the official Vozen help server without pinging', async () => {
    setGuildConfig(db, GUILD, { votePromos: true });
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, say, { record: false, promoRecord: 'support', lbSend });
    await handleMessage(makeMsg(), deps);
    expect(lbSend).toHaveBeenCalledTimes(1);
    const payload = lbSend.mock.calls[0][0];
    expect(messageText(payload)).toContain('https://discord.gg/4kYw2WUbNN');
    expect(payload.allowedMentions).toEqual({ parse: [] });
  });

  it('the default-off setting prevents the promo decider and message entirely', async () => {
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, say, { record: false, promoRecord: 'vote', lbSend });

    await handleMessage(makeMsg(), deps);

    expect(lbSend).not.toHaveBeenCalled();
    expect((deps.votePromoPoster as any).record).not.toHaveBeenCalled();
  });

  it('leaderboard and promo never collide on the same message', async () => {
    setGuildConfig(db, GUILD, { votePromos: true });
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, say, { record: true, promoRecord: 'vote', lbSend });
    await handleMessage(makeMsg(), deps);
    expect(lbSend).toHaveBeenCalledTimes(1);
    expect(messageText(lbSend.mock.calls[0][0])).toContain('Top talkers');
    expect((deps.votePromoPoster as any).record).not.toHaveBeenCalled();
  });

  it('queue full (say false) -> does not count or post (record is not even called)', async () => {
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(db, say, { record: true, lbSend });
    await handleMessage(makeMsg(), deps);
    expect(lbSend).not.toHaveBeenCalled();
    expect((deps.leaderboardPoster as any).record).not.toHaveBeenCalled();
    expect(getTopSpeakers(db, GUILD, new Date()).some((r) => r.userId === USER)).toBe(false);
    expect(measuredUsage(db)).toBe(0);
  });

  it('count gate: a burst of identical messages is SPOKEN each time but COUNTED once', async () => {
    const lbSend = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    const deps: BotDeps = {
      ...makeDeps(db, say, { record: false, lbSend }),
      countGate: new CountGate(),
    };
    await handleMessage(makeMsg(), deps); // 1st: counts
    await handleMessage(makeMsg(), deps); // same content, <5s later: spoken, NOT counted
    await handleMessage(makeMsg(), deps); // idem
    expect(say).toHaveBeenCalledTimes(3); // every message is still read aloud
    const me = getTopSpeakers(db, GUILD, new Date()).find((r) => r.userId === USER);
    expect(me?.count).toBe(1); // only the first message inflated the leaderboard
    expect(measuredUsage(db)).toBe(1);
  });
});
