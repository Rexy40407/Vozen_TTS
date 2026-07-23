import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { LOCALE_NAMES } from '../src/language/voiceMap';
import { SUPPORTED_LOCALES } from '../src/i18n/index';

const target = path.resolve('contracts/voice-display-i18n.json');
const check = process.argv.includes('--check');

function localeParts(locale: string): { language: string; region?: string } {
  const [language, region] = locale.split('_');
  return { language, region };
}

function displayName(
  locale: string,
  type: 'language' | 'region',
  code: string,
): string | undefined {
  try {
    const value = new Intl.DisplayNames([locale, 'en'], { type }).of(code);
    return value && value.toLowerCase() !== code.toLowerCase() ? value : undefined;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const localePartsList = Object.keys(LOCALE_NAMES).map(localeParts);
  const languages = [...new Set(localePartsList.map((value) => value.language))].sort();
  const regions = [
    ...new Set(localePartsList.flatMap((value) => (value.region ? [value.region] : []))),
  ].sort();
  const contract = {
    schema_version: 1,
    generated_from: 'src/language/voiceMap.ts + src/i18n/index.ts',
    supported_locales: [...SUPPORTED_LOCALES],
    autonyms: LOCALE_NAMES,
    names: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        {
          languages: Object.fromEntries(
            languages.flatMap((code) => {
              const value = displayName(locale, 'language', code);
              return value ? [[code, value]] : [];
            }),
          ),
          regions: Object.fromEntries(
            regions.flatMap((code) => {
              const value = displayName(locale, 'region', code);
              return value ? [[code, value]] : [];
            }),
          ),
        },
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
      console.error('Rust voice display contract is stale. Run: npm run build:rust-contracts');
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
