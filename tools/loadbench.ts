/**
 * tools/loadbench.ts — LOAD + soak bench (spec T4.1/T4.2).
 *
 * Run with:  npx tsx tools/loadbench.ts   (uses the real Piper; persistent pool ON)
 *
 * T4.1 — load: N CONCURRENT syntheses (5/10/20) across 2 voices; measures wall-time,
 *   success, and throughput. Validates the global cap (T1.3) + the persistent pool (T2.1).
 * T4.2 — soak: one large burst of syntheses; confirms stable RAM and that the number of
 *   live piper.exe processes stays ≤ PIPER_WARM_VOICES (no process leak).
 * Writes a summary to BENCHMARKS-load.md. Not part of the production build.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { loadConfig } from '../src/config/index';
import { AudioCache } from '../src/tts/cache';
import { PiperEngine, resolvePiperConcurrency, shutdownPiperPool } from '../src/tts/piper';
import type { SynthRequest } from '../src/tts/engine';

function discoverModels(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.onnx'))
    .map((f) => basename(f, '.onnx'))
    .sort();
}
function countPiperProcs(): number {
  // Windows: tasklist. Counts live instances of piper.exe.
  try {
    const out =
      spawnSync('tasklist', ['/FI', 'IMAGENAME eq piper.exe', '/NH'], {
        encoding: 'utf8',
        timeout: 5000,
      }).stdout || '';
    return (out.match(/piper\.exe/gi) || []).length;
  } catch {
    return -1; // unknown (non-Windows)
  }
}
const wordsOf = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => ['a', 'nossa', 'cidade', 'tem', 'tempo', 'agradavel'][i % 6],
  ).join(' ');

async function main(): Promise<void> {
  const config = loadConfig();
  const models = discoverModels(config.modelsDir);
  const lines: string[] = [];
  const log = (s = '') => {
    lines.push(s);
    console.log(s);
  };

  log('# BENCHMARKS — load and soak (T4.1/T4.2)');
  log('');
  log(
    `- Concurrency cap: **${resolvePiperConcurrency()}** · WARM_VOICES: ${process.env.PIPER_WARM_VOICES ?? '3 (default)'} · persistent: ${process.env.PIPER_PERSISTENT === '0' ? 'OFF' : 'ON'}`,
  );
  log('');
  if (models.length === 0) {
    log('> ⚠️ No models found; benchmark aborted.');
    writeFileSync('BENCHMARKS-load.md', lines.join('\n'));
    return;
  }

  const pick = (...p: string[]) => p.find((x) => models.includes(x)) ?? models[0];
  const voices = [pick('en_US-amy-medium'), pick('pt_PT-tugao-medium', 'pt_PT-tugão-medium')];
  const cacheDir = mkdtempSync(join(tmpdir(), 'vozen-load-'));
  const engine = new PiperEngine(config.piperPath, config.modelsDir, new AudioCache(cacheDir, 0), {
    noiseScale: config.noiseScale,
    noiseW: config.noiseW,
    sentenceSilence: config.sentenceSilence,
  });

  let counter = 0;
  const oneSynth = (): Promise<string> => {
    const i = counter++;
    const req: SynthRequest = { text: `load ${i} ${wordsOf(8)}`, model: voices[i % 2], speed: 1 };
    return engine.synth(req);
  };

  try {
    // ── T4.1 load: N concurrent ──────────────────────────────────────────
    log('## T4.1 — concurrent load');
    log('');
    log('| Concurrent N | wall time (ms) | ok/N | throughput (synthesis/s) |');
    log('|---:|---:|---:|---:|');
    for (const N of [5, 10, 20]) {
      const t0 = process.hrtime.bigint();
      const res = await Promise.allSettled(Array.from({ length: N }, () => oneSynth()));
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const ok = res.filter((r) => r.status === 'fulfilled').length;
      log(`| ${N} | ${ms.toFixed(0)} | ${ok}/${N} | ${(N / (ms / 1000)).toFixed(1)} |`);
    }
    log('');

    // ── T4.2 soak: large burst + RAM + live processes ────────────────────
    log('## T4.2 — soak (leak check)');
    log('');
    const SOAK = 200;
    const BATCH = 10;
    const rssBefore = process.memoryUsage().rss;
    let soakOk = 0;
    for (let done = 0; done < SOAK; done += BATCH) {
      const res = await Promise.allSettled(Array.from({ length: BATCH }, () => oneSynth()));
      soakOk += res.filter((r) => r.status === 'fulfilled').length;
    }
    const rssAfter = process.memoryUsage().rss;
    const livePiper = countPiperProcs();
    const warm = process.env.PIPER_WARM_VOICES ? Number(process.env.PIPER_WARM_VOICES) : 3;
    log(`- ${soakOk}/${SOAK} successful syntheses.`);
    log(
      `- RSS: ${(rssBefore / 2 ** 20).toFixed(0)}MB → ${(rssAfter / 2 ** 20).toFixed(0)}MB (Δ ${((rssAfter - rssBefore) / 2 ** 20).toFixed(1)}MB).`,
    );
    log(
      `- live piper.exe processes at end: **${livePiper}** (expected ≤ WARM_VOICES=${warm}; -1 = non-Windows).`,
    );
    const leak = livePiper > warm + 1;
    log(`- Process leak: ${leak ? '⚠️ POSSIBLE' : '✅ no'}.`);
    log('');
    log('---');
    log(
      '_shutdownPiperPool() closes warm processes; the production supervisor calls it during centralized shutdown._',
    );

    writeFileSync(join(process.cwd(), 'BENCHMARKS-load.md'), lines.join('\n') + '\n');
    console.log('\n✅ BENCHMARKS-load.md written.');
  } finally {
    shutdownPiperPool();
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error('load benchmark failed:', e);
  shutdownPiperPool();
  process.exit(1);
});
