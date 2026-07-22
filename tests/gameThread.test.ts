import { describe, it, expect, vi } from 'vitest';
import type { Client } from 'discord.js';
import { createGameThread, deleteChannelSafe } from '../src/games/thread';

// Silence the logger in tests (the warn/info messages are part of the observability
// contract, but here we only assert the BEHAVIOR: delete → archive → nothing).
vi.mock('../src/logging/logger', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Fake client: only what deleteChannelSafe uses (cache.get + fetch). */
function makeClient(channel: unknown): Client {
  return {
    channels: {
      cache: new Map(channel ? [['thread-1', channel]] : []),
      fetch: async () => null,
    },
  } as unknown as Client;
}

describe('deleteChannelSafe — ladder delete → archive → nothing', () => {
  it('deletes the thread when it has permission (does not archive)', async () => {
    const del = vi.fn(async () => ({}));
    const setArchived = vi.fn(async () => ({}));
    await deleteChannelSafe(makeClient({ delete: del, setArchived }), 'thread-1');
    expect(del).toHaveBeenCalledOnce();
    expect(setArchived).not.toHaveBeenCalled();
  });

  it('without Manage Threads (delete rejects) → ARCHIVES the thread as fallback', async () => {
    const del = vi.fn(async () => {
      throw new Error('Missing Permissions');
    });
    const setArchived = vi.fn(async () => ({}));
    await deleteChannelSafe(makeClient({ delete: del, setArchived }), 'thread-1');
    expect(del).toHaveBeenCalledOnce();
    expect(setArchived).toHaveBeenCalledWith(true, expect.any(String));
  });

  it('delete AND archive both fail → does not throw (auto-archive is the last net)', async () => {
    const del = vi.fn(async () => {
      throw new Error('Missing Permissions');
    });
    const setArchived = vi.fn(async () => {
      throw new Error('Missing Permissions');
    });
    await expect(
      deleteChannelSafe(makeClient({ delete: del, setArchived }), 'thread-1'),
    ).resolves.toBeUndefined();
  });

  it('thread no longer exists → no-op without throwing', async () => {
    await expect(deleteChannelSafe(makeClient(null), 'thread-1')).resolves.toBeUndefined();
  });
});

describe('createGameThread — silent fallback', () => {
  it('channel without thread support (e.g. voice) → null', async () => {
    expect(await createGameThread({ type: 2 }, 'jogo')).toBeNull();
  });

  it('threads.create rejects (no permission) → null, without throwing', async () => {
    const channel = {
      type: 0, // GuildText
      threads: {
        create: async () => {
          throw new Error('Missing Permissions');
        },
      },
    };
    expect(await createGameThread(channel, 'jogo')).toBeNull();
  });

  it('happy path → returns the thread id', async () => {
    const channel = {
      type: 0,
      threads: { create: async () => ({ id: 'nova-thread' }) },
    };
    expect(await createGameThread(channel, '🎮 Wordle')).toBe('nova-thread');
  });
});
