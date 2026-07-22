import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameManager } from '../src/games/manager';
import type { Clock, Game, GameContext, GameEnv, TimerHandle } from '../src/games/types';

/** Lets the microtasks run (the manager calls game.start/onMessage via Promise). */
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

/** Fake clock: advances time by hand and fires the due timers in order. */
class FakeClock implements Clock {
  time = 0;
  private timers: { id: number; at: number; fn: () => void }[] = [];
  private seq = 1;
  now(): number {
    return this.time;
  }
  setTimeout(fn: () => void, ms: number): TimerHandle {
    const id = this.seq++;
    this.timers.push({ id, at: this.time + ms, fn });
    return id;
  }
  clearTimeout(handle: TimerHandle): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t.id !== due.id);
      this.time = due.at;
      due.fn();
    }
    this.time = target;
  }
  pending(): number {
    return this.timers.length;
  }
}

function makeEnv(overrides: Partial<GameEnv> = {}): GameEnv {
  const clock = new FakeClock();
  return {
    clock,
    availableModels: ['en_US-amy-medium', 'de_DE-thorsten-medium'],
    defaultSpeed: 1,
    defaultVoiceOf: () => 'en_US-amy-medium',
    getPlayer: () => ({ say: vi.fn(async () => true) }),
    sendToChannel: vi.fn(async () => {}),
    localeOf: () => 'en',
    translate: (key) => key,
    persistScores: vi.fn(),
    logError: vi.fn(),
    ...overrides,
  };
}

/** Minimal spy game: stores the ctx and counts calls, with no logic of its own. */
class SpyGame implements Game {
  readonly id = 'spy';
  ctx: GameContext | null = null;
  starts = 0;
  messages: string[] = [];
  start(ctx: GameContext): void {
    this.ctx = ctx;
    this.starts++;
  }
  onMessage(ctx: GameContext, msg: { content: string }): void {
    this.ctx = ctx;
    this.messages.push(msg.content);
  }
}

const GUILD = 'g1';
const CHAN = 'c1';

describe('GameManager', () => {
  let env: GameEnv;
  let clock: FakeClock;
  let mgr: GameManager;
  beforeEach(() => {
    env = makeEnv();
    clock = env.clock as FakeClock;
    mgr = new GameManager(env);
  });

  it('per-guild lock: 2nd start in the same guild -> already-active', () => {
    expect(mgr.start(GUILD, CHAN, new SpyGame())).toBe('started');
    expect(mgr.active(GUILD)).toBe(true);
    expect(mgr.channelOf(GUILD)).toBe(CHAN);
    expect(mgr.start(GUILD, 'another-channel', new SpyGame())).toBe('already-active');
  });

  it('tracks the starter for scoped stop authorization and clears it at teardown', () => {
    expect(mgr.isStarter(GUILD, 'owner')).toBe(false);
    mgr.start(GUILD, CHAN, new SpyGame(), true, 'en', undefined, 'owner');
    expect(mgr.isStarter(GUILD, 'owner')).toBe(true);
    expect(mgr.isStarter(GUILD, 'other')).toBe(false);
    mgr.stop(GUILD);
    expect(mgr.isStarter(GUILD, 'owner')).toBe(false);
  });

  it('calls game.start on start', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    expect(g.starts).toBe(1);
  });

  it('handleMessage: consumes (true) and forwards ONLY in the game channel', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    const inChan = mgr.handleMessage({
      guildId: GUILD,
      channelId: CHAN,
      authorId: 'u',
      authorName: 'U',
      content: 'ola',
      canTriggerSpeech: true,
    });
    expect(inChan).toBe(true);
    // In another channel of the same guild -> does NOT consume (normal TTS proceeds).
    const otherChan = mgr.handleMessage({
      guildId: GUILD,
      channelId: 'c2',
      authorId: 'u',
      authorName: 'U',
      content: 'oi',
      canTriggerSpeech: true,
    });
    expect(otherChan).toBe(false);
    await flush();
    expect(g.messages).toEqual(['ola']);
  });

  it('no active game -> handleMessage returns false', () => {
    expect(
      mgr.handleMessage({
        guildId: GUILD,
        channelId: CHAN,
        authorId: 'u',
        authorName: 'U',
        content: 'x',
        canTriggerSpeech: true,
      }),
    ).toBe(false);
  });

  it('ctx.after fires as the clock advances; end cancels the pending timers', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    const fired = vi.fn();
    g.ctx!.after(1000, fired);
    expect(clock.pending()).toBe(1);
    clock.advance(999);
    expect(fired).not.toHaveBeenCalled();
    clock.advance(1);
    expect(fired).toHaveBeenCalledTimes(1);

    // New timer + end -> the timer is cancelled (does not fire).
    const fired2 = vi.fn();
    g.ctx!.after(500, fired2);
    expect(clock.pending()).toBe(1);
    g.ctx!.end();
    expect(clock.pending()).toBe(0);
    clock.advance(1000);
    expect(fired2).not.toHaveBeenCalled();
  });

  it('end() persists the accumulated points (NORMAL end of the match)', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    g.ctx!.award('a', 2);
    g.ctx!.award('a', 1);
    g.ctx!.award('b', 5);
    g.ctx!.end();
    expect(env.persistScores).toHaveBeenCalledTimes(1);
    const [gid, points] = (env.persistScores as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(gid).toBe(GUILD);
    expect(points).toEqual(
      new Map([
        ['a', 3],
        ['b', 5],
      ]),
    );
    // After end the lock is free.
    expect(mgr.active(GUILD)).toBe(false);
  });

  it('stop() and endGuild() abort WITHOUT persisting points', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    g.ctx!.award('a', 9);
    expect(mgr.stop(GUILD)).toBe(true);
    expect(env.persistScores).not.toHaveBeenCalled();
    expect(mgr.active(GUILD)).toBe(false);
    // stop with no game -> false.
    expect(mgr.stop(GUILD)).toBe(false);

    // endGuild likewise (exit funnel): aborts and does not persist.
    const g2 = new SpyGame();
    mgr.start(GUILD, CHAN, g2);
    await flush();
    g2.ctx!.award('x', 3);
    mgr.endGuild(GUILD);
    expect(env.persistScores).not.toHaveBeenCalled();
    expect(mgr.active(GUILD)).toBe(false);
  });

  it('onVoiceLeft ends VOICE games but spares board ones; endGuild ends any', async () => {
    // VOICE game (needsVoice default true): a voice leave ends it.
    mgr.start(GUILD, CHAN, new SpyGame());
    await flush();
    mgr.onVoiceLeft(GUILD);
    expect(mgr.active(GUILD)).toBe(false);

    // BOARD game (needsVoice=false): survives an unrelated voice leave.
    mgr.start(GUILD, CHAN, new SpyGame(), false);
    await flush();
    mgr.onVoiceLeft(GUILD);
    expect(mgr.active(GUILD)).toBe(true);
    // But the guild being removed (endGuild) ends it anyway (no leak).
    mgr.endGuild(GUILD);
    expect(mgr.active(GUILD)).toBe(false);
  });

  it('ctx.say uses the player; without a player returns false', async () => {
    const say = vi.fn(async () => true);
    let hasPlayer = true;
    env = makeEnv({ getPlayer: () => (hasPlayer ? { say } : undefined) });
    mgr = new GameManager(env);
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    await expect(g.ctx!.say('ola', { model: 'de_DE-thorsten-medium' })).resolves.toBe(true);
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'ola', model: 'de_DE-thorsten-medium', singleVoice: true }),
    );
    hasPlayer = false;
    await expect(g.ctx!.say('sem call')).resolves.toBe(false);
  });

  it('a message from outside the call is still consumed as text but cannot invoke player.say', async () => {
    const say = vi.fn(async () => true);
    env = makeEnv({ getPlayer: () => ({ say }) });
    mgr = new GameManager(env);
    const g: Game = {
      id: 'speech-on-message',
      start: () => {},
      onMessage: async (ctx) => {
        await ctx.say('should stay text-only');
      },
    };
    mgr.start(GUILD, CHAN, g);
    await flush();
    expect(
      mgr.handleMessage({
        guildId: GUILD,
        channelId: CHAN,
        authorId: 'outside',
        authorName: 'Outside',
        content: 'answer',
        canTriggerSpeech: false,
      }),
    ).toBe(true);
    await flush();
    expect(say).not.toHaveBeenCalled();
  });

  it('ctx.send delegates to the env sendToChannel (with the game channel)', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, CHAN, g);
    await flush();
    await g.ctx!.send('mensagem');
    expect(env.sendToChannel).toHaveBeenCalledWith(CHAN, 'mensagem');
  });

  it('a throw inside the game does not escape (is logged)', async () => {
    const boom: Game = {
      id: 'boom',
      start: () => {
        throw new Error('crash no start');
      },
      onMessage: () => {},
    };
    mgr.start(GUILD, CHAN, boom);
    await flush();
    expect(env.logError).toHaveBeenCalled();
  });
});

// ── Games in a disposable THREAD (large servers) ──────────────────────────
const THREAD = 't1';
const PARENT = 'c1';
describe('GameManager — game in a disposable thread', () => {
  let env: GameEnv;
  let clock: FakeClock;
  let deleteChannel: ReturnType<typeof vi.fn>;
  let mgr: GameManager;
  beforeEach(() => {
    deleteChannel = vi.fn(async () => {});
    // translate that includes the params, so we can verify the winner in the summary.
    env = makeEnv({
      deleteChannel,
      translate: (key, _loc, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    });
    clock = env.clock as FakeClock;
    mgr = new GameManager(env);
  });

  it('the game runs on the THREAD channelId; thread messages are forwarded', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, THREAD, g, false, 'en', PARENT);
    await flush();
    expect(mgr.channelOf(GUILD)).toBe(THREAD);
    // Message IN the thread -> consumed; in the parent channel -> NOT (it's the normal chat).
    expect(
      mgr.handleMessage({
        guildId: GUILD,
        channelId: THREAD,
        authorId: 'u',
        authorName: 'U',
        content: 'ola',
        canTriggerSpeech: true,
      }),
    ).toBe(true);
    expect(
      mgr.handleMessage({
        guildId: GUILD,
        channelId: PARENT,
        authorId: 'u',
        authorName: 'U',
        content: 'oi',
        canTriggerSpeech: true,
      }),
    ).toBe(false);
    await flush();
    expect(g.messages).toEqual(['ola']);
  });

  it('normal end: WINNER summary goes to the parent channel and the thread is deleted 5s later', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, THREAD, g, false, 'en', PARENT);
    await flush();
    g.ctx!.award('a', 2);
    g.ctx!.award('b', 9); // b wins
    g.ctx!.end();

    // Summary in the PARENT (not the thread), with the mention of winner 'b'.
    const send = env.sendToChannel as ReturnType<typeof vi.fn>;
    const parentCall = send.mock.calls.find((c) => c[0] === PARENT);
    expect(parentCall).toBeDefined();
    expect(String(parentCall![1])).toContain('game.thread.winner');
    expect(String(parentCall![1])).toContain('<@b>');
    // The thread has NOT been deleted yet.
    expect(deleteChannel).not.toHaveBeenCalled();
    clock.advance(5000);
    expect(deleteChannel).toHaveBeenCalledWith(THREAD);
    // Points persisted (normal end).
    expect(env.persistScores).toHaveBeenCalledTimes(1);
  });

  it('aborted (stop, no points): "ended" summary in the parent + deletes the thread', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, THREAD, g, false, 'en', PARENT);
    await flush();
    mgr.stop(GUILD);
    const send = env.sendToChannel as ReturnType<typeof vi.fn>;
    const parentCall = send.mock.calls.find((c) => c[0] === PARENT);
    expect(String(parentCall![1])).toContain('game.thread.ended');
    clock.advance(5000);
    expect(deleteChannel).toHaveBeenCalledWith(THREAD);
    expect(env.persistScores).not.toHaveBeenCalled();
  });

  it('WITHOUT a thread (parentChannelId undefined): does not announce in the parent nor delete the channel', async () => {
    const g = new SpyGame();
    mgr.start(GUILD, PARENT, g, false, 'en'); // no parentChannelId
    await flush();
    g.ctx!.award('a', 1);
    g.ctx!.end();
    // The only send would be from the game itself (here it sends nothing); no delete scheduled.
    clock.advance(5000);
    expect(deleteChannel).not.toHaveBeenCalled();
  });

  it('degrades without env.deleteChannel: announces in the parent but does not try to delete', async () => {
    const noDelete = makeEnv({ translate: (k, _l, p) => (p ? `${k} ${JSON.stringify(p)}` : k) });
    const c = noDelete.clock as FakeClock;
    const m = new GameManager(noDelete);
    const g = new SpyGame();
    m.start(GUILD, THREAD, g, false, 'en', PARENT);
    await flush();
    g.ctx!.end();
    expect(noDelete.sendToChannel).toHaveBeenCalled();
    // Without deleteChannel in the env, no delete timer was scheduled.
    expect(c.pending()).toBe(0);
  });
});
