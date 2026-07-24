import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { LANGUAGE_PHRASES } from '../src/games/content/languagePhrases';
import { ROULETTE_PROMPTS } from '../src/games/content/roulettePrompts';
import { SHORT_PHRASES } from '../src/games/content/shortPhrases';
import { WORD_BANK } from '../src/games/content/words';
import { WORDLE_WORDS } from '../src/games/content/wordleWords';

const target = path.resolve('crates/vozen-discord/assets/game-content.json');
const check = process.argv.includes('--check');

async function main(): Promise<void> {
  const contract = {
    schema_version: 1,
    generated_from:
      'src/games/content/languagePhrases.ts + roulettePrompts.ts + shortPhrases.ts + words.ts + wordleWords.ts',
    language_phrases: LANGUAGE_PHRASES,
    roulette_prompts: ROULETTE_PROMPTS,
    short_phrases: SHORT_PHRASES,
    word_bank: WORD_BANK,
    wordle_words: WORDLE_WORDS,
  };
  const expected = await format(JSON.stringify(contract), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
  });

  if (check) {
    const actual = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actual !== expected) {
      console.error('Rust game content contract is stale. Run: npm run build:rust-game-content');
      process.exitCode = 1;
    }
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, expected, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
