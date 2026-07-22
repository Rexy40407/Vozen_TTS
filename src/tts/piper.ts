// src/tts/piper.ts
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { rmDirSafe } from './cleanupDir';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import type { SynthRequest, TTSEngine } from './engine';
import { AudioCache, cacheKey } from './cache';
import { concatWavs, silenceWav } from './wavConcat';
import { Semaphore } from './semaphore';
import { PiperPool, type ChildLike } from './piperPool';
import { log } from '../logging/logger';
import {
  lengthScaleFor,
  synthParamsFor,
  PIPER_DEFAULT_SYNTH_PARAMS,
  type SynthParams,
} from './calibration';

const PIPER_TIMEOUT_MS = 15000;

/**
 * Pool PERSISTENTE de processos piper (spec T2.1). Default **ON** — validado: a voz
 * quente reutiliza o processo (~4× mais rapido: 478ms→~110ms) e o audio e
 * BYTE-IDENTICO ao caminho one-shot (mesmo piper/params, so o processo e reutilizado);
 * qualquer falha do pool cai no one-shot sem perder sintese. Desliga-se com
 * PIPER_PERSISTENT=0 (ou 'false'/'off'). Lido por-chamada (nao congela ao carregar).
 * NOTA: a suite de testes forca '0' (ver tests/setup.ts) para exercitar o one-shot; o
 * pool e testado em isolamento em piperPool.test.ts.
 */
export function isPiperPersistentOn(): boolean {
  const raw = process.env.PIPER_PERSISTENT?.trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

/** maxWarm do pool (nº de vozes quentes). Default 3; override por PIPER_WARM_VOICES. */
export function resolveWarmVoices(): number {
  const env = process.env.PIPER_WARM_VOICES;
  if (env !== undefined && env.trim() !== '') {
    const n = Number(env);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return 3;
}

const PIPER_IDLE_MS = 5 * 60 * 1000;

/**
 * Pool SINGLETON de processos piper quentes. Lazy: nao spawna nada ao importar o
 * modulo (so no primeiro synth com persistente ON). `piperPath` e resolvido no
 * primeiro uso via a env PIPER_PATH (fallback 'piper'), para nao depender da
 * instancia do engine. O wrapper de spawn liga stdout em 'pipe' (o sinal de
 * conclusao chega por stdout) e ignora stderr (evita backpressure no processo longo).
 */
let piperPool: PiperPool | null = null;
function getPiperPool(): PiperPool {
  if (!piperPool) {
    const piperPath = process.env.PIPER_PATH?.trim() || 'piper';
    piperPool = new PiperPool({
      maxWarm: resolveWarmVoices(),
      idleMs: PIPER_IDLE_MS,
      spawn: (args: string[]): ChildLike => {
        const child = spawn(piperPath, args, { stdio: ['pipe', 'pipe', 'ignore'] });
        // Sem este listener, um EPIPE assincrono no stdin (o processo morreu mas
        // ainda lhe escrevemos uma linha) seria uma excecao NAO tratada que crasha
        // o bot. A morte real e tratada via 'exit'/timeout -> die() -> fallback, por
        // isso engolir o erro do stream aqui e correto (nao perde sintese).
        child.stdin?.on('error', () => {
          /* EPIPE et al.: morte tratada por 'exit'/timeout */
        });
        return child as unknown as ChildLike;
      },
    });
  }
  return piperPool;
}

/** Encerra o pool persistente (chamar no shutdown central). No-op se nunca criado. */
export function shutdownPiperPool(): void {
  if (piperPool) piperPool.shutdown();
}

/**
 * Cap de CONCORRENCIA de spawns do piper.exe. Cada sintese (cache MISS) arranca um
 * processo; sem limite, muitas guilds a falar em simultaneo fariam um "stampede" de
 * processos (CPU/RAM). Default = `max(1, nucleos-1)`; override por `PIPER_MAX_CONCURRENCY`
 * (inteiro positivo). Lido UMA vez ao carregar o modulo.
 */
export function resolvePiperConcurrency(): number {
  const env = process.env.PIPER_MAX_CONCURRENCY;
  if (env !== undefined && env.trim() !== '') {
    const n = Number(env);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return Math.max(1, cpus().length - 1);
}

/**
 * Semaforo GLOBAL de spawns do Piper, partilhado por TODAS as instancias de
 * PiperEngine (na pratica ha uma so, criada na factory e usada por todas as guilds).
 * So o SPAWN (cache miss) consome permit; cache hits nunca esperam.
 */
const globalPiperSemaphore = new Semaphore(resolvePiperConcurrency());

/**
 * Valida que `model` e um nome de modelo seguro para compor o caminho do .onnx.
 * Rejeita separadores de caminho (`/` ou `\`), componentes `.`/`..` e strings
 * vazias — cross-platform (nao depende de path.basename, que trata `\` como
 * caractere normal em POSIX). Nomes reais (ex. `en_US-amy-medium`,
 * `pt_PT-tugao-medium`) passam. Defense-in-depth no boundary do Piper: impede
 * que um nome nao-validado leia um .onnx fora do modelsDir.
 */
export function isSafeModelName(model: string): boolean {
  if (typeof model !== 'string' || model.length === 0) return false;
  if (model.includes('/') || model.includes('\\')) return false;
  if (model === '.' || model === '..') return false;
  return true;
}

export class PiperEngine implements TTSEngine {
  private readonly piperPath: string;
  private readonly modelsDir: string;
  private readonly cache: AudioCache;
  // Defaults GLOBAIS de qualidade (noise_scale/noise_w/sentence_silence). Param
  // opcional: ausente => preset ORGANICO (PIPER_DEFAULT_SYNTH_PARAMS = 0.75/0.95/0.4).
  // A config (factory) injeta aqui os valores globais vindos das envs NOISE_*.
  private readonly synthDefaults: SynthParams;
  // Semaforo de concorrencia dos spawns. Default = o GLOBAL (partilhado); injetavel
  // nos testes para exercitar o cap de forma deterministica.
  private readonly semaphore: Semaphore;

  constructor(
    piperPath: string,
    modelsDir: string,
    cache: AudioCache,
    synthDefaults: SynthParams = PIPER_DEFAULT_SYNTH_PARAMS,
    semaphore: Semaphore = globalPiperSemaphore,
  ) {
    this.piperPath = piperPath;
    this.modelsDir = modelsDir;
    this.cache = cache;
    this.synthDefaults = synthDefaults;
    this.semaphore = semaphore;
  }

  async synth(req: SynthRequest): Promise<string> {
    if (!isSafeModelName(req.model)) {
      throw new Error(`Invalid model name: ${req.model}`);
    }

    const key = cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const modelPath = join(this.modelsDir, `${req.model}.onnx`);
    if (!existsSync(modelPath)) {
      throw new Error(`Piper model not found: ${modelPath}`);
    }

    const lengthScale = lengthScaleFor(req.model, req.speed);
    // Params de qualidade: defaults globais + override por-voz (VAZIO hoje). O
    // length_scale NAO passa por aqui — continua a vir so de lengthScaleFor.
    const params = synthParamsFor(req.model, this.synthDefaults);

    const workDir = mkdtempSync(join(tmpdir(), 'piper-'));
    const outPath = join(workDir, 'out.wav');

    try {
      // Cap global de spawns: adquire um permit (sincrono se houver livre — preserva
      // o spawn sincrono do caminho sem contencao; espera FIFO se estiverem todos
      // ocupados) e liberta-o assim que o processo termina (finally). So o SPAWN e
      // limitado; a cache foi consultada acima sem consumir permit.
      const release = this.semaphore.tryAcquire() ?? (await this.semaphore.acquire());
      try {
        if (isPiperPersistentOn()) {
          // Caminho PERSISTENTE (spec T2.1): reutiliza um processo quente. A chave e
          // `model|lengthScale` porque os params de qualidade (noise/silence) sao
          // FIXOS no spawn e HOJE globalmente uniformes (VOICE_PARAM_OVERRIDES vazio);
          // se um dia houver overrides de noise por-voz, incluir params na key.
          const key = `${req.model}|${lengthScale}`;
          const poolArgs = [
            '--model',
            modelPath,
            '--json-input',
            '--length_scale',
            String(lengthScale),
            '--noise_scale',
            String(params.noiseScale),
            '--noise_w',
            String(params.noiseW),
            '--sentence_silence',
            String(params.sentenceSilence),
          ];
          let poolOk = false;
          try {
            await getPiperPool().synth(key, poolArgs, req.text, outPath, PIPER_TIMEOUT_MS);
            // Valida o resultado do POOL AQUI: se (por qualquer anomalia do protocolo
            // de stdout) o WAV ficou vazio/ausente, tratamo-lo como falha do pool e
            // caimos no one-shot. Assim o check final (mais abaixo) so dispara se ATE
            // o one-shot falhar — fecha o unico caminho do pool que nao tinha fallback.
            poolOk = existsSync(outPath) && statSync(outPath).size > 0;
          } catch (err) {
            log.warn(
              `[piper] persistent pool failed (${(err as Error).message}); using one-shot fallback`,
            );
          }
          if (!poolOk) {
            // Fallback: NUNCA perder uma sintese (pool encravou, spawn falhou, ou
            // produziu WAV vazio/ausente) → spawn one-shot de sempre.
            await this.runPiper(modelPath, outPath, lengthScale, params, req.text);
          }
        } else {
          await this.runPiper(modelPath, outPath, lengthScale, params, req.text);
        }
      } finally {
        release();
      }

      if (!existsSync(outPath) || statSync(outPath).size === 0) {
        throw new Error('Piper did not produce a WAV file (missing or empty output)');
      }

      // Pausa opcional: PREPENDER `leadSilenceMs` de silencio ao WAV base. Escreve
      // o ficheiro com silencio DENTRO do workDir (o `finally` limpa; cache.put
      // copia antes disso). A chave da cache ja inclui leadSilenceMs (ver cacheKey),
      // por isso a versao com/sem silencio nao colidem.
      if (req.leadSilenceMs && req.leadSilenceMs > 0) {
        const withSilence = concatWavs([silenceWav(req.leadSilenceMs), readFileSync(outPath)], {
          silenceMs: 0,
        });
        const silPath = join(workDir, 'out-silence.wav');
        writeFileSync(silPath, withSilence);
        return this.cache.put(key, silPath);
      }

      return this.cache.put(key, outPath);
    } finally {
      rmDirSafe(workDir);
    }
  }

  private runPiper(
    modelPath: string,
    outPath: string,
    lengthScale: number,
    params: SynthParams,
    text: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Flags de qualidade em underscore, a espelhar o estilo de --length_scale.
      // Todos os valores sao NUMEROS de config/calibracao (nunca strings de
      // utilizador) — formatados com String(); nada nao-confiavel entra nos args.
      const args = [
        '--model',
        modelPath,
        '--output_file',
        outPath,
        '--length_scale',
        String(lengthScale),
        '--noise_scale',
        String(params.noiseScale),
        '--noise_w',
        String(params.noiseW),
        '--sentence_silence',
        String(params.sentenceSilence),
      ];

      const child = spawn(this.piperPath, args, {
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let settled = false;
      let stderr = '';

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`Piper timeout (${PIPER_TIMEOUT_MS}ms)`));
      }, PIPER_TIMEOUT_MS);

      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Falha ao iniciar Piper: ${err.message}`));
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Piper saiu com codigo ${code}: ${stderr.trim()}`));
        }
      });

      // Se o Piper morre instantaneamente, escrever no stdin emite 'error' (EPIPE).
      // Sem listener, isso seria uma excecao nao tratada que crasha o processo.
      // O 'close'/'error' do child ja resolvem/rejeitam a sintese; aqui apenas
      // engolimos o erro do pipe (e rejeitamos defensivamente se ainda nao settled
      // e nao for EPIPE — EPIPE significa que o child ja fechou e o 'close' trata).
      child.stdin?.on('error', (err: NodeJS.ErrnoException) => {
        if (settled) return;
        if (err.code === 'EPIPE') return; // child morreu -> 'close' vai tratar
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Falha ao escrever no stdin do Piper: ${err.message}`));
      });

      // Texto a sintetizar vai pelo stdin (uma linha).
      try {
        child.stdin?.write(text.endsWith('\n') ? text : `${text}\n`);
        child.stdin?.end();
      } catch (err) {
        // write/end sincronos podem lancar se o stream ja estiver destruido.
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`Falha ao escrever no stdin do Piper: ${(err as Error).message}`));
        }
      }
    });
  }
}
