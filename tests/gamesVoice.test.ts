import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../src/games/manager';
import type { Clock, GameEnv, Sendable, TimerHandle } from '../src/games/types';
import type { SynthRequest } from '../src/tts/engine';
import { GAME_DEFS, gameById } from '../src/games/index';
import { firstInteger, makeRng, jaccard } from '../src/games/util';

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

function harness(overrides: Partial<GameEnv> = {}) {
  const clock = new FakeClock();
  // Params tipados p/ o typecheck: sem eles, .mock.calls fica tuplo vazio (TS2493/2352).
  const say = vi.fn(async (_req: SynthRequest) => true);
  const send = vi.fn(async (_channelId: string, _content: Sendable) => {});
  const persistScores = vi.fn((_guildId: string, _points: Map<string, number>) => {});
  const logError = vi.fn();
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
    // translate falso: key + params serializados (para os testes lerem os params).
    translate: (key, _locale, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    persistScores,
    logError,
    ...overrides,
  };
  return { env, clock, say, send, persistScores, logError };
}

const G = 'g1';
const C = 'c1';
/** Texto do ultimo ctx.say (o "enigma" da ronda). */
const lastSayText = (say: ReturnType<typeof vi.fn>): string =>
  (say.mock.calls[say.mock.calls.length - 1][0] as { text: string }).text;

describe('jogos de voz — smoke (todos arrancam e terminam sem crashar)', () => {
  for (const def of GAME_DEFS) {
    it(`${def.id}: arranca, esgota as rondas por timeout e termina limpo`, async () => {
      const { env, clock, logError } = harness();
      const mgr = new GameManager(env);
      mgr.start(G, C, def.create());
      await flush();
      // Avanca o relogio muito para la de qualquer round-limit, varias vezes, para
      // esgotar TODAS as rondas por timeout ate a partida terminar.
      // 12x30s=360s cobre o idle mais longo registado (xadrez, 300s).
      for (let i = 0; i < 12; i++) {
        clock.advance(30_000);
        await flush();
      }
      expect(mgr.active(G)).toBe(false);
      expect(logError).not.toHaveBeenCalled();
    });
  }
});

describe('Matemática Falada — acerto', () => {
  it('aceita o resultado correto e pontua', async () => {
    const { env, send, persistScores, say } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('math')!.create());
    await flush();

    // Responde certo a cada ronda: o resultado sai dos params do announce (a op b).
    for (let r = 0; r < 5; r++) {
      // Ultimo announce = game.math.round {"n":..,"a":..,"op":"+","b":..}
      const roundMsg = [...send.mock.calls]
        .reverse()
        .find((c) => String(c[1]).startsWith('game.math.round'));
      const params = JSON.parse(String(roundMsg![1]).slice('game.math.round '.length)) as {
        a: number;
        op: string;
        b: number;
      };
      const result =
        params.op === '+'
          ? params.a + params.b
          : params.op === '−'
            ? params.a - params.b
            : params.a * params.b;
      mgr.handleMessage({
        guildId: G,
        channelId: C,
        authorId: 'u',
        authorName: 'U',
        content: `${result}`,
        canTriggerSpeech: true,
      });
      await flush();
    }
    expect(persistScores).toHaveBeenCalledTimes(1);
    const [, points] = persistScores.mock.calls[0];
    expect(points.get('u')).toBe(5);
    // On-brand: o Vozen anuncia o vencedor em VOZ ALTA no fim.
    expect(
      say.mock.calls.some((c) =>
        String((c[0] as { text: string }).text).startsWith('game.finish.winnerVoice'),
      ),
    ).toBe(true);
  });
});

describe('Ditado — acerto', () => {
  it('aceita a palavra dita (normalizada) e pontua', async () => {
    const { env, say, persistScores } = harness();
    const mgr = new GameManager(env);
    mgr.start(G, C, gameById('spelling')!.create());
    await flush();
    for (let r = 0; r < 5; r++) {
      const word = lastSayText(say); // o que o bot disse = a palavra a escrever
      mgr.handleMessage({
        guildId: G,
        channelId: C,
        authorId: 'u',
        authorName: 'U',
        content: word,
        canTriggerSpeech: true,
      });
      await flush();
    }
    expect(persistScores).toHaveBeenCalledTimes(1);
    expect(persistScores.mock.calls[0][1].get('u')).toBe(5);
  });
});

describe('util dos jogos', () => {
  it('firstInteger extrai o 1o inteiro', () => {
    expect(firstInteger('= 51')).toBe(51);
    expect(firstInteger('acho que 42!')).toBe(42);
    expect(firstInteger('sem numeros')).toBeNull();
    expect(firstInteger('-7 graus')).toBe(-7);
  });
  it('makeRng e determinista para a mesma semente', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('jaccard: identico=1, disjunto=0, tolerante a gralhas', () => {
    expect(jaccard('o gato dormiu', 'o gato dormiu')).toBe(1);
    expect(jaccard('abc', 'xyz')).toBe(0);
    expect(jaccard('o gato dormiu no sofa', 'o gato dormiu no sofá')).toBeGreaterThanOrEqual(0.7);
  });
});
