import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const PT_VOICE = 'pt_BR-faber-medium';
function harness() {
  const clock = new FakeClock();
  const say = vi.fn(async () => true);
  const send = vi.fn(async () => {});
  const persistScores = vi.fn();
  const logError = vi.fn();
  const env: GameEnv = {
    clock,
    availableModels: [PT_VOICE, 'en_US-amy-medium'],
    defaultSpeed: 1,
    defaultVoiceOf: () => 'en_US-amy-medium',
    getPlayer: () => ({ say }),
    sendToChannel: send,
    localeOf: () => 'en',
    translate: (key, _l, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    persistScores,
    logError,
  };
  return { env, clock, say, send, persistScores, logError };
}

const G = 'g1';
const C = 'c1';
const msg = (authorId: string, content: string) => ({
  guildId: G,
  channelId: C,
  authorId,
  authorName: authorId.toUpperCase(),
  content,
  canTriggerSpeech: true,
});
// The last key sent and its params (the translate mock returns "key {json}").
function lastSend(send: ReturnType<typeof vi.fn>): {
  key: string;
  params: Record<string, unknown>;
} {
  const raw = String(send.mock.calls.at(-1)?.[1] ?? '');
  const sp = raw.indexOf(' ');
  const key = sp === -1 ? raw : raw.slice(0, sp);
  let params: Record<string, unknown> = {};
  try {
    params = sp === -1 ? {} : JSON.parse(raw.slice(sp + 1));
  } catch {
    /* no params */
  }
  return { key, params };
}
const sentKeys = (send: ReturnType<typeof vi.fn>): string[] =>
  send.mock.calls.map((c) => String(c[1]).split(' ')[0]);

// Index: first letter -> a real, short PT word (>=5 letters, to pass any minimum).
let wordByLetter: Map<string, string[]>;
beforeAll(() => {
  const file = join(__dirname, '..', 'assets', 'wordlists', 'pt.txt');
  // Split on /\r?\n/ (NOT just '\n'): in a CRLF checkout (Windows, core.autocrlf=true)
  // '\n' would leave a trailing '\r' on the word (e.g. "gabar\r"). That word is used as
  // the message content AND in the say({ text: word }) assertion; the game speaks the
  // normalized form (without '\r'), so the assertion would never match and say would not
  // be detected — the root cause of the flaky test (0 calls to say). On LF it is byte-for-byte identical.
  const words = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  wordByLetter = new Map();
  for (const w of words) {
    if (w.length < 5 || w.length > 9) continue;
    const arr = wordByLetter.get(w[0]) ?? [];
    if (arr.length < 30) arr.push(w);
    wordByLetter.set(w[0], arr);
  }
});
/** A real PT word starting with `letter` and not yet used in `used`. */
function pickWord(letter: string, used: Set<string>): string {
  const arr = wordByLetter.get(letter.toLowerCase()) ?? [];
  const w = arr.find((x) => !used.has(x));
  if (!w) throw new Error(`sem palavra PT para a letra ${letter}`);
  return w;
}

describe('word-chain — integration (manager + fake clock, real PT wordlist)', () => {
  it('lobby: <2 players -> cancels', async () => {
    const { env, clock, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('word-chain')!.create({ language: 'pt' }), false, 'pt');
    await flush();
    mgr.handleMessage(msg('u1', 'eu')); // only 1 player
    await flush();
    clock.advance(20000);
    await flush();
    expect(sentKeys(send)).toContain('game.wordChain.notEnough');
    expect(mgr.active(G)).toBe(false);
  });

  it('welcome spoken in the PT voice + accepted word is read aloud', async () => {
    const { env, clock, send, say } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('word-chain')!.create({ language: 'pt' }), false, 'pt');
    await flush();
    mgr.handleMessage(msg('u1', 'entro'));
    mgr.handleMessage(msg('u2', 'eu tambem'));
    await flush();
    clock.advance(20000); // end of lobby -> starts
    await flush();

    // Welcome spoken in the PT voice (player.say receives a full SynthRequest).
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Bem-vindos'), model: PT_VOICE }),
    );
    expect(sentKeys(send)).toContain('game.wordChain.begin');

    // Turn announced: extract the required letter and play a valid PT word.
    const turn = lastSend(send);
    expect(turn.key).toBe('game.wordChain.turn');
    const letter = String(turn.params.letter);
    const word = pickWord(letter, new Set());
    say.mockClear();
    mgr.handleMessage(msg('u1', word)); // u1 is first in order
    await flush();

    // The accepted word was READ aloud in the PT voice + acceptance message.
    expect(say).toHaveBeenCalledWith(expect.objectContaining({ text: word, model: PT_VOICE }));
    expect(sentKeys(send)).toContain('game.wordChain.accepted');
  });

  it('spectator message (not their turn) is ignored', async () => {
    const { env, clock, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('word-chain')!.create({ language: 'pt' }), false, 'pt');
    await flush();
    mgr.handleMessage(msg('u1', 'a'));
    mgr.handleMessage(msg('u2', 'b'));
    await flush();
    clock.advance(20000);
    await flush();
    const before = send.mock.calls.length;
    // u2 speaks out of turn (it's u1's turn) -> nothing happens.
    mgr.handleMessage(msg('u2', 'palavra'));
    await flush();
    expect(send.mock.calls.length).toBe(before);
  });

  it('reentrancy: two valid guesses in a row from the SAME player do not score/advance twice', async () => {
    const { env, clock, send, say } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('word-chain')!.create({ language: 'pt' }), false, 'pt');
    await flush();
    mgr.handleMessage(msg('u1', 'entro'));
    mgr.handleMessage(msg('u2', 'eu tambem'));
    await flush();
    clock.advance(20000); // end of lobby -> u1's turn
    await flush();

    const turn1 = lastSend(send);
    expect(turn1.key).toBe('game.wordChain.turn');
    const letter1 = String(turn1.params.letter).toLowerCase();

    // Picks a chainable pair: word1 (for the required letter) whose LAST letter has a
    // follow-up word2 — so both guesses would be individually valid, isolating the race.
    let word1 = '';
    let word2 = '';
    for (const cand of wordByLetter.get(letter1) ?? []) {
      const arr = (wordByLetter.get(cand[cand.length - 1]) ?? []).filter((w) => w !== cand);
      if (arr.length) {
        word1 = cand;
        word2 = arr[0];
        break;
      }
    }
    expect(word1 && word2).toBeTruthy();

    say.mockClear();
    // Race: u1 fires TWO valid guesses back-to-back, with NO flush in between, so the
    // second onMessage runs while the first handleGuess is suspended at `await ctx.send`.
    mgr.handleMessage(msg('u1', word1));
    mgr.handleMessage(msg('u1', word2));
    await flush();

    // Only the first guess must count: the word is read aloud exactly ONCE and the turn
    // moves to u2 (not back to u1 via a double idx-advance).
    const sayCalls = say.mock.calls as unknown as Array<[{ text?: string }]>;
    const wordSays = sayCalls.filter(
      (c) => typeof c[0]?.text === 'string' && /\S/.test(c[0].text ?? ''),
    );
    expect(wordSays.length).toBe(1);
    const turn2 = lastSend(send);
    expect(turn2.key).toBe('game.wordChain.turn');
    expect(turn2.params.name).toBe('U2');
  });

  it('2 lives: timeouts eliminate and declare a winner (scores persisted)', async () => {
    const { env, clock, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('word-chain')!.create({ language: 'pt' }), false, 'pt');
    await flush();
    mgr.handleMessage(msg('u1', 'a'));
    mgr.handleMessage(msg('u2', 'b'));
    await flush();
    clock.advance(20000);
    await flush();
    // Nobody plays: 3 timeouts (turnMs fixed at 15s with no accepted words).
    // u1 timeout (1 life) -> u2 timeout (1 life) -> u1 timeout (0 -> eliminated) -> u2 wins.
    for (let k = 0; k < 3; k++) {
      clock.advance(15000);
      await flush();
    }
    expect(sentKeys(send)).toContain('game.wordChain.eliminated');
    expect(sentKeys(send)).toContain('game.wordChain.winner');
    expect(mgr.active(G)).toBe(false);
    expect(persistScores).toHaveBeenCalledTimes(1); // NORMAL end -> persists
    const points = persistScores.mock.calls[0][1] as Map<string, number>;
    expect(points.get('u2') ?? 0).toBeGreaterThan(0); // winner scored
  });
});
