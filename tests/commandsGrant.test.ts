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
import type Database from 'better-sqlite3';

const OWNER = 'owner-1';
const TARGET = 't-1';

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

function makeGrantInteraction(opts: {
  callerId: string;
  plan: 'premium' | 'plus';
  days?: number;
  seats?: number;
}) {
  const replies: string[] = [];
  return {
    commandName: 'vozen-grant',
    guildId: 'g-owner',
    isRepliable: () => true,
    user: { id: opts.callerId },
    replies,
    reply: async (o: unknown) => {
      const text = messageText(o);
      if (text) replies.push(text);
    },
    options: {
      getSubcommand: () => '',
      getSubcommandGroup: () => null,
      getUser: () => ({ id: TARGET }),
      getString: () => opts.plan,
      getInteger: (n: string) =>
        n === 'days' ? (opts.days ?? null) : n === 'seats' ? (opts.seats ?? null) : null,
    },
  };
}

describe('/vozen-grant — OWNER-ONLY (defesa em profundidade, camada 2)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('NÃO-dono -> recusado e NADA é concedido', async () => {
    const i = makeGrantInteraction({ callerId: 'intruso', plan: 'premium' });
    await handleInteraction(i as any, makeDeps(db, new Set([OWNER])));
    expect(i.replies.join('\n')).toMatch(/owner only|dono do bot/i);
    expect(getPremiumPass(db, TARGET)).toBeNull();
  });

  it('ownerIds ausente (não resolvido) -> recusa por defeito (fail-closed)', async () => {
    const i = makeGrantInteraction({ callerId: OWNER, plan: 'premium' });
    await handleInteraction(i as any, makeDeps(db, undefined));
    expect(i.replies.join('\n')).toMatch(/owner only|dono do bot/i);
    expect(getPremiumPass(db, TARGET)).toBeNull();
  });

  it('dono + premium -> concede passe de 3 licenças', async () => {
    const i = makeGrantInteraction({ callerId: OWNER, plan: 'premium', days: 30 });
    await handleInteraction(i as any, makeDeps(db, new Set([OWNER])));
    const pass = getPremiumPass(db, TARGET);
    expect(pass).not.toBeNull();
    expect(pass!.seats).toBe(3);
    expect(i.replies.join('\n')).toMatch(/Premium/);
  });

  it('dono + plus -> concede Vozen Plus ao utilizador', async () => {
    const i = makeGrantInteraction({ callerId: OWNER, plan: 'plus', days: 30 });
    await handleInteraction(i as any, makeDeps(db, new Set([OWNER])));
    expect(isUserPremium(db, TARGET, Date.now() + 1000)).toBe(true);
  });
});
