import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { firstInteger, makeRng } from './util';

const ROUNDS = 5;

interface Problem {
  a: number;
  b: number;
  op: 'plus' | 'minus' | 'times';
  sym: string;
  result: number;
}

/**
 * "Matematica Falada" — o Vozen diz uma conta em voz alta (na voz da guild) e o 1o a
 * escrever o resultado ganha. Conteudo GERADO (seeded), independente de lingua a menos
 * das palavras "mais/menos/vezes" (localizadas). A resposta e um numero (aceita o
 * primeiro inteiro da mensagem, para "= 51" ou "51" funcionarem).
 */
class MathGame extends QuizGame {
  readonly id = 'math';
  protected roundMs = 20_000;
  private problems: Problem[] = [];

  protected prepare(ctx: GameContext): number {
    const rng = makeRng(ctx.seed);
    const ops: Problem['op'][] = ['plus', 'minus', 'times'];
    for (let i = 0; i < ROUNDS; i++) {
      const op = ops[rng() % 3];
      let a: number;
      let b: number;
      let result: number;
      let sym: string;
      if (op === 'plus') {
        a = (rng() % 40) + 10;
        b = (rng() % 40) + 10;
        result = a + b;
        sym = '+';
      } else if (op === 'minus') {
        a = (rng() % 40) + 20;
        b = rng() % a; // b < a -> resultado nao-negativo
        result = a - b;
        sym = '−';
      } else {
        a = (rng() % 11) + 2;
        b = (rng() % 11) + 2;
        result = a * b;
        sym = '×';
      }
      this.problems.push({ a, b, op, sym, result });
    }
    return ROUNDS;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.finish.noScores'); // nunca chamado (ha sempre conteudo)
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.math.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const p = this.problems[index];
    const opWord = ctx.t(`game.math.${p.op}`);
    return {
      speak: { text: `${p.a} ${opWord} ${p.b}` },
      announce: ctx.t('game.math.round', {
        n: index + 1,
        total: ROUNDS,
        a: p.a,
        op: p.sym,
        b: p.b,
      }),
      accept: (raw) => firstInteger(raw) === p.result,
      onCorrect: (user) => ctx.t('game.math.correct', { user, answer: p.result }),
      onTimeout: () => ctx.t('game.math.timeout', { answer: p.result }),
    };
  }
}

export const mathDef: GameDefinition = {
  id: 'math',
  nameKey: 'game.math.name',
  descKey: 'game.math.desc',
  needsVoice: true,
  create: () => new MathGame(),
};
