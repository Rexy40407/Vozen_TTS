// src/tts/kokoroEngine.ts
//
// KOKORO TTS engine (kokoro-onnx, ONNX/CPU) via a persistent Python sidecar
// (tools/kokoro_server.py). It is a LEAF engine: when it fails (sidecar down, timeout,
// unmapped language) it THROWS — on purpose, so the RouterEngine that wraps it falls
// back to gTTS. It does NOT do an internal fallback — it is a pure LEAF, unlike the
// decorator engines that wrap a fallback. Process management uses a persistent sidecar,
// but SERIAL (the sidecar reads stdin one line at a time), without GPU serialization.
//
// Own cache (namespace 'kokoro'): the same phrase/voice is reused; the LRU cleans it.

import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { AudioCache, cacheKey } from './cache';
import { lowerAllCapsRuns } from './deCaps';
import type { SynthRequest, TTSEngine } from './engine';
import { langKeyOfModel } from '../language/spokenPhrases';
import { log } from '../logging/logger';

/** Maximum time per synthesis (inference is ~1s; generous but finite ceiling). */
const SYNTH_TIMEOUT_MS = 30_000;
/** Maximum time waiting for the warmup {ready} (model load ~1s on CPU). */
const READY_TIMEOUT_MS = 30_000;

/**
 * Map language -> (Kokoro lang code, voice). The KEYS are what `langKeyOfModel`
 * returns (the prefix before the '_': en, pt, es, ...). Only the languages VALIDATED in
 * the Phase 0 spike go here; Mandarin ('zh') needs `misaki[zh]` (the espeak backend does
 * not do it) and is left out for now. A language absent from here => synth THROWS => the
 * router falls back to gTTS.
 */
export const KOKORO_VOICES: Record<string, { lang: string; voice: string }> = {
  en: { lang: 'en-us', voice: 'af_heart' },
  es: { lang: 'es', voice: 'ef_dora' },
  fr: { lang: 'fr-fr', voice: 'ff_siwis' },
  hi: { lang: 'hi', voice: 'hf_alpha' },
  it: { lang: 'it', voice: 'if_sara' },
  pt: { lang: 'pt-br', voice: 'pf_dora' },
  ja: { lang: 'ja', voice: 'jf_alpha' },
};

/**
 * Splits a command "python.exe script.py --flag" into [exe, ...args] respecting path
 * quotes (Windows: "C:\Program Files\..."). PURE.
 */
export function parseCommand(cmd: string): { exe: string; args: string[] } {
  const parts = cmd.match(/"[^"]+"|\S+/g) ?? [];
  const clean = parts.map((p) => (p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p));
  return { exe: clean[0] ?? '', args: clean.slice(1) };
}

/**
 * Resolves the sidecar command: uses KOKORO_CMD if given, otherwise AUTO-DETECTS the
 * venv + the server + the model + the voices in tools/. Returns null if something is
 * missing (=> the engine stays inert; in createPerUserEngine the 'kokoro' path becomes
 * gTTS itself).
 */
export function resolveKokoroCmd(
  explicit: string | undefined,
): { exe: string; args: string[] } | null {
  if (explicit && explicit.trim()) return parseCommand(explicit.trim());
  // The venv python is at Scripts/python.exe (Windows) or bin/python (Linux/macOS) —
  // tries both so the sidecar auto-detects on any platform (the VPS is Linux).
  const venvPy = [
    join(process.cwd(), 'tools', 'kokoro-venv', 'Scripts', 'python.exe'),
    join(process.cwd(), 'tools', 'kokoro-venv', 'bin', 'python'),
  ].find((p) => existsSync(p));
  const server = join(process.cwd(), 'tools', 'kokoro_server.py');
  const model = join(process.cwd(), 'tools', 'kokoro-v1.0.onnx');
  const voices = join(process.cwd(), 'tools', 'voices-v1.0.bin');
  if (venvPy && existsSync(server) && existsSync(model) && existsSync(voices)) {
    return { exe: venvPy, args: [server] };
  }
  return null;
}

interface Job {
  line: string;
  outPath: string;
  resolve: (p: string) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class KokoroEngine implements TTSEngine {
  private child: ChildProcess | null = null;
  private readonly queue: Job[] = [];
  private active: Job | null = null;
  private buffer = '';
  private ready = false;
  private starting = false;
  private tmpSeq = 0;
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cache: AudioCache,
    private readonly cmd: { exe: string; args: string[] } | null,
    // Spawn injection for tests (default: real child_process.spawn).
    private readonly spawnImpl: typeof spawn = spawn,
    // Injectable warmup deadline for tests.
    private readonly readyTimeoutMs: number = READY_TIMEOUT_MS,
  ) {}

  /** Is there a Kokoro sidecar installed in this instance? */
  get available(): boolean {
    return this.cmd !== null;
  }

  /** Starts the sidecar and loads the model now (avoids paying the cold-load on the 1st msg). */
  prewarm(): void {
    if (this.cmd) this.ensureChild();
  }

  async synth(req: SynthRequest): Promise<string> {
    if (!this.cmd) throw new Error('kokoro: sidecar unavailable');
    const m = KOKORO_VOICES[langKeyOfModel(req.model)];
    if (!m) throw new Error(`kokoro: unsupported language (${langKeyOfModel(req.model)})`);

    const key = cacheKey(req);
    const hit = this.cache.get(key);
    if (hit) return hit;

    let tmp: string | null = null;
    try {
      // lowerAllCapsRuns: without this, an ALL-CAPS "shout" could come out SPELLED in
      // Kokoro's G2P (see deCaps.ts). The cache key uses the ORIGINAL req (above).
      tmp = await this.enqueue(lowerAllCapsRuns(req.text), m.lang, m.voice, req.speed);
      return this.cache.put(key, tmp);
    } finally {
      if (tmp) {
        try {
          rmSync(tmp, { force: true });
        } catch {
          // best-effort
        }
      }
    }
  }

  private enqueue(text: string, lang: string, voice: string, speed: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const outPath = join(
        tmpdir(),
        `vozen-kokoro-${process.pid}-${this.tmpSeq++}-${randomUUID()}.wav`,
      );
      const line = JSON.stringify({ text, out: outPath, lang, voice, speed }) + '\n';
      this.queue.push({ line, outPath, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    if (this.active || this.queue.length === 0) return;
    if (!this.ensureChild()) {
      const err = new Error('kokoro: sidecar unavailable');
      for (const j of this.queue.splice(0)) j.reject(err);
      return;
    }
    if (!this.ready) return; // waiting for warmup; onLine calls pump() when ready
    const job = this.queue.shift()!;
    this.active = job;
    job.timer = setTimeout(() => {
      if (this.active !== job) return;
      this.active = null;
      job.reject(new Error(`kokoro: timeout ${SYNTH_TIMEOUT_MS}ms`));
      this.restart(); // a stuck request kills the sidecar -> restarts clean
    }, SYNTH_TIMEOUT_MS);
    try {
      this.child!.stdin!.write(job.line);
    } catch (e) {
      if (job.timer) clearTimeout(job.timer);
      this.active = null;
      job.reject(e as Error);
      this.restart();
    }
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
      child.stderr!.on('data', (c: Buffer) => log.info(`[kokoro-py] ${c.toString().trim()}`));
      child.on('exit', (code) => {
        if (this.child !== child) return; // event from an ALREADY-replaced child — ignore
        log.warn(`[kokoro] sidecar exited (code ${code})`);
        this.teardown();
      });
      child.on('error', (err) => {
        if (this.child !== child) return; // event from an ALREADY-replaced child — ignore
        log.warn('[kokoro] sidecar failure:', err);
        this.teardown();
      });
      child.stdin!.write(JSON.stringify({ warmup: true }) + '\n');
      this.warmupTimer = setTimeout(() => {
        this.warmupTimer = null;
        if (this.ready) return; // benign race: it became ready in the meantime
        log.warn(`[kokoro] sidecar was not ready after ${this.readyTimeoutMs}ms; restarting`);
        this.restart();
      }, this.readyTimeoutMs);
      this.warmupTimer.unref?.();
      return true;
    } catch (err) {
      log.warn('[kokoro] failed to start the sidecar:', err);
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
    let msg: { ok?: boolean; ready?: boolean; out?: string; error?: string };
    try {
      msg = JSON.parse(line);
    } catch {
      return; // non-protocol line (stray log) — ignore
    }
    if (msg.ready) {
      if (this.warmupTimer) {
        clearTimeout(this.warmupTimer);
        this.warmupTimer = null;
      }
      this.ready = true;
      this.starting = false;
      log.info('[kokoro] sidecar ready');
      this.pump();
      return;
    }
    const job = this.active;
    if (!job) return;
    this.active = null;
    if (job.timer) clearTimeout(job.timer);
    if (msg.ok && msg.out) job.resolve(msg.out);
    else job.reject(new Error(msg.error || 'kokoro: unknown error'));
    this.pump();
  }

  private teardown(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = null;
    }
    const err = new Error('kokoro: sidecar died');
    this.ready = false;
    this.starting = false;
    this.child = null;
    // Discard partial bytes from the dead process: otherwise they stick to the 1st line
    // of the respawned sidecar and break the JSON.parse (worst case: corrupt the `ready`).
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
