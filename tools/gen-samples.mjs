// tools/gen-samples.mjs
//
// Gera os clipes de demonstracao do site (a "prova auditiva" no #hear) usando o
// MESMO motor por defeito do bot: as vozes da Google (gTTS). Guarda um .mp3 por
// lingua em site/assets/samples/. Sao ficheiros pequenos, comitados no repo, para
// o site nao precisar de backend.
//
// Regenerar / mudar frases:
//   node tools/gen-samples.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GTTS_URL = 'https://translate.google.com/translate_tts';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Frase curta e natural por lingua (< 200 chars => um so pedido). O `tl` do gTTS
// e' o codigo ISO-639-1 (o mesmo prefixo dos modelos do bot).
const SAMPLES = [
  { lang: 'en', text: "Hey! Welcome to the server. Type anything and I'll read it out loud." },
  { lang: 'pt', text: 'Olá! Escreva qualquer coisa e eu leio em voz alta.' },
  { lang: 'es', text: '¡Hola! Escribe lo que quieras y lo leeré en voz alta.' },
  { lang: 'fr', text: 'Salut ! Écris ce que tu veux, je le lis à voix haute.' },
  { lang: 'it', text: 'Ciao! Scrivi quello che vuoi e lo leggerò ad alta voce.' },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site', 'assets', 'samples');
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const { lang, text } of SAMPLES) {
  const url = `${GTTS_URL}?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    console.error(`FAILED ${lang}: HTTP ${res.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const out = join(outDir, `${lang}.mp3`);
  writeFileSync(out, buf);
  console.log(`${lang}.mp3  ${buf.length} bytes`);
  await sleep(500); // gentil com o endpoint nao-oficial (evita 429)
}
console.log('feito.');
