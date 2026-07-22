import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../src/games/manager';
import type { Clock, GameEnv, TimerHandle } from '../src/games/types';
import {
  guessLanguageDef,
  guessableLanguages,
  acceptableAnswers,
} from '../src/games/guessLanguage';
import { baseCodeOf, localizedLanguageName } from '../src/games/util';

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

// ── pure functions ───────────────────────────────────────────────────────────
describe('guessLanguage — pure functions', () => {
  it('guessableLanguages: only languages with voice AND phrase, without duplicating the base', () => {
    const models = [
      'en_US-amy-medium',
      'en_GB-alan-medium', // 2nd English voice -> same base 'en', ignored
      'de_DE-thorsten-medium',
      'xx_YY-foo-medium', // no phrase -> excluded
    ];
    const cands = guessableLanguages(models);
    expect(cands.map((c) => c.base)).toEqual(['en', 'de']);
    // The 1st voice of each base is the chosen one.
    expect(cands[0].model).toBe('en_US-amy-medium');
    // Each candidate carries SEVERAL phrases (>=3) — variety is the antidote to memorizing
    // "phrase X = language Y" (one is picked at random each round).
    expect(cands[0].phrases.length).toBeGreaterThanOrEqual(3);
    for (const p of cands[0].phrases) expect(p.length).toBeGreaterThan(0);
  });

  it('acceptableAnswers: accepts code, endonym, name in the locale and name in English', () => {
    const set = acceptableAnswers('de', 'pt');
    expect(set.has('de')).toBe(true); // code
    expect(set.has('alemao')).toBe(true); // name in PT (unaccented, normalized)
    expect(set.has('german')).toBe(true); // name in English
    expect(set.has('deutsch')).toBe(true); // endonym
  });

  it('acceptableAnswers accepts the name in SEVERAL languages (bug: "espanhol" was rejected)', () => {
    // Even with the game in English, a PT player should get it right with "espanhol".
    const set = acceptableAnswers('es', 'en');
    expect(set.has('espanhol')).toBe(true); // PT
    expect(set.has('spanish')).toBe(true); // EN
    expect(set.has('espanol')).toBe(true); // ES (endonym, unaccented)
    expect(set.has('espagnol')).toBe(true); // FR
    expect(set.has('es')).toBe(true); // code
  });
});

// ── full flow via the real manager ───────────────────────────────────────────
function makeEnv(overrides: Partial<GameEnv> = {}): {
  env: GameEnv;
  clock: FakeClock;
  say: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const clock = new FakeClock();
  const say = vi.fn(async () => true);
  const send = vi.fn(async () => {});
  const env: GameEnv = {
    clock,
    availableModels: [
      'en_US-amy-medium',
      'de_DE-thorsten-medium',
      'fr_FR-siwis-medium',
      'es_ES-davefx-medium',
      'it_IT-riccardo-medium',
      'pt_BR-faber-medium',
    ],
    defaultSpeed: 1,
    defaultVoiceOf: () => 'en_US-amy-medium',
    getPlayer: () => ({ say }),
    sendToChannel: send,
    localeOf: () => 'en',
    translate: (key, _locale, params) => `${key}${params ? ' ' + JSON.stringify(params) : ''}`,
    persistScores: vi.fn(),
    logError: vi.fn(),
    ...overrides,
  };
  return { env, clock, say, send };
}

describe('guessLanguage — full match', () => {
  it('announces rounds, accepts the correct answer and persists the points at the end', async () => {
    const { env, say } = makeEnv();
    const mgr = new GameManager(env);
    mgr.start(G, C, guessLanguageDef.create());
    await flush();

    // 6 languages -> 5 rounds (min(ROUNDS,langs)). Answer correctly each round by reading the
    // language ACTUALLY spoken (the model of the last ctx.say) and sending the name in English.
    for (let r = 0; r < 5; r++) {
      const lastSay = say.mock.calls[say.mock.calls.length - 1][0] as { model: string };
      const base = baseCodeOf(lastSay.model);
      mgr.handleMessage({
        guildId: G,
        channelId: C,
        authorId: 'u1',
        authorName: 'Ana',
        content: localizedLanguageName(base, 'en'),
        canTriggerSpeech: true,
      });
      await flush();
    }

    // Match ended -> persistScores called with u1 totaling 5 points.
    expect(env.persistScores).toHaveBeenCalledTimes(1);
    const [, points] = (env.persistScores as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(points.get('u1')).toBe(5);
    expect(mgr.active(G)).toBe(false);
  });

  it('a wrong answer does not score; the timeout advances the round', async () => {
    const { env, clock } = makeEnv();
    const mgr = new GameManager(env);
    mgr.start(G, C, guessLanguageDef.create());
    await flush();

    // Wrong guess -> ignored (no award).
    mgr.handleMessage({
      guildId: G,
      channelId: C,
      authorId: 'u',
      authorName: 'U',
      content: 'klingon',
      canTriggerSpeech: true,
    });
    await flush();

    // Exhaust the 5 rounds by TIMEOUT (25s each). Nobody scored -> does not persist.
    for (let r = 0; r < 5; r++) clock.advance(25_000);
    await flush();
    expect(env.persistScores).not.toHaveBeenCalled();
    expect(mgr.active(G)).toBe(false);
  });

  it('no playable languages -> warns and ends without crashing', async () => {
    const { env, send } = makeEnv({ availableModels: ['xx_YY-foo-medium'] });
    const mgr = new GameManager(env);
    mgr.start(G, C, guessLanguageDef.create());
    await flush();
    expect(send).toHaveBeenCalledWith(C, expect.stringContaining('game.guessLanguage.noLanguages'));
    expect(mgr.active(G)).toBe(false);
  });

  it('only the first to answer correctly wins the round point (2nd correct answer ignored)', async () => {
    const { env, say, clock } = makeEnv();
    const mgr = new GameManager(env);
    mgr.start(G, C, guessLanguageDef.create());
    await flush();
    const base = baseCodeOf(
      (say.mock.calls[say.mock.calls.length - 1][0] as { model: string }).model,
    );
    const answer = localizedLanguageName(base, 'en');
    // Two correct answers in the SAME round: only 'first' counts.
    mgr.handleMessage({
      guildId: G,
      channelId: C,
      authorId: 'first',
      authorName: 'F',
      content: answer,
      canTriggerSpeech: true,
    });
    mgr.handleMessage({
      guildId: G,
      channelId: C,
      authorId: 'second',
      authorName: 'S',
      content: answer,
      canTriggerSpeech: true,
    });
    await flush();
    // Let the remaining rounds expire by timeout so the match ends and persists.
    for (let r = 0; r < 5; r++) clock.advance(25_000);
    await flush();
    expect(env.persistScores).toHaveBeenCalledTimes(1);
    const [, points] = (env.persistScores as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(points.get('first')).toBe(1);
    expect(points.has('second')).toBe(false);
  });
});
