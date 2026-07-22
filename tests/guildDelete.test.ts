// tests/guildDelete.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleGuildDelete } from '../src/bot/deps';
import type { BotDeps } from '../src/bot/deps';
import type { GuildVoicePlayer } from '../src/voice/player';
import { RateLimiter } from '../src/moderation/rateLimiter';
import { initDb } from '../src/store/db';
import { getGuildConfig, setGuildConfig } from '../src/store/guildConfig';

function fakePlayer() {
  return { destroy: vi.fn() } as unknown as GuildVoicePlayer;
}

function fakeDeps() {
  const players = new Map<string, GuildVoicePlayer>();
  const limiters = new Map<string, { limiter: RateLimiter; perMin: number }>();
  return { players, limiters } as Pick<BotDeps, 'players' | 'limiters'>;
}

describe('handleGuildDelete', () => {
  it('releases the limiter and destroys/removes the guild player', () => {
    const deps = fakeDeps();
    const player = fakePlayer();
    deps.players.set('G', player);
    deps.limiters.set('G', { limiter: new RateLimiter(5), perMin: 5 });

    handleGuildDelete(deps, 'G');

    expect(deps.limiters.has('G')).toBe(false);
    expect(deps.players.has('G')).toBe(false);
    expect(player.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not touch other guilds', () => {
    const deps = fakeDeps();
    const other = fakePlayer();
    deps.players.set('OTHER', other);
    deps.limiters.set('OTHER', { limiter: new RateLimiter(5), perMin: 5 });
    deps.limiters.set('G', { limiter: new RateLimiter(5), perMin: 5 });

    handleGuildDelete(deps, 'G');

    expect(deps.limiters.has('OTHER')).toBe(true);
    expect(deps.players.has('OTHER')).toBe(true);
    expect(other.destroy).not.toHaveBeenCalled();
  });

  it('does not crash if the guild does not exist (limiter and player absent)', () => {
    const deps = fakeDeps();
    expect(() => handleGuildDelete(deps, 'NOPE')).not.toThrow();
    expect(deps.limiters.has('NOPE')).toBe(false);
    expect(deps.players.has('NOPE')).toBe(false);
  });

  it('plan 010: evicts the guild stores cache (the next get re-queries)', () => {
    const db = initDb(':memory:');
    try {
      setGuildConfig(db, 'G', { maxChars: 123 });
      getGuildConfig(db, 'G'); // populates the cache
      handleGuildDelete({ ...fakeDeps(), db }, 'G'); // should evict the 'G' entry
      const spy = vi.spyOn(db, 'prepare');
      getGuildConfig(db, 'G'); // cache evicted -> re-reads from the DB
      const selects = spy.mock.calls.filter((c) => String(c[0]).includes('FROM guild_config'));
      expect(selects.length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    } finally {
      db.close();
    }
  });

  it('does not crash if player.destroy() throws; limiter is still removed', () => {
    const deps = fakeDeps();
    const bad = {
      destroy: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as GuildVoicePlayer;
    deps.players.set('G', bad);
    deps.limiters.set('G', { limiter: new RateLimiter(5), perMin: 5 });

    expect(() => handleGuildDelete(deps, 'G')).not.toThrow();
    expect(deps.limiters.has('G')).toBe(false);
  });
});
