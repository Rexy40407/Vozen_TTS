import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { pickWordSource, type WordSource } from './content/words';
import { normalizeAnswer, seededShuffle } from './util';

const ROUNDS = 5;

/**
 * "Ditado" (Spelling Bee) — o Vozen diz uma palavra e o 1o a ESCREVE-LA corretamente
 * ganha. Palavras da lingua da voz default da guild (senao ingles). Aceita a palavra
 * normalizada (sem acentos/maiusculas), para nao ser cruel com acentos.
 */
class SpellingGame extends QuizGame {
  readonly id = 'spelling';
  private src: WordSource | null = null;
  private words: string[] = [];
  private rounds = 0;

  protected prepare(ctx: GameContext): number {
    this.src = pickWordSource(ctx.defaultVoice, ctx.availableModels);
    this.words = seededShuffle(this.src.words, ctx.seed);
    this.rounds = Math.min(ROUNDS, this.words.length);
    return this.rounds;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.spelling.empty');
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.spelling.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const word = this.words[index];
    const model = this.src!.model;
    return {
      speak: { text: word, opts: { model } },
      announce: ctx.t('game.spelling.round', { n: index + 1, total: this.rounds }),
      accept: (raw) => normalizeAnswer(raw) === normalizeAnswer(word),
      onCorrect: (user) => ctx.t('game.spelling.correct', { user, word }),
      onTimeout: () => ctx.t('game.spelling.timeout', { word }),
    };
  }
}

export const spellingDef: GameDefinition = {
  id: 'spelling',
  nameKey: 'game.spelling.name',
  descKey: 'game.spelling.desc',
  needsVoice: true,
  create: () => new SpellingGame(),
};
