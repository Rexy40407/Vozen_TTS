// src/tts/piperPool.ts
//
// Pool of PERSISTENT piper.exe processes (spec T2.1) to eliminate the overhead of
// spawn+model-load (~372ms measured) per synthesis. Each synthesis today spawns a
// fresh piper.exe; here we keep LONG-LIVED processes reused.
//
// PROTOCOL (validated empirically against the real piper.exe):
//  - `piper.exe --model M --json-input` stays alive reading ONE JSON object per LINE on
//    stdin: {"text":"...","output_file":"ABS\\PATH.wav"}.
//  - For each completed utterance, piper prints the finished `output_file` on STDOUT,
//    one line per request, in STRICT FIFO order. That line IS the completion signal —
//    we read stdout line by line; the Nth line = Nth request.
//  - The model loads ONCE at startup (~0.4s); subsequent utterances are just inference
//    (~0.1-0.3s). That is the gain.
//  - The per-line params (length_scale/noise) are IGNORED by this build — quality has to
//    come from CLI flags at spawn. So a hot process has FIXED params -> the pool key
//    includes model + length_scale.
import { log } from '../logging/logger';

/**
 * MINIMAL interface of a child process, enough to (a) inject a fake in tests and (b)
 * accept a real `child_process.ChildProcess` (via cast in the spawn wrapper). We only
 * expose what the protocol needs: write/close stdin, read stdout line by line, listen
 * for exit/error, and kill the process.
 */
export interface ChildLike {
  stdin: { write(s: string): void; end(): void };
  stdout: { on(event: 'data', cb: (chunk: Buffer | string) => void): unknown };
  on(event: 'exit' | 'error', cb: (arg?: unknown) => void): unknown;
  kill(signal?: string): void;
}

/** An in-flight utterance: the expected path, the callbacks, and the timeout timer. */
interface Pending {
  outPath: string;
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Wraps ONE piper child process for a FIXED (model, args) pair. The constructor
 * receives an already-spawned child (injectable in tests) + an `onExit(self)` callback
 * that the pool uses to remove this process from the map when it dies.
 */
export class PiperProcess {
  private readonly child: ChildLike;
  private readonly onExit: (self: PiperProcess) => void;
  // FIFO queue of in-flight utterances — piper resolves them in entry order.
  private readonly queue: Pending[] = [];
  private buffer = '';
  private _dead = false;
  private exitNotified = false;

  constructor(child: ChildLike, onExit: (self: PiperProcess) => void) {
    this.child = child;
    this.onExit = onExit;

    // Read stdout as a stream: accumulate chunks, split on '\n'; each complete line =
    // a finished output_file -> resolve the head of the FIFO (piper's strict order).
    this.child.stdout.on('data', (chunk: Buffer | string) => {
      this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      let nl: number;
      while ((nl = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, nl).trim(); // trim kills the Windows \r
        this.buffer = this.buffer.slice(nl + 1);
        if (line.length === 0) continue; // ignore empty/tail lines
        this.onLine(line);
      }
    });

    this.child.on('exit', () => this.die(new Error('Piper process exited')));
    this.child.on('error', (err) =>
      this.die(new Error(`Piper process error: ${(err as Error)?.message ?? err}`)),
    );
  }

  get dead(): boolean {
    return this._dead;
  }

  /**
   * Synthesizes `text` to `outPath`. Writes a JSON line to stdin and returns a promise
   * that resolves when piper prints the completed path on stdout (FIFO). Per-utterance
   * timeout: if `timeoutMs` passes without completion, the process is treated as stuck
   * -> it is killed, marked dead, and the rest are rejected.
   */
  synth(text: string, outPath: string, timeoutMs: number): Promise<void> {
    if (this._dead) {
      return Promise.reject(new Error('Piper process is dead and cannot accept work'));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Timeout = stuck process. Kill + reject this one and all the rest.
        log.warn(`[piperPool] utterance timeout (${timeoutMs}ms); terminating process`);
        this.kill();
        this.die(new Error(`Piper pool timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      this.queue.push({ outPath, resolve, reject, timer });

      // JSON.stringify handles quotes/newlines/backslashes safely.
      const line = JSON.stringify({ text, output_file: outPath }) + '\n';
      try {
        this.child.stdin.write(line);
      } catch (err) {
        // A synchronous write can throw if the stream is already destroyed.
        this.die(new Error(`Failed to write to piper stdin: ${(err as Error).message}`));
      }
    });
  }

  /** Kills the child process (best-effort). Does not trigger onExit on its own. */
  kill(): void {
    try {
      this.child.kill();
    } catch {
      // best-effort — the process may have already died.
    }
  }

  /** Resolves the head of the FIFO for a stdout line (completed path). */
  private onLine(line: string): void {
    const head = this.queue.shift();
    if (!head) {
      // stdout line with no pending utterance — piper diagnostic, ignore.
      return;
    }
    clearTimeout(head.timer);
    // Optional sanity-check: piper is strictly sequential, we ALWAYS resolve the head;
    // we only warn if the printed basename does not match the expected one.
    if (basename(line) !== basename(head.outPath)) {
      log.warn(`[piperPool] stdout path ('${line}') != expected path ('${head.outPath}')`);
    }
    head.resolve();
  }

  /**
   * Marks the process dead, rejects ALL pending utterances (clearing their timers), and
   * notifies the pool via onExit — ONLY once (guard). Called on
   * exit/error/timeout/stdin-failure.
   */
  private die(err: Error): void {
    this._dead = true;
    while (this.queue.length > 0) {
      const p = this.queue.shift()!;
      clearTimeout(p.timer);
      p.reject(err);
    }
    if (this.exitNotified) return;
    this.exitNotified = true;
    this.onExit(this);
  }
}

/** cross-platform basename (piper prints Windows paths with '\\'). */
function basename(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

/** A pool entry: the process + its idle timer. */
interface PoolEntry {
  proc: PiperProcess;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Pool of hot piper processes, keyed by `key` (= `model|lengthScale`). Keeps at most
 * `maxWarm` processes; when registering a NEW key that exceeds the limit, it evicts the
 * LEAST-RECENTLY-USED process (the Map's insertion order gives us the LRU). Each process
 * has an idle timer: after `idleMs` without work, it closes to free RAM.
 */
export class PiperPool {
  private readonly maxWarm: number;
  private readonly idleMs: number;
  private readonly spawn: (args: string[]) => ChildLike;
  // Map preserves insertion order -> the first key is the LRU. On access, we move the
  // key to the end (delete+set) to mark it most-recently-used.
  private readonly map = new Map<string, PoolEntry>();

  constructor(opts: { maxWarm: number; idleMs: number; spawn: (args: string[]) => ChildLike }) {
    this.maxWarm = Math.max(1, Math.floor(opts.maxWarm));
    this.idleMs = opts.idleMs;
    this.spawn = opts.spawn;
  }

  /**
   * Synthesizes via a hot process for `key`. If none exists (or it is dead), spawns a
   * new one (evicting the LRU if necessary). Marks `key` as most-recently-used, resets
   * the idle timer, and delegates to the process.
   */
  synth(
    key: string,
    args: string[],
    text: string,
    outPath: string,
    timeoutMs: number,
  ): Promise<void> {
    let entry = this.map.get(key);
    if (!entry || entry.proc.dead) {
      if (entry) this.remove(key, entry); // clean up the dead entry
      entry = this.register(key, args);
    }
    // Mark most-recently-used: reinsert at the end of the Map's order.
    this.map.delete(key);
    this.map.set(key, entry);
    this.resetIdle(key, entry);
    return entry.proc.synth(text, outPath, timeoutMs);
  }

  /** Kills and cleans up all processes (call on central shutdown). */
  shutdown(): void {
    for (const [key, entry] of this.map) {
      if (entry.idleTimer) clearTimeout(entry.idleTimer);
      entry.proc.kill();
      this.map.delete(key);
    }
  }

  /** Spawns and registers a new process for `key`, evicting the LRU if full. */
  private register(key: string, args: string[]): PoolEntry {
    if (this.map.size >= this.maxWarm) {
      // Evict the LRU (first key in insertion order) BEFORE inserting the new one.
      const lruKey = this.map.keys().next().value as string | undefined;
      if (lruKey !== undefined) {
        const lru = this.map.get(lruKey)!;
        this.remove(lruKey, lru);
      }
    }
    const child = this.spawn(args);
    const entry: PoolEntry = { proc: undefined as unknown as PiperProcess, idleTimer: null };
    // onExit removes the entry ONLY if it is still this process (identity guard:
    // the key may already have been re-spawned to another process).
    entry.proc = new PiperProcess(child, (self) => {
      const cur = this.map.get(key);
      if (cur && cur.proc === self) this.remove(key, cur);
    });
    this.map.set(key, entry);
    return entry;
  }

  /** Resets an entry's idle timer: after idleMs without work, closes it. */
  private resetIdle(key: string, entry: PoolEntry): void {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => {
      const cur = this.map.get(key);
      if (cur === entry) this.remove(key, entry);
    }, this.idleMs);
    // Does not hold the event loop (the process can exit even with hot pools).
    if (typeof entry.idleTimer.unref === 'function') entry.idleTimer.unref();
  }

  /** Kills the process, clears the idle timer, and removes the entry from the map. */
  private remove(key: string, entry: PoolEntry): void {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
    entry.proc.kill();
    // Only delete if the entry in the map is still this one (avoids deleting a live replacement).
    if (this.map.get(key) === entry) this.map.delete(key);
  }
}
