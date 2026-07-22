import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { pickWordSource, type WordSource } from './content/words';
import { baseCodeOf, normalizeAnswer, seededShuffle } from './util';

const ROUNDS = 5;

/**
 * "Sotaque Trocado" — o Vozen diz uma palavra da lingua da guild mas com a voz de OUTRA
 * lingua (sotaque estrangeiro engracado); o 1o a escrever a palavra ganha. Reutiliza o
 * banco de palavras; a "voz do sotaque" e o 1o modelo instalado de uma base diferente
 * (se nao houver outra lingua instalada, cai na propria voz — sem sotaque, mas jogavel).
 */
class AccentSwapGame extends QuizGame {
  readonly id = 'accent-swap';
  private src: WordSource | null = null;
  private words: string[] = [];
  private rounds = 0;
  private foreignModel = '';

  protected prepare(ctx: GameContext): number {
    this.src = pickWordSource(ctx.defaultVoice, ctx.availableModels);
    this.words = seededShuffle(this.src.words, ctx.seed);
    this.rounds = Math.min(ROUNDS, this.words.length);
    // Voz "do sotaque": qualquer modelo de uma base != a da palavra; senao a propria.
    this.foreignModel =
      ctx.availableModels.find((m) => baseCodeOf(m) !== this.src!.base) ?? this.src!.model;
    return this.rounds;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.spelling.empty');
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.accentSwap.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const word = this.words[index];
    return {
      speak: { text: word, opts: { model: this.foreignModel } },
      announce: ctx.t('game.accentSwap.round', { n: index + 1, total: this.rounds }),
      accept: (raw) => normalizeAnswer(raw) === normalizeAnswer(word),
      onCorrect: (user) => ctx.t('game.accentSwap.correct', { user, word }),
      onTimeout: () => ctx.t('game.accentSwap.timeout', { word }),
    };
  }
}

export const accentSwapDef: GameDefinition = {
  id: 'accent-swap',
  nameKey: 'game.accentSwap.name',
  descKey: 'game.accentSwap.desc',
  needsVoice: true,
  create: () => new AccentSwapGame(),
};
