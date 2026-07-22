// tools/gen-samples-piper.mjs
//
// Gera os clipes de demonstracao do site com o motor PIPER (self-host, neural), para o
// A/B "Google vs Piper" no #hear. Uma frase por lingua (a MESMA da versao Google, para a
// comparacao ser justa), sintetizada com o modelo Piper de cada lingua, guardada em
// site/assets/samples/<lang>-piper.mp3.
//
// O Piper (binario + modelos .onnx) NAO esta no repo (sao ~60MB por modelo). Aponta para
// uma instalacao local por env e corre:
//   PIPER_EXE=/caminho/piper.exe PIPER_MODELS=/caminho/models node tools/gen-samples-piper.mjs
// Binario: github.com/rhasspy/piper/releases · modelos: huggingface.co/rhasspy/piper-voices

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ffmpegPath from 'ffmpeg-static';

const PIPER_EXE = process.env.PIPER_EXE;
const PIPER_MODELS = process.env.PIPER_MODELS;
if (!PIPER_EXE || !PIPER_MODELS) {
  console.error('Set PIPER_EXE and PIPER_MODELS (see this file header).');
  process.exit(1);
}

// Uma so voz por lingua — as mesmas frases que a versao Google (gen-samples.mjs).
const SAMPLES = [
  {
    lang: 'en',
    model: 'en_US-amy-medium',
    text: "Hey! Welcome to the server. Type anything and I'll read it out loud.",
  },
  {
    lang: 'pt',
    model: 'pt_BR-faber-medium',
    text: 'Olá! Escreva qualquer coisa e eu leio em voz alta.',
  },
  {
    lang: 'es',
    model: 'es_ES-davefx-medium',
    text: '¡Hola! Escribe lo que quieras y lo leeré en voz alta.',
  },
  {
    lang: 'fr',
    model: 'fr_FR-siwis-medium',
    text: 'Salut ! Écris ce que tu veux, je le lis à voix haute.',
  },
  {
    lang: 'it',
    model: 'it_IT-paola-medium',
    text: 'Ciao! Scrivi quello che vuoi e lo leggerò ad alta voce.',
  },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site', 'assets', 'samples');
mkdirSync(outDir, { recursive: true });

function run(exe, args, opts, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, opts);
    let stderr = '';
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`exit ${code}: ${stderr.slice(-300)}`)),
    );
    if (stdin !== undefined) {
      child.stdin.write(Buffer.from(stdin, 'utf8'));
      child.stdin.end();
    }
  });
}

for (const { lang, model, text } of SAMPLES) {
  const onnx = join(PIPER_MODELS, `${model}.onnx`);
  if (!existsSync(onnx)) {
    console.error(`Missing model: ${onnx}`);
    process.exit(1);
  }
  const work = join(tmpdir(), `vozen-piper-${lang}`);
  mkdirSync(work, { recursive: true });
  const wav = join(work, 'out.wav');
  // Piper le a frase do stdin (UTF-8) e escreve o WAV; cwd = pasta do exe (acha o espeak-ng-data).
  await run(
    PIPER_EXE,
    ['-m', onnx, '-f', wav],
    { cwd: dirname(PIPER_EXE), stdio: ['pipe', 'ignore', 'pipe'] },
    text,
  );
  const mp3 = join(outDir, `${lang}-piper.mp3`);
  // WAV -> MP3 (mesmo formato web dos clipes Google).
  await run(
    ffmpegPath,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wav,
      '-codec:a',
      'libmp3lame',
      '-qscale:a',
      '4',
      mp3,
      '-y',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const bytes = readFileSync(mp3).length;
  console.log(`${lang}-piper.mp3  ${bytes} bytes  (${model})`);
  rmSync(work, { recursive: true, force: true });
}
console.log('feito.');
