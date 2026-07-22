import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../src/games/manager';
import type { Clock, GameEnv, TimerHandle } from '../src/games/types';
import { gameById } from '../src/games/index';

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

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
}

const G = 'g1';
const C = 'c1';
function harness() {
  const clock = new FakeClock();
  const send = vi.fn(async () => {});
  const persistScores = vi.fn();
  const env: GameEnv = {
    clock,
    availableModels: ['en_US-amy-medium'],
    defaultSpeed: 1,
    defaultVoiceOf: () => 'en_US-amy-medium',
    getPlayer: () => undefined, // chess does not use voice
    sendToChannel: send,
    localeOf: () => 'en',
    translate: (key) => key, // returns the key itself -> assertions by key
    persistScores,
    logError: vi.fn(),
    // no boardEmojis -> ctx.emoji returns undefined -> ASCII render
  };
  return { env, clock, send, persistScores };
}
const msg = (authorId: string, content: string) => ({
  guildId: G,
  channelId: C,
  authorId,
  authorName: authorId.toUpperCase(),
  content,
  canTriggerSpeech: true,
});
const sentKeys = (send: ReturnType<typeof vi.fn>): string[] =>
  send.mock.calls.map((c) => String(c[1]).split(' ')[0]);

describe('chess — resign', () => {
  it('resign as the FIRST interaction does not seat anyone nor end the game silently', async () => {
    const { env, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create(), false, 'en');
    await flush();
    mgr.handleMessage(msg('u1', 'resign')); // first interaction = resign, no opponent
    await flush();
    // Must not concede to anyone nor end silently: the game stays active.
    expect(mgr.active(G)).toBe(true);
    expect(sentKeys(send)).not.toContain('game.chess.resigned');
  });

  it('resign by a SEATED player concedes to the opponent and ends', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create(), false, 'en');
    await flush();
    mgr.handleMessage(msg('u1', 'e4')); // u1 = white
    await flush();
    mgr.handleMessage(msg('u2', 'e5')); // u2 = black
    await flush();
    mgr.handleMessage(msg('u1', 'resign')); // white resigns
    await flush();
    expect(sentKeys(send)).toContain('game.chess.resigned');
    expect(mgr.active(G)).toBe(false);
    const pts = persistScores.mock.calls.at(-1)?.[1] as Map<string, number>;
    expect(pts.get('u2') ?? 0).toBe(3); // opponent (black) won
  });
});
