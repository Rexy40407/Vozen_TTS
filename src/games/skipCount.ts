import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { firstInteger, makeRng } from './util';

const ROUNDS = 5;

interface Sequence {
  spoken: string; // ex. "1, 2, 3, 5, 6" (falta o 4)
  missing: number;
}

/**
 * "Contagem Sabotada" — o Vozen conta em voz alta mas SALTA um numero de proposito; o
 * 1o a apanhar o numero em falta ganha. Conteudo GERADO (seeded), independente de
 * lingua (a voz da guild diz os digitos). Resposta = o numero saltado.
 */
class SkipCountGame extends QuizGame {
  readonly id = 'skip-count';
  protected roundMs = 20_000;
  private seqs: Sequence[] = [];

  protected prepare(ctx: GameContext): number {
    const rng = makeRng(ctx.seed);
    for (let i = 0; i < ROUNDS; i++) {
      const len = (rng() % 5) + 7; // 7..11 numeros
      // Salta um numero do MEIO (nunca o 1o nem o ultimo, para ser sempre percetivel).
      const missing = (rng() % (len - 2)) + 2; // 2..len-1
      const nums: number[] = [];
      for (let n = 1; n <= len; n++) if (n !== missing) nums.push(n);
      this.seqs.push({ spoken: nums.join(', '), missing });
    }
    return ROUNDS;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.finish.noScores'); // nunca chamado
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.skipCount.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const s = this.seqs[index];
    return {
      speak: { text: s.spoken },
      announce: ctx.t('game.skipCount.round', { n: index + 1, total: ROUNDS }),
      accept: (raw) => firstInteger(raw) === s.missing,
      onCorrect: (user) => ctx.t('game.skipCount.correct', { user, answer: s.missing }),
      onTimeout: () => ctx.t('game.skipCount.timeout', { answer: s.missing }),
    };
  }
}

export const skipCountDef: GameDefinition = {
  id: 'skip-count',
  nameKey: 'game.skipCount.name',
  descKey: 'game.skipCount.desc',
  needsVoice: true,
  create: () => new SkipCountGame(),
};
