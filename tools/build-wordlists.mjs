// tools/build-wordlists.mjs
//
// Generates the wordlists for the "word chain" (word-chain) minigame from the
// hermitdave/FrequencyWords frequency lists (OpenSubtitles, CC-BY-SA-4.0).
// One language per file: assets/wordlists/{lang}.txt (one word per line, already
// NORMALIZED, only a-z, >=3 letters, no duplicates, sorted, no obvious profanity).
//
// The runtime only loads the Set — zero processing at startup. NOT in
// package.json (build tool); run by hand when you want to regenerate:
//   node tools/build-wordlists.mjs
//
// Attribution (CC-BY-SA-4.0): data derived from hermitdave/FrequencyWords.
// See assets/wordlists/NOTICE.txt.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'wordlists');
const CACHE = join(root, 'scratchpad', 'dict-spike'); // reuses the spike download if it exists

const LANGS = ['pt', 'en', 'es', 'fr'];

// IMPORTANT: this normalization MUST be byte-for-byte identical to the normalize() in
// src/games/wordchain/core.ts — otherwise the runtime normalizes the user's input
// differently from the list and valid words are rejected. There is a test in core that
// pins the canonical outputs (Cães->caes, éléphant->elephant).
const RE_PLAYABLE = /^[a-z]+$/;
function normalize(w) {
  return w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove combining diacritics
    .toLowerCase() // BEFORE the ligatures, to catch uppercase (Æ, Ø, Ł…)
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l');
}

// Profanity/slurs to NEVER accept (the bot reads the words out loud, so an
// offensive "valid word" would come out of the speakers). Compact and
// deliberately conservative list — focused on slurs and strong swearing. Extensible.
const PROFANITY = {
  pt: [
    'caralho',
    'foda',
    'foder',
    'fodido',
    'fodida',
    'puta',
    'putas',
    'puto',
    'cona',
    'cabrao',
    'cabroes',
    'merda',
    'merdas',
    'piroca',
    'crlh',
    'fdp',
    'paneleiro',
    'preto',
    'pretos',
    'corno',
    'cornos',
    'buceta',
    'xoxota',
    'caralhos',
    'putaria',
  ],
  en: [
    'fuck',
    'fucks',
    'fucked',
    'fucking',
    'fucker',
    'shit',
    'shits',
    'shitty',
    'bitch',
    'bitches',
    'cunt',
    'cunts',
    'nigger',
    'niggers',
    'nigga',
    'faggot',
    'faggots',
    'whore',
    'whores',
    'slut',
    'sluts',
    'dick',
    'dicks',
    'cock',
    'cocks',
    'pussy',
    'pussies',
    'bastard',
    'retard',
    'retards',
  ],
  es: [
    'joder',
    'jode',
    'jodido',
    'jodida',
    'puta',
    'putas',
    'puto',
    'putos',
    'mierda',
    'mierdas',
    'coño',
    'conos',
    'cono',
    'polla',
    'pollas',
    'cabron',
    'cabrones',
    'gilipollas',
    'zorra',
    'zorras',
    'maricon',
    'maricones',
    'pendejo',
    'pendejos',
    'verga',
    'chinga',
    'chingar',
  ],
  fr: [
    'merde',
    'merdes',
    'putain',
    'putains',
    'pute',
    'putes',
    'salope',
    'salopes',
    'connard',
    'connards',
    'connasse',
    'enculer',
    'encule',
    'encules',
    'bite',
    'bites',
    'chatte',
    'chattes',
    'couille',
    'couilles',
    'salaud',
    'salauds',
    'pd',
    'nique',
    'niquer',
    'batard',
    'batards',
  ],
};

function loadRaw(lang) {
  const cached = join(CACHE, `${lang}_50k.txt`);
  if (existsSync(cached)) {
    console.log(`  ${lang}: cache local (${cached})`);
    return readFileSync(cached, 'utf8');
  }
  throw new Error(
    `Falta ${cached}. Descarrega primeiro:\n` +
      `  curl -s https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_50k.txt -o ${cached}`,
  );
}

// The subtitle lists contaminate each other across languages ("fuck" appears in the PT
// list, "mierda" in the FR list, etc.). So we ban the UNION of all profanity from
// all languages in ALL lists, not just that of the language itself.
const BANNED_ALL = new Set(Object.values(PROFANITY).flat());

mkdirSync(OUT, { recursive: true });
for (const lang of LANGS) {
  const raw = loadRaw(lang);
  const banned = BANNED_ALL;
  const seen = new Set();
  for (const line of raw.split('\n')) {
    const word = line.split(' ')[0];
    if (!word) continue;
    const n = normalize(word);
    if (!RE_PLAYABLE.test(n) || n.length < 3) continue;
    if (banned.has(n)) continue;
    seen.add(n);
  }
  const sorted = [...seen].sort();
  writeFileSync(join(OUT, `${lang}.txt`), sorted.join('\n') + '\n', 'utf8');
  console.log(`  ${lang}: ${sorted.length} palavras -> assets/wordlists/${lang}.txt`);
}
console.log('done.');
