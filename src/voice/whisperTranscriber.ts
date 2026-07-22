// src/voice/whisperTranscriber.ts
//
// Client of the STT SIDECAR (tools/whisper_sidecar.py) — a PERSISTENT Python process that
// loads the faster-whisper model ONCE and transcribes N requests. Process management
// mirrored from KokoroEngine, with two deviations from the Kokoro protocol:
//   (1) the sidecar prints {"ready":true} ON ITS OWN at startup (there is no warmup message
//       to send — it loads the model and announces);
//   (2) 1 request = 1 LINE with the path to a WAV; response = {"text","lang"} or {"error"}.
// It is SERIAL (one line at a time on stdin) => gives for free the "cap of 1 concurrent
// transcription" that the spike asked for, so as not to saturate the CPU shared with Piper.
//
// Failing is safe: with no sidecar installed `available=false` and STT stays inert (the
// /transcribe command replies "unavailable"). A stuck request kills and restarts the sidecar.

import { spawn, type ChildProcess } from 'node:child_process';
import { log } from '../logging/logger';
import { Semaphore } from '../tts/semaphore';
import { metrics } from '../metrics';

/** Cap per transcription (the spike gave ~2.2s for 13.6s of speech; generous but finite cap). */
const TRANSCRIBE_TIMEOUT_MS = 30_000;
/** Cap waiting for {ready} (loading the `base` model ~1-2s on CPU; 1st time downloads ~140MB). */
const READY_TIMEOUT_MS = 120_000;
const MAX_PENDING_JOBS = 32;
const MAX_PENDING_AGE_MS = 60_000;

/**
 * GLOBAL CONCURRENCY cap for STT sessions (all guilds, whole process) — plan
 * 029/ABUSE-01. Each `new WhisperTranscriber` starts a PERSISTENT Python process with its
 * own faster-whisper `base` model in RAM (hundreds of MB); unlike Kokoro
 * (a singleton shared by all guilds), the Whispers multiply WITH the sessions. Without a
 * cap, N Premium guilds transcribing at the same time = N copies of the model in RAM — on the VPS
 * (which already OOMs at ~3.3GB, see CONTRIBUTING.md) that is enough to kill the WHOLE process (all
 * guilds lose TTS, not only STT degrades). `docs/SPIKE-STT.md` already recommended "cap of 1
 * concurrent transcription"; this applies it at the PROCESS level — the cap-1 WITHIN a session
 * (serial stdin, see `pump()`/`onLine()` below) already existed but never crossed sessions.
 * Default 1; override via `STT_MAX_CONCURRENCY` (positive integer) on instances with more RAM.
 */
export function resolveSttConcurrency(): number {
  const env = process.env.STT_MAX_CONCURRENCY;
  if (env !== undefined && env.trim() !== '') {
    const n = Number(env);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return 1;
}

/** Max number of concurrent STT sessions in this process (read ONCE when the module loads). */
export const MAX_CONCURRENT_STT = resolveSttConcurrency();

/**
 * GLOBAL STT session semaphore, shared by ALL guilds in this process. The handler
 * (`/transcribe start`) reserves a permit with `tryAcquire()` BEFORE starting the session
 * (synchronous — never waits, `null` signals the cap is reached) and releases it on ALL
 * teardown paths via the returned release closure (already idempotent — calling it twice does not
 * over-release, see `Semaphore.makeRelease`).
 */
export const globalSttSemaphore = new Semaphore(MAX_CONCURRENT_STT);

export interface Transcript {
  text: string;
  lang: string;
}

interface Job {
  path: string;
  createdAt: number;
  resolve: (t: Transcript) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** Typed signal so callers can render a retryable overload message without parsing strings. */
export class WhisperOverloadError extends Error {
  readonly code = 'whisper_overloaded';
  constructor(reason: 'full' | 'expired') {
    super(`whisper: queue ${reason}`);
    this.name = 'WhisperOverloadError';
  }
}

export interface WhisperQueuePolicy {
  maxPending?: number;
  maxPendingAgeMs?: number;
  now?: () => number;
}

export class WhisperTranscriber {
  private child: ChildProcess | null = null;
  private readonly queue: Job[] = [];
  private active: Job | null = null;
  private buffer = '';
  private ready = false;
  private starting = false;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cmd: { exe: string; args: string[] } | null,
    // Spawn injection for tests (default: the real child_process.spawn).
    private readonly spawnImpl: typeof spawn = spawn,
    private readonly readyTimeoutMs: number = READY_TIMEOUT_MS,
    private readonly queuePolicy: WhisperQueuePolicy = {},
  ) {}

  /** Is there a Whisper sidecar installed on this instance? */
  get available(): boolean {
    return this.cmd !== null;
  }

  /** Starts the sidecar now (loads the model before the 1st request). */
  prewarm(): void {
    if (this.cmd) this.ensureChild();
  }

  /** Transcribes a WAV file. Rejects if the sidecar does not exist, errors, or times out. */
  transcribe(wavPath: string): Promise<Transcript> {
    return new Promise<Transcript>((resolve, reject) => {
      if (!this.cmd) {
        reject(new Error('whisper: sidecar unavailable'));
        return;
      }
      // Includes the in-flight job in the finite budget. Keeping this bounded prevents a
      // long sidecar stall from accumulating unbounded PCM-derived WAV work in memory/disk.
      const maxPending = this.queuePolicy.maxPending ?? MAX_PENDING_JOBS;
      if (this.queue.length + (this.active ? 1 : 0) >= maxPending) {
        metrics.inc('sttOverloads');
        reject(new WhisperOverloadError('full'));
        return;
      }
      this.queue.push({ path: wavPath, createdAt: this.now(), resolve, reject });
      this.pump();
    });
  }

  /** Kills the sidecar and rejects whatever is pending (call when stopping transcription). */
  dispose(): void {
    this.restart();
  }

  private pump(): void {
    if (this.active || this.queue.length === 0) return;
    if (!this.ensureChild()) {
      const err = new Error('whisper: sidecar unavailable');
      for (const j of this.queue.splice(0)) j.reject(err);
      return;
    }
    if (!this.ready) return; // waiting for {ready}; onLine calls pump() once it becomes ready
    const job = this.nextFreshJob();
    if (!job) return;
    this.active = job;
    job.timer = setTimeout(() => {
      if (this.active !== job) return;
      this.active = null;
      job.reject(new Error(`whisper: timeout ${TRANSCRIBE_TIMEOUT_MS}ms`));
      this.restart(); // a stuck request kills the sidecar -> restarts clean
    }, TRANSCRIBE_TIMEOUT_MS);
    try {
      this.child!.stdin!.write(job.path + '\n');
    } catch (e) {
      if (job.timer) clearTimeout(job.timer);
      this.active = null;
      job.reject(e as Error);
      this.restart();
    }
  }

  private nextFreshJob(): Job | undefined {
    const maxAge = this.queuePolicy.maxPendingAgeMs ?? MAX_PENDING_AGE_MS;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      if (this.now() - job.createdAt <= maxAge) return job;
      metrics.inc('sttOverloads');
      job.reject(new WhisperOverloadError('expired'));
    }
    return undefined;
  }

  private now(): number {
    return this.queuePolicy.now?.() ?? Date.now();
  }

  private ensureChild(): boolean {
    if (this.child || this.starting) return true;
    if (!this.cmd) return false;
    try {
      this.starting = true;
      const child = this.spawnImpl(this.cmd.exe, this.cmd.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.child = child;
      child.stdout!.on('data', (c: Buffer) => this.onData(c));
      child.stderr!.on('data', (c: Buffer) => log.info(`[whisper-py] ${c.toString().trim()}`));
      child.on('exit', (code) => {
        if (this.child !== child) return; // event from an ALREADY-replaced child — ignore
        log.warn(`[whisper] sidecar exited (code ${code})`);
        this.teardown();
      });
      child.on('error', (err) => {
        if (this.child !== child) return; // event from an ALREADY-replaced child — ignore
        log.warn('[whisper] sidecar failure:', err);
        this.teardown();
      });
      this.readyTimer = setTimeout(() => {
        this.readyTimer = null;
        if (this.ready) return; // benign race
        log.warn(`[whisper] sidecar was not ready after ${this.readyTimeoutMs}ms; restarting`);
        this.restart();
      }, this.readyTimeoutMs);
      this.readyTimer.unref?.();
      return true;
    } catch (err) {
      log.warn('[whisper] failed to start the sidecar:', err);
      this.starting = false;
      this.child = null;
      return false;
    }
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line) this.onLine(line);
    }
  }

  private onLine(line: string): void {
    let msg: { ready?: boolean; text?: string; lang?: string; error?: string };
    try {
      msg = JSON.parse(line);
    } catch {
      return; // non-protocol line (stray log) — ignore
    }
    if (msg.ready) {
      if (this.readyTimer) {
        clearTimeout(this.readyTimer);
        this.readyTimer = null;
      }
      this.ready = true;
      this.starting = false;
      log.info('[whisper] sidecar ready');
      this.pump();
      return;
    }
    const job = this.active;
    if (!job) return;
    this.active = null;
    if (job.timer) clearTimeout(job.timer);
    if (msg.error !== undefined) job.reject(new Error(`whisper: ${msg.error}`));
    else job.resolve({ text: msg.text ?? '', lang: msg.lang ?? '' });
    this.pump();
  }

  private teardown(): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    const err = new Error('whisper: sidecar morreu');
    this.ready = false;
    this.starting = false;
    this.child = null;
    // Discard partial bytes from the dead process: otherwise they stick to the 1st line of the
    // respawned sidecar and break JSON.parse (worst case: they corrupt the {ready}).
    this.buffer = '';
    if (this.active) {
      if (this.active.timer) clearTimeout(this.active.timer);
      this.active.reject(err);
      this.active = null;
    }
    for (const j of this.queue.splice(0)) j.reject(err);
  }

  private restart(): void {
    try {
      this.child?.kill('SIGKILL');
    } catch {
      // already dead
    }
    this.teardown();
  }
}
