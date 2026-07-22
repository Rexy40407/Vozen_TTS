import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageText } from './messagePayload';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { getServerPronunciations } from '../src/store/pronunciation';
import { grantGuildPremium } from '../src/store/premium';
import type Database from 'better-sqlite3';

const GUILD = 'g-spron';

function makeDeps(db: Database.Database): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map(),
    db,
    config: {},
    availableModels: [],
  } as unknown as BotDeps;
}

function makeInteraction(opts: {
  sub: string;
  optionsMap?: Record<string, unknown>;
  admin?: boolean;
}) {
  const replies: string[] = [];
  const optionsMap = opts.optionsMap ?? {};
  return {
    commandName: 'server-pronunciation',
    guildId: GUILD,
    user: { id: 'admin-1' },
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content: string }) => {
      replies.push(messageText(o));
    },
    member: { permissions: { has: () => opts.admin ?? true } },
    guild: null,
    options: {
      getSubcommandGroup: () => null,
      getSubcommand: () => opts.sub,
      getInteger: () => null,
      getString: (name: string) =>
        (optionsMap[name] as string) ?? (optionsMap[name] === undefined ? '' : ''),
      getBoolean: () => false,
      getChannel: () => null,
      getRole: () => null,
    },
  };
}

describe('/server-pronunciation — admin, cap 3, para toda a guild', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('não-admin -> recusado, nada é guardado', async () => {
    const i = makeInteraction({
      sub: 'add',
      admin: false,
      optionsMap: { term: 'gg', say: 'good game' },
    });
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies.join('\n')).toMatch(/manage server|gerir servidor|permiss/i);
    expect(getServerPronunciations(db, GUILD)).toHaveLength(0);
  });

  it('admin add com opções -> guardado para o servidor', async () => {
    const i = makeInteraction({ sub: 'add', optionsMap: { term: '  gg  ', say: '  good game  ' } });
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies.some((r) => /gg.*good game/i.test(r))).toBe(true);
    expect(getServerPronunciations(db, GUILD)).toEqual([{ term: 'gg', replacement: 'good game' }]);
  });

  it('cap 3: a 4.ª entrada é bloqueada com upsell de remoção', async () => {
    for (const t of ['a', 'b', 'c']) {
      const i = makeInteraction({ sub: 'add', optionsMap: { term: t, say: t + '-say' } });
      await handleInteraction(i as any, makeDeps(db));
    }
    const i4 = makeInteraction({ sub: 'add', optionsMap: { term: 'd', say: 'd-say' } });
    await handleInteraction(i4 as any, makeDeps(db));
    expect(i4.replies.join('\n')).toMatch(/limit|limite|3/i);
    expect(getServerPronunciations(db, GUILD)).toHaveLength(3);
  });

  it('guild Premium: cap sobe para 50 (a 4.ª entrada passa, a 51.ª é bloqueada)', async () => {
    grantGuildPremium(db, GUILD, 30, 'test', Date.now());
    for (let n = 1; n <= 50; n++) {
      const i = makeInteraction({ sub: 'add', optionsMap: { term: `t${n}`, say: `s${n}` } });
      await handleInteraction(i as any, makeDeps(db));
    }
    expect(getServerPronunciations(db, GUILD)).toHaveLength(50);
    const i51 = makeInteraction({ sub: 'add', optionsMap: { term: 'extra', say: 'x' } });
    await handleInteraction(i51 as any, makeDeps(db));
    expect(i51.replies.join('\n')).toMatch(/limit|limite|50/i);
    expect(getServerPronunciations(db, GUILD)).toHaveLength(50);
  });

  it('remove um termo existente', async () => {
    const iadd = makeInteraction({ sub: 'add', optionsMap: { term: 'gg', say: 'good game' } });
    await handleInteraction(iadd as any, makeDeps(db));
    const irm = makeInteraction({ sub: 'remove', optionsMap: { term: 'gg' } });
    await handleInteraction(irm as any, makeDeps(db));
    expect(getServerPronunciations(db, GUILD)).toHaveLength(0);
  });

  it('list mostra as entradas do servidor', async () => {
    const iadd = makeInteraction({ sub: 'add', optionsMap: { term: 'btw', say: 'by the way' } });
    await handleInteraction(iadd as any, makeDeps(db));
    const il = makeInteraction({ sub: 'list' });
    await handleInteraction(il as any, makeDeps(db));
    expect(il.replies.some((r) => /btw.*by the way/i.test(r))).toBe(true);
  });
});
