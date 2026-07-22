// src/games/wordchain/dict.ts
//
// Loading (I/O) of the per-language wordlists for word-chain. Separated from core.ts
// (pure) on purpose: the engine is tested with a hand-made Set; this reads the real files.
// Lazy + cache: only the language of a match is loaded, and only once per process.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WordSetDictionary, type Dictionary, type WordChainLang } from './core';
import { log } from '../../logging/logger';

// The wordlists live in assets/wordlists/ (repo root). At runtime this module lives
// in dist/games/wordchain/, so the root is 3 levels up (shard.ts pattern, which
// resolves from __dirname to be robust to the cwd).
const WORDLISTS_DIR = join(__dirname, '..', '..', '..', 'assets', 'wordlists');

const cache = new Map<WordChainLang, Dictionary>();

/**
 * Returns the dictionary of a language (cached). If the file is missing/empty,
 * it logs and returns `null` — the game treats that as "language unavailable" instead of crashing.
 */
export function loadDictionary(lang: WordChainLang): Dictionary | null {
  const cached = cache.get(lang);
  if (cached) return cached;
  const file = join(WORDLISTS_DIR, `${lang}.txt`);
  if (!existsSync(file)) {
    log.error(`[wordchain] missing word list: ${file}`);
    return null;
  }
  try {
    // Split on /\r?\n/ (NOT just '\n'): in a CRLF checkout (Windows, core.autocrlf=true)
    // each word would have a trailing '\r' and the dictionary Set would store "gabar\r".
    // The player's input is always normalized+trimmed (validate() does normalize(raw.trim()),
    // no '\r'), so has("gabar") would fail and ALL words would be rejected —
    // the "0 words accepted" bug. On LF the behavior is byte-for-byte identical.
    const words = readFileSync(file, 'utf8').split(/\r?\n/);
    const dict = new WordSetDictionary(words.filter(Boolean));
    cache.set(lang, dict);
    return dict;
  } catch (err) {
    log.error(`[wordchain] failed to read word list ${file}`, err);
    return null;
  }
}
