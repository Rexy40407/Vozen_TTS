import { LOCALE_DISPLAY_NAMES } from '../i18n/index';
import type { GameContext, GameDefinition } from './types';
import { QuizGame, type QuizRound } from './quizGame';
import { LANGUAGE_PHRASES } from './content/languagePhrases';
import { baseCodeOf, localizedLanguageName, makeRng, normalizeAnswer, seededShuffle } from './util';

/** Rounds per game and the time limit of each round. */
const ROUNDS = 5;
const ROUND_MS = 25_000;

interface Candidate {
  base: string;
  model: string;
  /** The possible phrases for this language — ONE is chosen at random each round. */
  phrases: string[];
}

/**
 * Playable languages: the ones that have AT THE SAME TIME an installed voice AND
 * phrases. One entry per base (the 1st voice found for that language), preserving the
 * order of availableModels. PURE.
 */
export function guessableLanguages(availableModels: string[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const model of availableModels) {
    const base = baseCodeOf(model);
    if (seen.has(base)) continue;
    const phrases = LANGUAGE_PHRASES[base];
    if (!phrases?.length) continue;
    seen.add(base);
    out.push({ base, model, phrases });
  }
  return out;
}

/**
 * Languages in which the guessed language's NAME is accepted — the most spoken across
 * Vozen's servers. This way a player writes in THEIR language: "espanhol" (pt), "spanish"
 * (en), "español" (es), "espagnol" (fr), "spanisch" (de), "spagnolo" (it), etc. — all count.
 */
const ANSWER_LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'nl'] as const;

/**
 * Set of ACCEPTED answers for the language `base`: the code ('de'), the autonym
 * ('Deutsch'), and the language name written in SEVERAL common languages (pt/en/es/fr/
 * de/it/nl) + the game locale. All normalized (no accents, lowercase) for tolerant
 * comparison — a player gets it right by writing the name in THEIR language or in English. PURE.
 */
export function acceptableAnswers(base: string, locale: string): Set<string> {
  const set = new Set<string>();
  const add = (s: string | undefined): void => {
    if (s) set.add(normalizeAnswer(s));
  };
  add(base);
  add((LOCALE_DISPLAY_NAMES as Record<string, string>)[base]); // autonym, if supported
  add(localizedLanguageName(base, base)); // autonym via ICU (covers unsupported bases)
  add(localizedLanguageName(base, locale)); // name in the game locale
  for (const loc of ANSWER_LOCALES) add(localizedLanguageName(base, loc)); // name in several languages
  return set;
}

/**
 * "Guess the Language" — Vozen reads a phrase in a random language (of those with an
 * installed voice) and the 1st to write the language name wins the point. Best-of-5
 * rounds. Built on the QuizGame base (round loop, timeout, scoreboard, final summary);
 * here only the CONTENT lives: choosing the languages and recognizing the language name.
 */
class GuessLanguageGame extends QuizGame {
  readonly id = 'guess-language';
  protected roundMs = ROUND_MS;
  private order: Candidate[] = [];
  private rounds = 0;
  private rng: () => number = () => 0;

  protected prepare(ctx: GameContext): number {
    this.order = seededShuffle(guessableLanguages(ctx.availableModels), ctx.seed);
    this.rounds = Math.min(ROUNDS, this.order.length);
    // Seeded rng to vary the PHRASE of each round (not just the language) — otherwise
    // "phrase X = language Y" would be memorized after half a dozen games.
    this.rng = makeRng(ctx.seed);
    return this.rounds;
  }

  protected emptyMessage(ctx: GameContext): string {
    return ctx.t('game.guessLanguage.noLanguages');
  }

  protected intro(ctx: GameContext, rounds: number): string {
    return ctx.t('game.guessLanguage.intro', { rounds });
  }

  protected makeRound(ctx: GameContext, index: number): QuizRound {
    const cand = this.order[index];
    const answers = acceptableAnswers(cand.base, ctx.locale);
    const language = localizedLanguageName(cand.base, ctx.locale);
    const phrase = cand.phrases[this.rng() % cand.phrases.length];
    return {
      speak: { text: phrase, opts: { model: cand.model } },
      announce: ctx.t('game.guessLanguage.round', { n: index + 1, total: this.rounds }),
      accept: (raw) => answers.has(normalizeAnswer(raw)),
      onCorrect: (user) => ctx.t('game.guessLanguage.correct', { user, language }),
      onTimeout: () => ctx.t('game.guessLanguage.timeout', { language }),
    };
  }
}

export const guessLanguageDef: GameDefinition = {
  id: 'guess-language',
  nameKey: 'game.guessLanguage.name',
  descKey: 'game.guessLanguage.desc',
  needsVoice: true,
  create: () => new GuessLanguageGame(),
};
