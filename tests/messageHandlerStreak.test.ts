import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { messageText } from './messagePayload';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { bumpTalk } from '../src/store/talkStats';
import { getGuildStreak } from '../src/store/guildTalkStreak';

const GUILD = 'g-streak';
const CHAN = 'chan-1';
const USER = 'user-1';
const AVAILABLE = ['en_US-amy-medium', 'pt_PT-tugao-medium'];

// The handler calls bumpTalk(new Date()) — not injectable. So we seed the state
// RELATIVE to the real NOW: a Date of YESTERDAY creates the row with last_date=yesterday, streak 1;
// today's message takes the streak to 2 and firstOfDay=true -> fires the "Day 2" notice.
function yesterday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
}

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
  } as unknown as BotDeps;
}

function makeMsg(send: ReturnType<typeof vi.fn>): any {
  return {
    author: { bot: false, id: USER, username: 'Ana' },
    guild: {
      members: { cache: { get: () => undefined }, me: { voice: { channelId: 'vc-1' } } },
      channels: { cache: { get: () => undefined } },
    },
    guildId: GUILD,
    channelId: CHAN,
    channel: { send },
    content: 'ola malta tudo bem por aqui hoje',
    member: {
      displayName: 'Ana',
      voice: { channelId: 'vc-1' },
      roles: { cache: { has: () => false } },
    },
    mentions: { has: () => false, repliedUser: null },
    reference: null,
  };
}

describe('handleMessage — streak notice 🔥 (F1)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
    setGuildConfig(db, GUILD, { autoread: true, ttsChannelId: CHAN, defaultVoice: '' });
  });
  afterEach(() => {
    db.close();
  });

  it('2nd day in a row -> sends the "Day 2" notice in the channel (with the mention)', async () => {
    bumpTalk(db, GUILD, USER, yesterday()); // seeds streak 1 from yesterday
    const send = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true); // enqueued
    await handleMessage(makeMsg(send), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(messageText(payload)).toContain(`<@${USER}>`);
    expect(messageText(payload)).toContain('2');
    expect(payload.allowedMentions).toEqual({ parse: [] }); // mention visible but does NOT ping
  });

  it('very first message ever (Day 1) -> does NOT send notice (only from Day 2)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    await handleMessage(makeMsg(send), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('2nd message of the SAME day -> does NOT resend (only on the 1st of the day)', async () => {
    bumpTalk(db, GUILD, USER, yesterday());
    const send = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    const deps = makeDeps(db, say);
    await handleMessage(makeMsg(send), deps); // Day 2 -> notifies
    await handleMessage(makeMsg(send), deps); // same day -> does not notify
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('toggle OFF (/config streaks off) -> does not send even with a streak', async () => {
    bumpTalk(db, GUILD, USER, yesterday());
    setGuildConfig(db, GUILD, { streakAnnounce: false });
    const send = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    await handleMessage(makeMsg(send), makeDeps(db, say));
    expect(say).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('queue full (say -> false) -> does not send the notice', async () => {
    bumpTalk(db, GUILD, USER, yesterday());
    const send = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(false); // not enqueued
    await handleMessage(makeMsg(send), makeDeps(db, say));
    expect(send).not.toHaveBeenCalled();
  });
});

describe('handleMessage — server streak wiring (silent, panel-only)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
    setGuildConfig(db, GUILD, { autoread: true, ttsChannelId: CHAN, defaultVoice: '' });
  });
  afterEach(() => {
    db.close();
  });

  it('an auto-read message records the SERVER streak (>= 1) and posts NOTHING public', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const say = vi.fn().mockResolvedValue(true);
    await handleMessage(makeMsg(send), makeDeps(db, say));
    // Recorded silently for the private panel...
    expect(getGuildStreak(db, GUILD, new Date()).streak).toBeGreaterThanOrEqual(1);
    // ...and the bot announced nothing in the channel (first message ever -> no user 🔥 either).
    expect(send).not.toHaveBeenCalled();
  });
});
