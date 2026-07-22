import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { pickPhraseSource, type PhraseSource } from './content/shortPhrases';
import { jaccard, normalizeAnswer, seededShuffle } from './util';

const ROUNDS = 5;
/** Velocidade da fala: propositadamente rapida (o maximo do /voice set e 2.0). */
const FAST_SPEED = 2.0;
/** Fracao de palavras certas para aceitar (tolerante a uma gralha numa frase curta). */
const ACCEPT_RATIO = 0.7;

/**
 * "Velocidade Estupida" — o Vozen le uma frase curta MUITO depressa (speed 2.0) e o 1o
 * a escrever o que ouviu ganha. Aceita respostas quase-certas (Jaccard >= 0.7) para
 * uma gralha nao invalidar. Frases da lingua da voz default da guild (senao ingles).
 */
class FastSpeechGame extends QuizGame {
  readonly id = 'fast-speech';
  protected roundMs = 20_000;
  private src: PhraseSource | null = null;
  private phrases: string[] = [];
  private rounds = 0;

  protected prepare(ctx: GameContext): number {
    this.src = pickPhraseSource(ctx.defaultVoice, ctx.availableModels);
    this.phrases = seededShuffle(this.src.phrases, ctx.seed);
    this.rounds = Math.min(ROUNDS, this.phrases.length);
    return this.rounds;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.fastSpeech.empty');
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.fastSpeech.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const phrase = this.phrases[index];
    return {
      speak: { text: phrase, opts: { model: this.src!.model, speed: FAST_SPEED } },
      announce: ctx.t('game.fastSpeech.round', { n: index + 1, total: this.rounds }),
      accept: (raw) =>
        normalizeAnswer(raw) === normalizeAnswer(phrase) || jaccard(raw, phrase) >= ACCEPT_RATIO,
      onCorrect: (user) => ctx.t('game.fastSpeech.correct', { user, phrase }),
      onTimeout: () => ctx.t('game.fastSpeech.timeout', { phrase }),
    };
  }
}

export const fastSpeechDef: GameDefinition = {
  id: 'fast-speech',
  nameKey: 'game.fastSpeech.name',
  descKey: 'game.fastSpeech.desc',
  needsVoice: true,
  create: () => new FastSpeechGame(),
};
