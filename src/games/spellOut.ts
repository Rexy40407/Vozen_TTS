import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { pickWordSource, type WordSource } from './content/words';
import { normalizeAnswer, seededShuffle } from './util';

const ROUNDS = 5;

/**
 * "Soletrado ao Contrario" — o Vozen SOLETRA uma palavra letra a letra ("v, o, l, t, e,
 * i") e o 1o a escrever a palavra INTEIRA ganha. Piada interna: e o inverso do bug do
 * gTTS que soletrava CAPS — aqui soletrar E a feature.
 *
 * O texto falado sao as letras MAIUSCULAS separadas por ", ". Como o deCapsForGoogle so
 * baixa RUNS de 2+ maiusculas seguidas (sem espacos), letras isoladas separadas por
 * virgulas passam intactas e sao soletradas pela Google — exatamente o que queremos.
 */
class SpellOutGame extends QuizGame {
  readonly id = 'spell-out';
  private src: WordSource | null = null;
  private words: string[] = [];
  private rounds = 0;

  protected prepare(ctx: GameContext): number {
    this.src = pickWordSource(ctx.defaultVoice, ctx.availableModels);
    // So palavras sem '-' (o hifen atrapalha a soletracao letra-a-letra).
    this.words = seededShuffle(
      this.src.words.filter((w) => !w.includes('-')),
      ctx.seed,
    );
    this.rounds = Math.min(ROUNDS, this.words.length);
    return this.rounds;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.spelling.empty');
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.spellOut.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const word = this.words[index];
    const spelled = word.toUpperCase().split('').join(', ');
    return {
      speak: { text: spelled, opts: { model: this.src!.model } },
      announce: ctx.t('game.spellOut.round', { n: index + 1, total: this.rounds }),
      accept: (raw) => normalizeAnswer(raw) === normalizeAnswer(word),
      onCorrect: (user) => ctx.t('game.spellOut.correct', { user, word }),
      onTimeout: () => ctx.t('game.spellOut.timeout', { word }),
    };
  }
}

export const spellOutDef: GameDefinition = {
  id: 'spell-out',
  nameKey: 'game.spellOut.name',
  descKey: 'game.spellOut.desc',
  needsVoice: true,
  create: () => new SpellOutGame(),
};
