import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { catalog } from '../src/i18n/catalog';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/index';
import { locales } from '../src/i18n/locales';

const target = path.resolve('contracts/voice-response-i18n.json');
const check = process.argv.includes('--check');

// These are the only current Rust-promoted voice responses.  Keeping the list here makes adding
// a new semantic Rust outcome a deliberate review of the existing Node public copy.
const KEYS = [
  'error.generic',
  'join.needVoiceChannel',
  'join.missingPerms',
  'join.joined',
  'join.joinedAutoread',
  'leave.left',
  'skip.notInVoice',
  'skip.nothing',
  'skip.skipped',
  'shutup.notInVoice',
  'shutup.nothing',
  'shutup.done',
  'tts.notInVoice',
  'tts.nothingToRead',
  'tts.nothingAfterClean',
  'tts.tooFast',
  'tts.blocked',
  'tts.queued',
  'tts.busy',
  'ttsFile.tooLong',
  'ttsFile.unavailable',
  'ttsFile.ready',
  'ttsFile.failed',
  'translation.ready',
  'translation.invalidLocale',
  'translation.quota',
  'translation.disabled',
  'translation.empty',
  'translation.unavailable',
] as const;

type CatalogEntry = { en: string; pt?: string };
const entries = catalog as Record<string, CatalogEntry>;

function message(locale: string, key: (typeof KEYS)[number]): string {
  const entry = entries[key];
  if (!entry?.en) throw new Error(`Missing canonical English i18n key: ${key}`);
  return (
    locales[locale]?.[key] ?? (entry as Record<string, string | undefined>)[locale] ?? entry.en
  );
}

async function main(): Promise<void> {
  const contract = {
    schema_version: 1,
    generated_from: 'src/i18n/catalog.ts + src/i18n/locales',
    default_locale: DEFAULT_LOCALE,
    supported_locales: [...SUPPORTED_LOCALES],
    keys: [...KEYS],
    messages: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        Object.fromEntries(KEYS.map((key) => [key, message(locale, key)])),
      ]),
    ),
  };
  const expected = await format(JSON.stringify(contract), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
  });

  if (check) {
    const actual = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (actual !== expected) {
      console.error('Rust voice i18n contract is stale. Run: npm run build:rust-contracts');
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
