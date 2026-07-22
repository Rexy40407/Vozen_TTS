import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageText } from './messagePayload';

// Minimal mock of @discordjs/voice (the commands module imports it transitively).
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { grantGuildPass, activateSeat } from '../src/store/premium';
import type Database from 'better-sqlite3';

const GUILD = 'g-prem';
const OTHER = 'g-other';
const U = 'u-1';

function makeDeps(db: Database.Database): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, guilds: { cache: new Map() } },
    players: new Map(),
    db,
    config: { kofiUrl: 'https://ko-fi.com/vozentest' },
    availableModels: [],
  } as unknown as BotDeps;
}

/** Fake /premium <sub> interaction. manage = has Manage Server? */
function makePremiumInteraction(
  sub: 'info' | 'activate' | 'deactivate',
  opts: { manage?: boolean; guildId?: string | null; userId?: string } = {},
) {
  const { manage = true, guildId = GUILD, userId = U } = opts;
  const replies: string[] = [];
  const embedTexts: string[] = [];
  const componentRows: unknown[] = [];
  return {
    commandName: 'premium',
    guildId,
    isRepliable: () => true,
    user: { id: userId },
    member: { permissions: { has: () => manage } },
    replies,
    embedTexts,
    componentRows,
    reply: async (o: {
      content?: string;
      embeds?: { data: { description?: string } }[];
      components?: unknown[];
    }) => {
      const text = messageText(o);
      if (text) replies.push(text);
      if (o.embeds)
        for (const e of o.embeds) if (e.data.description) embedTexts.push(e.data.description);
      if (o.components) componentRows.push(...o.components);
    },
    editReply: async () => {},
    // Only the activate confirmation path reaches here; we never click (timeout).
    fetchReply: async () => ({
      awaitMessageComponent: async () => {
        throw new Error('no-click');
      },
    }),
    options: {
      getSubcommand: () => sub,
      getSubcommandGroup: () => null,
      getString: () => '',
    },
  };
}

describe('/premium — info / activate / deactivate (licence pass)', () => {
  let db: Database.Database;
  const now = Date.now();
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('info without Premium -> showcase + Ko-fi purchase link', async () => {
    const i = makePremiumInteraction('info');
    await handleInteraction(i as any, makeDeps(db));
    expect(i.embedTexts.join('\n')).toMatch(/ko-fi\.com\/vozentest/);
    expect(i.embedTexts.join('\n')).toMatch(/Kokoro.*Google HD/s);
  });

  it('shows native Discord purchase buttons when Premium App SKUs are configured', async () => {
    const deps = makeDeps(db);
    deps.config.premiumGuildSkuId = '111111111111111111';
    deps.config.premiumUserSkuId = '222222222222222222';
    const i = makePremiumInteraction('info');

    await handleInteraction(i as any, deps);

    const json = JSON.stringify(i.componentRows);
    expect(json).toContain('111111111111111111');
    expect(json).toContain('222222222222222222');
  });

  it('info with active pass -> shows the pass line (licences in use)', async () => {
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, GUILD, now);
    const i = makePremiumInteraction('info');
    await handleInteraction(i as any, makeDeps(db));
    // the pass line mentions 1/2 licences
    expect(i.embedTexts.join('\n')).toMatch(/1\/2/);
  });

  it('activate without Manage Server -> refuses (needManageGuild)', async () => {
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    const i = makePremiumInteraction('activate', { manage: false });
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies.join('\n')).toMatch(/Manage Server|Gerir Servidor/i);
  });

  it('activate with Manage Server but WITHOUT a pass -> says there is no pass + link', async () => {
    const i = makePremiumInteraction('activate');
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies.join('\n')).toMatch(/ko-fi\.com\/vozentest/);
  });

  it('activate on an already-activated server -> alreadyActive (does not open confirmation)', async () => {
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, GUILD, now);
    const i = makePremiumInteraction('activate');
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies.length).toBeGreaterThan(0); // responded with reply(), not with a confirmation
  });

  it('activate with no free licences (2 used on other servers) -> noSeats', async () => {
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, OTHER, now);
    activateSeat(db, U, 'g-third', now);
    const i = makePremiumInteraction('activate'); // tries on a 3rd server
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies.length).toBeGreaterThan(0);
    expect(i.replies.join('\n')).toMatch(/2/); // mentions the total number of licences
  });

  it('deactivate frees the server licence; without a licence -> deactivateNone', async () => {
    grantGuildPass(db, U, 2, 30, 'kofi', now);
    activateSeat(db, U, GUILD, now);
    const i1 = makePremiumInteraction('deactivate');
    await handleInteraction(i1 as any, makeDeps(db));
    expect(i1.replies.join('\n')).toMatch(/Freed|Libertaste/i);
    // second time there is nothing left to free
    const i2 = makePremiumInteraction('deactivate');
    await handleInteraction(i2 as any, makeDeps(db));
    expect(i2.replies.join('\n')).toMatch(/no Premium licence|nenhuma licença/i);
  });
});
