import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../src/games/manager';
import type { Clock, GameEnv, Sendable, TimerHandle } from '../src/games/types';
import type { SynthRequest } from '../src/tts/engine';
import { gameById } from '../src/games/index';
import { makeRng } from '../src/games/util';

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

function harness() {
  const clock = new FakeClock();
  const say = vi.fn(async (_req: SynthRequest) => true);
  const send = vi.fn(async (_channelId: string, _content: Sendable) => {});
  const persistScores = vi.fn((_guildId: string, _points: Map<string, number>) => {});
  const env: GameEnv = {
    clock,
    availableModels: ['en_US-amy-medium'],
    defaultSpeed: 1,
    defaultVoiceOf: () => 'en_US-amy-medium',
    getPlayer: () => ({ say }),
    sendToChannel: send,
    localeOf: () => 'en',
    translate: (key, _l, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    persistScores,
    logError: vi.fn(),
  };
  return { env, clock, say, send, persistScores };
}

const G = 'g1';
const C = 'c1';
const ROUNDS = 5;
// Pace of one round: guess window (8s) + pause between rounds (2.5s).
const ROUND_MS = 8_000 + 2_500;

/** Predicted flips: the game uses makeRng(seed) and draws 1 number per round (seed = now() at start). */
function predictedFlips(seed: number): ('heads' | 'tails')[] {
  const rng = makeRng(seed);
  return Array.from({ length: ROUNDS }, () => (rng() % 2 === 0 ? 'heads' : 'tails'));
}

function msg(authorId: string, authorName: string, content: string) {
  return { guildId: G, channelId: C, authorId, authorName, content, canTriggerSpeech: true };
}

describe('Heads or Tails', () => {
  it('whoever gets it right scores; whoever is wrong does not; 5 full rounds', async () => {
    const { env, clock, send, persistScores } = harness();
    const flips = predictedFlips(clock.now()); // seed = now() at start
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('headsOrTails')!.create());
    await flush();

    for (let r = 0; r < ROUNDS; r++) {
      // "Winner" writes the correct side; "Loser" the opposite — within the window.
      const right = flips[r];
      const wrong = right === 'heads' ? 'tails' : 'heads';
      mgr.handleMessage(msg('winner', 'W', right));
      mgr.handleMessage(msg('loser', 'L', wrong));
      await flush();
      clock.advance(ROUND_MS);
      await flush();
    }

    const sent = send.mock.calls.map((c) => String(c[1]));
    expect(sent.some((s) => s.includes('game.headsOrTails.winners'))).toBe(true);
    expect(persistScores).toHaveBeenCalledTimes(1);
    const points = persistScores.mock.calls[0][1] as Map<string, number>;
    expect(points.get('winner')).toBe(ROUNDS);
    expect(points.get('loser')).toBeUndefined();
  });

  it('only the FIRST guess of the round counts (changing it afterwards is invalid)', async () => {
    const { env, clock, persistScores } = harness();
    const flips = predictedFlips(clock.now());
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('headsOrTails')!.create());
    await flush();

    for (let r = 0; r < ROUNDS; r++) {
      const right = flips[r];
      const wrong = right === 'heads' ? 'tails' : 'heads';
      // Guesses RIGHT first, then tries to change to the wrong one — the 1st stays.
      mgr.handleMessage(msg('sticky', 'S', right));
      mgr.handleMessage(msg('sticky', 'S', wrong));
      await flush();
      clock.advance(ROUND_MS);
      await flush();
    }
    const points = persistScores.mock.calls[0][1] as Map<string, number>;
    expect(points.get('sticky')).toBe(ROUNDS);
  });

  it('nobody guesses -> noWinners, no crash, game ends', async () => {
    const { env, clock, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('headsOrTails')!.create());
    await flush();

    for (let r = 0; r < ROUNDS; r++) {
      clock.advance(ROUND_MS);
      await flush();
    }
    const sent = send.mock.calls.map((c) => String(c[1]));
    expect(sent.some((s) => s.includes('game.headsOrTails.noWinners'))).toBe(true);
    // With no points the manager (correctly) persists nothing — but the game MUST have
    // ended and released the guild lock.
    expect(persistScores).not.toHaveBeenCalled();
    expect(mgr.active(G)).toBe(false);
  });

  it('chatter that is not a guess is ignored (does not count as a choice)', async () => {
    const { env, clock, persistScores } = harness();
    const flips = predictedFlips(clock.now());
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('headsOrTails')!.create());
    await flush();

    for (let r = 0; r < ROUNDS; r++) {
      mgr.handleMessage(msg('chatter', 'Ch', 'lol what is this game'));
      mgr.handleMessage(msg('player', 'P', flips[r]));
      await flush();
      clock.advance(ROUND_MS);
      await flush();
    }
    const points = persistScores.mock.calls[0][1] as Map<string, number>;
    expect(points.get('chatter')).toBeUndefined();
    expect(points.get('player')).toBe(ROUNDS);
  });
});
