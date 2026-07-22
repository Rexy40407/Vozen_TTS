import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageText } from './messagePayload';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { getPremiumPass, isUserPremium } from '../src/store/premium';
import { insertPremiumCode, getPremiumCode } from '../src/store/premiumCode';
import type Database from 'better-sqlite3';

const OWNER = 'owner-1';

function makeDeps(db: Database.Database, ownerIds: Set<string> | undefined): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, guilds: { cache: new Map() } },
    players: new Map(),
    db,
    config: { kofiUrl: 'https://ko-fi.com/x' },
    availableModels: [],
    ownerIds,
  } as unknown as BotDeps;
}

function countCodes(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM premium_code').get() as { n: number }).n;
}

function makeGenCode(opts: {
  callerId: string;
  plan: 'premium' | 'plus';
  days?: number;
  seats?: number;
  amount?: number;
}) {
  const replies: string[] = [];
  return {
    commandName: 'generate-code',
    guildId: 'g-owner',
    isRepliable: () => true,
    user: { id: opts.callerId },
    replies,
    reply: async (o: { content?: string }) => {
      const text = messageText(o);
      if (text) replies.push(text);
    },
    options: {
      getSubcommand: () => '',
      getString: () => opts.plan,
      getInteger: (n: string) =>
        n === 'days'
          ? (opts.days ?? null)
          : n === 'seats'
            ? (opts.seats ?? null)
            : n === 'amount'
              ? (opts.amount ?? null)
              : null,
    },
  };
}

function makeRedeem(opts: { callerId: string; code: string }) {
  const replies: string[] = [];
  return {
    commandName: 'redeem',
    guildId: 'g-1',
    isRepliable: () => true,
    user: { id: opts.callerId },
    replies,
    reply: async (o: { content?: string }) => {
      const text = messageText(o);
      if (text) replies.push(text);
    },
    options: {
      getSubcommand: () => '',
      getString: () => opts.code,
      getInteger: () => null,
    },
  };
}

describe('/generate-code — OWNER-ONLY', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('NON-owner -> refused and NO code is generated', async () => {
    const i = makeGenCode({ callerId: 'intruso', plan: 'plus' });
    await handleInteraction(i as never, makeDeps(db, new Set([OWNER])));
    expect(i.replies.join('\n')).toMatch(/owner only|dono do bot/i);
    expect(countCodes(db)).toBe(0);
  });

  it('ownerIds absent -> refuses by default (fail-closed), 0 codes', async () => {
    const i = makeGenCode({ callerId: OWNER, plan: 'plus' });
    await handleInteraction(i as never, makeDeps(db, undefined));
    expect(i.replies.join('\n')).toMatch(/owner only|dono do bot/i);
    expect(countCodes(db)).toBe(0);
  });

  it('owner -> generates the requested number of codes (amount)', async () => {
    const i = makeGenCode({ callerId: OWNER, plan: 'premium', days: 30, seats: 3, amount: 3 });
    await handleInteraction(i as never, makeDeps(db, new Set([OWNER])));
    expect(countCodes(db)).toBe(3);
  });
});

describe('/redeem — code redemption', () => {
  let db: Database.Database;
  const now = Date.now();
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('valid Plus code -> grants Plus to the redeemer and marks the code used', async () => {
    insertPremiumCode(db, {
      code: 'VOZEN-AAAA-BBBB',
      plan: 'plus',
      days: 30,
      seats: 0,
      createdBy: OWNER,
      createdAt: now,
      expiresAt: null,
    });
    const i = makeRedeem({ callerId: 'friend-1', code: 'vozen-aaaa-bbbb' }); // lowercase -> normalizes
    await handleInteraction(i as never, makeDeps(db, new Set([OWNER])));
    expect(isUserPremium(db, 'friend-1', now + 1000)).toBe(true);
    expect(getPremiumCode(db, 'VOZEN-AAAA-BBBB')?.redeemedBy).toBe('friend-1');
  });

  it('valid Premium code -> grants a pass to the redeemer', async () => {
    insertPremiumCode(db, {
      code: 'VOZEN-CCCC-DDDD',
      plan: 'premium',
      days: 30,
      seats: 3,
      createdBy: OWNER,
      createdAt: now,
      expiresAt: null,
    });
    const i = makeRedeem({ callerId: 'friend-2', code: 'VOZEN-CCCC-DDDD' });
    await handleInteraction(i as never, makeDeps(db, new Set([OWNER])));
    expect(getPremiumPass(db, 'friend-2')?.seats).toBe(3);
  });

  it('nonexistent code -> error and nothing is granted', async () => {
    const i = makeRedeem({ callerId: 'friend-3', code: 'VOZEN-ZZZZ-ZZZZ' });
    await handleInteraction(i as never, makeDeps(db, new Set([OWNER])));
    expect(i.replies.join('\n')).toMatch(/doesn't exist|não existe/i);
    expect(isUserPremium(db, 'friend-3', now + 1000)).toBe(false);
  });

  it('already-used code -> a 2nd redemption fails', async () => {
    insertPremiumCode(db, {
      code: 'VOZEN-ONCE-ONCE',
      plan: 'plus',
      days: 30,
      seats: 0,
      createdBy: OWNER,
      createdAt: now,
      expiresAt: null,
    });
    const deps = makeDeps(db, new Set([OWNER]));
    await handleInteraction(
      makeRedeem({ callerId: 'friend-4', code: 'VOZEN-ONCE-ONCE' }) as never,
      deps,
    );
    const i2 = makeRedeem({ callerId: 'friend-5', code: 'VOZEN-ONCE-ONCE' });
    await handleInteraction(i2 as never, deps);
    expect(i2.replies.join('\n')).toMatch(/already been redeemed|já foi resgatado/i);
    expect(isUserPremium(db, 'friend-5', now + 1000)).toBe(false);
  });
});
