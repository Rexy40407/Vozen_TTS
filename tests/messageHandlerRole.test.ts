import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';

const GUILD = 'g-role';
const CHAN = 'chan-1';

// Player falso: so precisamos de say() para afirmar se a mensagem foi (ou nao) lida.
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

// Mensagem minima: autoread no canal configurado, autor humano, conteudo simples.
// `roles` controla member.roles.cache.has para variar o gating por role.
function makeMessage(opts: { member: unknown }): any {
  return {
    author: { bot: false, id: 'user-1' },
    guild: {
      members: { cache: { get: () => undefined }, me: { voice: { channelId: 'vc-1' } } },
      channels: { cache: { get: () => undefined } },
    },
    guildId: GUILD,
    channelId: CHAN,
    content: 'ola mundo',
    member: opts.member,
    mentions: {
      has: () => false,
      repliedUser: null,
    },
    reference: null,
  };
}

function memberWithRoles(roleIds: string[]): unknown {
  return {
    voice: { channelId: 'vc-1' },
    roles: { cache: { has: (id: string) => roleIds.includes(id) } },
  };
}

describe('handleMessage — gating por role', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
    // Auto-leitura ligada no canal CHAN para passar o gating de canal.
    setGuildConfig(db, GUILD, { autoread: true, ttsChannelId: CHAN });
  });
  afterEach(() => {
    db.close();
  });

  it('ttsRoleId null: comportamento normal, mensagem e lida', async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(db, say);
    const msg = makeMessage({ member: memberWithRoles([]) });
    await handleMessage(msg, deps);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('ttsRoleId definido + membro COM o role: mensagem e lida', async () => {
    setGuildConfig(db, GUILD, { ttsRoleId: 'role-x' });
    const say = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(db, say);
    const msg = makeMessage({ member: memberWithRoles(['role-x']) });
    await handleMessage(msg, deps);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('ttsRoleId definido + membro SEM o role: mensagem e ignorada', async () => {
    setGuildConfig(db, GUILD, { ttsRoleId: 'role-x' });
    const say = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(db, say);
    const msg = makeMessage({ member: memberWithRoles(['outro-role']) });
    await handleMessage(msg, deps);
    expect(say).not.toHaveBeenCalled();
  });

  it('ttsRoleId definido + member ausente (null): mensagem e ignorada', async () => {
    setGuildConfig(db, GUILD, { ttsRoleId: 'role-x' });
    const say = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(db, say);
    const msg = makeMessage({ member: null });
    await handleMessage(msg, deps);
    expect(say).not.toHaveBeenCalled();
  });
});
