import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { messageText } from './messagePayload';
import { handleGame } from '../src/commands/handlers/games';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';

const GUILD = 'g-game';
const USER = 'user-1';

function makeDeps(
  db: Database.Database,
  stop: ReturnType<typeof vi.fn>,
  isStarter = vi.fn(() => false),
): BotDeps {
  return {
    db,
    games: { stop, isStarter },
  } as unknown as BotDeps;
}

function makeStopInteraction(opts: { canManage: boolean }) {
  const replies: string[] = [];
  return {
    guildId: GUILD,
    user: { id: USER },
    memberPermissions: { has: () => opts.canManage },
    options: { getSubcommand: () => 'stop' },
    reply: vi.fn(async (o: unknown) => {
      replies.push(messageText(o));
    }),
    replies,
  };
}

describe('/game stop authorization', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('rejects a non-starter without Manage Server', async () => {
    const stop = vi.fn().mockReturnValue(true);
    const deps = makeDeps(db, stop);
    const i = makeStopInteraction({ canManage: false });

    await handleGame(i as any, deps);

    expect(stop).not.toHaveBeenCalled();
    expect(i.replies.some((r) => /manage server/i.test(r))).toBe(true);
  });

  it('allows the person who started the game to stop it', async () => {
    const stop = vi.fn().mockReturnValue(true);
    const isStarter = vi.fn(() => true);
    const deps = makeDeps(db, stop, isStarter);
    const i = makeStopInteraction({ canManage: false });

    await handleGame(i as any, deps);

    expect(isStarter).toHaveBeenCalledWith(GUILD, USER);
    expect(stop).toHaveBeenCalledWith(GUILD);
    expect(i.replies.some((r) => /stopped/i.test(r))).toBe(true);
  });

  it('allows a member with Manage Server to stop any game', async () => {
    const stop = vi.fn().mockReturnValue(true);
    const deps = makeDeps(db, stop);
    const i = makeStopInteraction({ canManage: true });

    await handleGame(i as any, deps);

    expect(stop).toHaveBeenCalledWith(GUILD);
    expect(i.replies.some((r) => /stopped/i.test(r))).toBe(true);
  });

  it('reports when an administrator stops but no game is active', async () => {
    const stop = vi.fn().mockReturnValue(false);
    const deps = makeDeps(db, stop);
    const i = makeStopInteraction({ canManage: true });

    await handleGame(i as any, deps);

    expect(stop).toHaveBeenCalledWith(GUILD);
    expect(i.replies.some((r) => /no game running/i.test(r))).toBe(true);
  });
});
