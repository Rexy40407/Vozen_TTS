import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../src/games/manager';
import type { Clock, GameEnv, Sendable, TimerHandle } from '../src/games/types';
import { gameById } from '../src/games/index';
import { wordsForLocale } from '../src/games/content/words';
import { pickWordleWords } from '../src/games/content/wordleWords';
import { normalizeAnswer, seededIndex } from '../src/games/util';
import { CHESS_EMOJI_NAMES } from '../src/games/boardEmojis';

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
  // Typed params for the tests' typecheck: without them, .mock.calls is an empty tuple
  // and c[1] / calls[0][1] raise TS2493 (real signatures in GameEnv).
  const send = vi.fn(async (_channelId: string, _content: Sendable) => {});
  const persistScores = vi.fn((_guildId: string, _points: Map<string, number>) => {});
  const logError = vi.fn();
  const env: GameEnv = {
    clock,
    availableModels: ['en_US-amy-medium'],
    defaultSpeed: 1,
    defaultVoiceOf: () => 'en_US-amy-medium',
    getPlayer: () => undefined, // board games do not speak
    sendToChannel: send,
    localeOf: () => 'en',
    translate: (key, _l, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    persistScores,
    logError,
  };
  return { env, clock, send, persistScores, logError };
}

const G = 'g1';
const C = 'c1';
const say = (mgr: GameManager, authorId: string, content: string): void => {
  mgr.handleMessage({
    guildId: G,
    channelId: C,
    authorId,
    authorName: authorId,
    content,
    canTriggerSpeech: true,
  });
};
// The session seed = clock.now() at start = 0 (FakeClock starts at 0).
const SEED = 0;

describe('Hangman', () => {
  it('guessing the whole word wins the point', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('hangman')!.create());
    await flush();
    const { words } = wordsForLocale('en');
    const word = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    say(mgr, 'u', word);
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.hangman.win'))).toBe(true);
    expect(persistScores.mock.calls[0][1].get('u')).toBe(1);
    expect(mgr.active(G)).toBe(false);
  });

  it('6 wrong letters -> loss, no points', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('hangman')!.create());
    await flush();
    const { words } = wordsForLocale('en');
    const word = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    const wrong = 'qwertyuiopasdfghjklzxcvbnm'
      .split('')
      .filter((l) => !word.includes(l))
      .slice(0, 6);
    for (const l of wrong) {
      say(mgr, 'u', l);
      await flush();
    }
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.hangman.lose'))).toBe(true);
    expect(persistScores).not.toHaveBeenCalled();
    expect(mgr.active(G)).toBe(false);
  });

  it('with tiles installed: shows the hangman figure at the right stage (number of wrong guesses)', async () => {
    const { env, send } = harness();
    env.boardEmojis = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [`h${i}`, `<:h${i}:1234567890123456789>`]),
    );
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('hangman')!.create());
    await flush();
    const { words } = wordsForLocale('en');
    const word = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    // Start: 0 wrong -> stage h0 (just the gallows).
    expect(String(send.mock.calls[0][1])).toContain('<:h0:');
    // One wrong letter -> stage h1.
    const wrong = 'qwertyuiopasdfghjklzxcvbnm'.split('').find((l) => !word.includes(l))!;
    say(mgr, 'u', wrong);
    await flush();
    expect(String(send.mock.calls[send.mock.calls.length - 1][1])).toContain('<:h1:');
  });
});

describe('Termo/Wordle', () => {
  it('guessing the 5-letter word wins; non-5-letter messages are ignored', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('wordle')!.create());
    await flush();
    // Any chat (not 5 letters) does not count as a guess.
    say(mgr, 'u', 'ola pessoal');
    await flush();
    const { words } = pickWordleWords('en');
    const target = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    say(mgr, 'u', target);
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).includes('game.wordle.win'))).toBe(true);
    expect(persistScores.mock.calls[0][1].get('u')).toBe(1);
  });

  it('wrong guess shows the colored letters (ansi block) and counts an attempt', async () => {
    const { env, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('wordle')!.create());
    await flush();
    const { words } = pickWordleWords('en');
    const target = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    // A 5-letter guess different from the target (guarantees ≠).
    const guess = target === 'zzzzz' ? 'aaaaa' : 'zzzzz';
    say(mgr, 'u', guess);
    await flush();
    const guessMsg = send.mock.calls
      .map((c) => String(c[1]))
      .find((s) => s.includes('game.wordle.guess'));
    expect(guessMsg).toBeDefined();
    // The colored letters come in a ```ansi block with the guess's letters (uppercase).
    expect(guessMsg).toContain('```ansi');
    expect(guessMsg).toContain(guess.toUpperCase()[0]);
    expect(mgr.active(G)).toBe(true); // still in progress
  });

  it('shows the keyboard with the discarded letters (out) after a guess', async () => {
    const { env, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('wordle')!.create());
    await flush();
    const { words } = pickWordleWords('en');
    const target = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    // A 5-letter guess whose letters are NOT in the target -> all become "out".
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const notInTarget = alphabet
      .filter((l) => !target.includes(l))
      .slice(0, 5)
      .join('');
    say(mgr, 'u', notInTarget);
    await flush();
    const guessMsg = send.mock.calls
      .map((c) => String(c[1]))
      .find((s) => s.includes('game.wordle.guess'));
    expect(guessMsg).toContain('game.wordle.out'); // line of discarded letters
    // The 1st discarded letter appears in the "out" line.
    expect(guessMsg).toContain(notInTarget[0].toUpperCase());
  });

  // Map of the 78 wordle tiles: w{g|y|x}{a-z} -> markup with a 19-digit id.
  const fakeWordleMap = (): Record<string, string> => {
    const m: Record<string, string> = {};
    for (const s of ['g', 'y', 'x']) {
      for (const l of 'abcdefghijklmnopqrstuvwxyz')
        m[`w${s}${l}`] = `<:w${s}${l}:1234567890123456789>`;
    }
    return m;
  };

  it('with tiles installed: emoji grid (5 per guess, accumulates), no ansi block', async () => {
    const { env, send } = harness();
    env.boardEmojis = fakeWordleMap();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('wordle')!.create());
    await flush();
    const { words } = pickWordleWords('en');
    const target = normalizeAnswer(words[seededIndex(SEED, words.length)]);
    const g1 = target === 'zzzzz' ? 'aaaaa' : 'zzzzz';
    const g2 = target === 'qqqqq' ? 'bbbbb' : 'qqqqq';
    say(mgr, 'u', g1);
    await flush();
    const msg1 = send.mock.calls
      .map((c) => String(c[1]))
      .find((s) => s.includes('game.wordle.guess'));
    expect(msg1).toBeDefined();
    expect(msg1).not.toContain('```ansi'); // no longer the fallback
    expect((msg1!.match(/<:w[gyx]/g) ?? []).length).toBe(5); // 1 guess = 5 tiles
    // 2nd guess -> the grid accumulates to 10 tiles.
    say(mgr, 'u', g2);
    await flush();
    const msg2 = send.mock.calls
      .map((c) => String(c[1]))
      .reverse()
      .find((s) => s.includes('game.wordle.guess'));
    expect((msg2!.match(/<:w[gyx]/g) ?? []).length).toBe(10);
  });
});

describe('Tic-tac-toe', () => {
  it('X makes a line and wins; playing out of turn is refused', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('tictactoe')!.create());
    await flush();
    // X (ana) plays 1; ana tries to play again out of turn -> refused.
    say(mgr, 'ana', '1');
    await flush();
    say(mgr, 'ana', '2');
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.tictactoe.notYourTurn'))).toBe(
      true,
    );
    // O (rui) plays 4; follows the sequence until X makes the line 1-2-3.
    say(mgr, 'rui', '4');
    await flush();
    say(mgr, 'ana', '2');
    await flush();
    say(mgr, 'rui', '5');
    await flush();
    say(mgr, 'ana', '3');
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.tictactoe.win'))).toBe(true);
    expect(persistScores.mock.calls[0][1].get('ana')).toBe(1);
    expect(mgr.active(G)).toBe(false);
  });

  it('with tiles installed: emoji grid (tx/to/numbers), no code block', async () => {
    const { env, send } = harness();
    env.boardEmojis = {
      tx: '<:tx:1234567890123456789>',
      to: '<:to:1234567890123456789>',
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`t${i + 1}`, `<:t${i + 1}:1234567890123456789>`]),
      ),
    };
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('tictactoe')!.create());
    await flush();
    say(mgr, 'ana', '1'); // X plays on square 1
    await flush();
    const msg = send.mock.calls
      .map((c) => String(c[1]))
      .reverse()
      .find((s) => s.includes('game.tictactoe.turn'));
    expect(msg).toBeDefined();
    expect(msg).not.toContain('```'); // no longer the ASCII
    expect(msg).toContain('<:tx:'); // X's move appears as a tile
    expect((msg!.match(/<:t/g) ?? []).length).toBe(9); // 9 squares, each one a tile
  });

  it('full board with no line -> draw, no points', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('tictactoe')!.create());
    await flush();
    // Known "cat's game" sequence (X starts): X:1 O:3 X:2 O:4 X:6 O:5 X:7 O:8 X:9.
    // Result: X on 1,2,6,7,9 and O on 3,4,5,8 — 9 squares, no line.
    const seq: [string, string][] = [
      ['ana', '1'],
      ['rui', '3'],
      ['ana', '2'],
      ['rui', '4'],
      ['ana', '6'],
      ['rui', '5'],
      ['ana', '7'],
      ['rui', '8'],
      ['ana', '9'],
    ];
    for (const [u, n] of seq) {
      say(mgr, u, n);
      await flush();
    }
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.tictactoe.draw'))).toBe(true);
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.tictactoe.win'))).toBe(false);
    expect(persistScores).not.toHaveBeenCalled();
    expect(mgr.active(G)).toBe(false);
  });

  it('a 3rd player is a spectator (does not take a square)', async () => {
    const { env, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('tictactoe')!.create());
    await flush();
    say(mgr, 'ana', '1'); // X
    await flush();
    say(mgr, 'rui', '2'); // O
    await flush();
    say(mgr, 'carlos', '3'); // spectator -> ignored
    await flush();
    say(mgr, 'ana', '3'); // X can play 3 (it was not taken by carlos)
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.tictactoe.taken'))).toBe(
      false,
    );
    expect(mgr.active(G)).toBe(true); // still in progress
  });
});

describe('Chess', () => {
  it("fool's mate: white=first to move, black delivers checkmate in 4 moves", async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create());
    await flush();
    say(mgr, 'ana', 'f3'); // ana -> white
    await flush();
    say(mgr, 'rui', 'e5'); // rui -> black
    await flush();
    say(mgr, 'ana', 'g4');
    await flush();
    say(mgr, 'rui', 'Qh4'); // checkmate
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.chess.checkmate'))).toBe(true);
    expect(persistScores.mock.calls[0][1].get('rui')).toBe(3); // rui (black) won
    expect(mgr.active(G)).toBe(false);
  });

  it('playing out of turn is refused; an illegal move is refused without changing the turn', async () => {
    const { env, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create());
    await flush();
    say(mgr, 'ana', 'f3'); // ana -> white, plays
    await flush();
    say(mgr, 'ana', 'f4'); // ana tries to play again out of turn -> refused
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.chess.notYourTurn'))).toBe(
      true,
    );
    say(mgr, 'rui', 'e6'); // rui -> black, plays legally
    await flush();
    say(mgr, 'ana', 'Qh8'); // white: illegal move (queen can't reach there)
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.chess.illegalMove'))).toBe(
      true,
    );
    expect(mgr.active(G)).toBe(true); // game continues, nobody won by mistake
  });

  it('resigning ("resign") ends the game and gives the win to the opponent', async () => {
    const { env, send, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create());
    await flush();
    say(mgr, 'ana', 'f3'); // ana -> white
    await flush();
    say(mgr, 'rui', 'e5'); // rui -> black
    await flush();
    say(mgr, 'ana', 'resign');
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.chess.resigned'))).toBe(true);
    expect(persistScores.mock.calls[0][1].get('rui')).toBe(3);
    expect(mgr.active(G)).toBe(false);
  });

  it('a 3rd player is a spectator; normal chat does not count as a move', async () => {
    const { env, send } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create());
    await flush();
    say(mgr, 'ana', 'hello everyone, good luck!'); // chat, not a move -> ignored
    await flush();
    say(mgr, 'ana', 'f3'); // only now ana claims white
    await flush();
    say(mgr, 'rui', 'e5'); // rui -> black
    await flush();
    say(mgr, 'carlos', 'Nc3'); // spectator (seats full) -> ignored, even though it's a valid move
    await flush();
    expect(send.mock.calls.some((c) => String(c[1]).startsWith('game.chess.illegalMove'))).toBe(
      false,
    );
    expect(mgr.active(G)).toBe(true); // still in progress, white's turn
  });

  // Name->markup map of the 26 emojis, with 19-digit IDs (like the real ones) so the
  // length test reflects the true 2000-char budget.
  const fakeEmojiMap = (): Record<string, string> =>
    Object.fromEntries(CHESS_EMOJI_NAMES.map((n) => [n, `<:${n}:1234567890123456789>`]));

  it('emoji render: 64 squares, correct light/dark alternation, fits in <2000 chars', async () => {
    const { env, send } = harness();
    env.boardEmojis = fakeEmojiMap();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create());
    await flush();
    const msg = String(send.mock.calls[0][1]);
    // New match = 64 squares + 8 file-label tiles = 72 emojis.
    expect((msg.match(/<:/g) ?? []).length).toBe(72);
    // Piece×square mapping: a8 (top-left corner) is a LIGHT square -> light black rook (brl);
    // b8 is dark -> dark black knight (bnd); a1 is dark -> dark white rook (wrd).
    expect(msg).toContain('<:brl:');
    expect(msg).toContain('<:bnd:');
    expect(msg).toContain('<:wrd:');
    // File labels are their own tiles (fa..fh), NOT regional indicators
    // (those would combine into flags: 🇨🇩=Congo, 🇬🇭=Ghana).
    expect(msg).toContain('<:fa:');
    expect(msg).toContain('<:fh:');
    expect(msg).not.toContain('🇦');
    // Discord budget (UTF-16 length is a conservative limit vs code points).
    expect(msg.length).toBeLessThan(2000);
  });

  it('without emojis installed: falls back to the ASCII board (code block), no emoji markup', async () => {
    const { env, send } = harness(); // the normal harness does NOT set boardEmojis
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('chess')!.create());
    await flush();
    const msg = String(send.mock.calls[0][1]);
    expect(msg).toContain('```'); // ASCII code block
    expect(msg).not.toContain('<:'); // no custom emoji
  });
});
