import { t } from '../i18n/index';
import type { GameDefinition } from './types';
import { guessLanguageDef } from './guessLanguage';
import { mathDef } from './math';
import { skipCountDef } from './skipCount';
import { spellingDef } from './spelling';
import { spellOutDef } from './spellOut';
import { fastSpeechDef } from './fastSpeech';
import { accentSwapDef } from './accentSwap';
import { reflexesDef } from './reflexes';
import { vozenSaysDef } from './vozenSays';
import { rouletteDef } from './roulette';
import { hangmanDef } from './hangman';
import { wordleDef } from './wordle';
import { tictactoeDef } from './tictactoe';
import { chessDef } from './chess';
import { wordChainDef } from './wordChain';
import { headsOrTailsDef } from './headsOrTails';
import { WORDCHAIN_LANGS } from './wordchain/core';

/**
 * Registry of all /game minigames. Adding a new game = create the file (with its
 * GameDefinition) and add it here — the command, the autocomplete and /game list
 * derive EVERYTHING from this list, so nothing else needs to change.
 */
export const GAME_DEFS: readonly GameDefinition[] = [
  guessLanguageDef,
  mathDef,
  skipCountDef,
  spellingDef,
  spellOutDef,
  fastSpeechDef,
  accentSwapDef,
  reflexesDef,
  vozenSaysDef,
  rouletteDef,
  hangmanDef,
  wordleDef,
  tictactoeDef,
  chessDef,
  wordChainDef,
  headsOrTailsDef,
];

/** Friendly (autonym) name of each playable word-chain language. */
const WORDCHAIN_LANG_NAMES: Record<string, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  fr: 'Français',
};

/**
 * Choices for the autocomplete of the `language` option of /game play (only word-chain
 * uses it). Lists the supported Latin languages; filters by what the user types (name OR
 * code). PURE/testable.
 */
export function filterWordChainLanguages(query: string): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  return WORDCHAIN_LANGS.map((code) => ({ name: WORDCHAIN_LANG_NAMES[code] ?? code, value: code }))
    .filter((c) => c.name.toLowerCase().includes(q) || c.value.includes(q))
    .slice(0, 25);
}

/** Looks up a game by id (the autocomplete value). undefined if it doesn't exist. */
export function gameById(id: string): GameDefinition | undefined {
  return GAME_DEFS.find((g) => g.id === id);
}

/**
 * Choices for the autocomplete of the `game` option of /game play: the game name IN THE
 * user's LANGUAGE (the Discord client's `locale`, via t()), value = id. Filters by what
 * the user types (case-insensitive, by the translated name OR by the id), limited to
 * 25 (Discord's cap). PURE/testable. `locale` should already be in base form ('pt', 'fr').
 */
export function filterGameChoices(
  query: string,
  locale: string,
): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  return GAME_DEFS.map((g) => ({ name: t(g.nameKey, locale), value: g.id }))
    .filter((c) => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
    .slice(0, 25);
}
