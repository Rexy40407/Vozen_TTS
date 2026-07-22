// src/tts/gtts.ts — FREE TTS engine via Google Translate TTS ("gTTS").
//
// Why: Piper (self-hosted) reads foreign words mechanically. Google's voices (neural,
// multilingual) read MIXED text naturally in a single voice — it is what Discord-TTS uses
// by default. This engine brings that quality to Vozen WITHOUT an API key or cost, behind
// the TTS_ENGINE=gtts flag.
//
// WARNING (honest fragility): the translate_tts endpoint is UNOFFICIAL. Google may rate
// limit by IP (HTTP 429) or change it without notice. That is why it is OPT-IN and Piper
// remains the default/fallback. Each request has a ~200-character limit, so long text is
// split into chunks, synthesized, and concatenated.
//
// Format: gTTS returns MP3; we convert it to WAV 22050Hz mono 16-bit (the SAME as Piper)
// via ffmpeg-static, to fit frictionlessly into the pipeline (cache, leadSilenceMs,
// player).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { rmDirSafe } from './cleanupDir';
import { lowerAllCapsRuns } from './deCaps';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import type { SynthRequest, TTSEngine } from './engine';
import { AudioCache, cacheKey } from './cache';
import { concatWavs, silenceWav } from './wavConcat';
import { log } from '../logging/logger';

const GTTS_URL = 'https://translate.google.com/translate_tts';
const GTTS_TIMEOUT_MS = 15000;
/**
 * Maximum time for the MP3→WAV conversion via ffmpeg. A conversion of a short chunk is
 * sub-second; this ceiling (same as the network one) guarantees a STUCK ffmpeg never
 * leaves the Promise unresolved — which would stall the playback worker forever (gTTS is
 * the default engine). Mirrors the PIPER_TIMEOUT_MS of the local engine.
 */
const GTTS_FFMPEG_TIMEOUT_MS = 15000;
/** Practical character limit per request of the translate_tts endpoint. */
const GTTS_MAX_CHARS = 200;
/** EXTRA attempts per request when the error is TRANSIENT (network/5xx/429). Default 2. */
const GTTS_DEFAULT_RETRIES = 2;
/** Max chunks fetched in parallel from Google. Default 3; 1 = serial (old). */
const GTTS_DEFAULT_CHUNK_CONCURRENCY = 3;

/**
 * map with BOUNDED CONCURRENCY, PRESERVING ORDER: runs `fn` over `items` with at most
 * `limit` invocations in flight, writing each result at the input's index (the output
 * array's order is the input's, independent of completion order — critical for the MP3
 * frames concatenated in the right order). If any `fn` rejects, the Promise.all rejects
 * (no unhandled rejection — all promises are tied to the same all).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
/** Base wait between attempts (linear backoff: 300ms, 600ms, …). */
const GTTS_RETRY_BASE_MS = 300;

/** Error tagged with whether it is worth retrying (transient) or not (hard failure). */
type TaggedError = Error & { retryable?: boolean };
function taggedError(message: string, retryable: boolean): TaggedError {
  const e = new Error(message) as TaggedError;
  e.retryable = retryable;
  return e;
}

/**
 * An HTTP status is TRANSIENT (worth retrying) when it is 429 (Google's momentary rate
 * limit) or 5xx (server error). 403 and other 4xx are HARD failures (retrying does not
 * help — e.g. a block). PURE.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Runs `fn`, retrying it up to `retries` times ONLY when the error is tagged as
 * `retryable` (transient), with linear backoff (`baseDelayMs` × attempt). A non-retryable
 * error (e.g. timeout, 403) fails IMMEDIATELY — avoids stacking waits. `sleep` is
 * injectable for tests. PURE (no global state). Propagates the last error.
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  opts: {
    retries: number;
    sleep: (ms: number) => Promise<void>;
    baseDelayMs?: number;
    onRetry?: (err: unknown, attempt: number) => void;
  },
): Promise<T> {
  const base = opts.baseDelayMs ?? GTTS_RETRY_BASE_MS;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = (err as TaggedError).retryable === true;
      if (!retryable || attempt === opts.retries) throw err;
      opts.onRetry?.(err, attempt);
      await opts.sleep(base * (attempt + 1));
    }
  }
  throw lastErr;
}
/** Google rejects fetch's default User-Agent; pretend to be a browser. */
const GTTS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/**
 * Language code for gTTS from a Piper model id. The `tl` of translate_tts is ISO-639-1
 * (e.g. 'pt', 'en', 'es') — which is exactly the model id's prefix before the '_'
 * (pt_BR -> 'pt', en_US -> 'en'). Some need an override (zh -> zh-CN). Without '_' or
 * unknown -> 'en'. NOTE: 'pt' in Google is Brazilian Portuguese by default, which is what
 * we want. PURE.
 */
export function gttsLangOfModel(model: string): string {
  const us = model.indexOf('_');
  const prefix = (us === -1 ? '' : model.slice(0, us)).toLowerCase();
  if (!prefix) return 'en';
  const override: Record<string, string> = { zh: 'zh-CN' };
  return override[prefix] ?? prefix;
}

/**
 * Splits `text` into chunks of <= `max` characters, breaking at WORD boundaries (never in
 * the middle of one). A word larger than `max` is force-cut (rare). Empty text -> []. PURE
 * and deterministic.
 */
export function chunkText(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > max) {
      // Giant word: close the current one and cut the word into `max`-sized pieces.
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
      // Cut by CODE POINT (Array.from), not by UTF-16 unit (w.slice): a cut in the middle
      // of a surrogate pair (emoji / non-BMP char) would leave a lone surrogate and the
      // encodeURIComponent of q= in fetchChunk would throw URIError -> speech would fail on
      // hostile input (spam of non-BMP without spaces). This way each chunk is valid text.
      // `max` now counts code points (<= UTF-16 chars), which is safer.
      const cps = Array.from(w);
      for (let i = 0; i < cps.length; i += max) chunks.push(cps.slice(i, i + max).join(''));
      continue;
    }
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= max) {
      cur += ` ${w}`;
    } else {
      chunks.push(cur);
      cur = w;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * Google translate_tts SPELLS OUT ALL-CAPS words (interprets them as acronyms):
 * "VOLTEI" -> "V-O-L-T-E-I", instead of reading the word. Confirmed empirically in 22 of
 * the bot's ~34 languages (es, en, fr, de, it, nl, pl, ro, tr, ar, sv, el, cs, da, lv,
 * ne, sk, sr, sw, vi, ca, cy; does NOT happen in pt, ru, uk, zh, fi, hu, is). For Vozen to
 * READ the word instead of spelling it, we lower RUNS of 2+ uppercase letters to lowercase
 * before sending to Google.
 *
 * It is gTTS-SPECIFIC: Piper (neural) already reads uppercase as a word, so the transform
 * lives here and not in cleanText (shared). A SINGLE uppercase letter (sentence start,
 * "I", "A", or the "V" of "Voltei") is NOT touched — only runs of 2+. Accepted trade-off:
 * legitimate acronyms ("NASA") become read as a word, but in chat ALL-CAPS is almost
 * always emphasis/shouting, not an acronym. PURE.
 *
 * The transform itself lives in deCaps.ts (shared with Kokoro/Neural, which have the
 * same problem); here we keep only the wrapper with the historical name and the gTTS note.
 */
export function deCapsForGoogle(text: string): string {
  return lowerAllCapsRuns(text);
}

export interface GttsOptions {
  /** injectable fetch (tests). Default: the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** injectable sleep (deterministic tests). Default: real setTimeout. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** EXTRA attempts per request for transient errors. Default GTTS_DEFAULT_RETRIES. */
  retries?: number;
  /** Max chunks fetched in parallel. Default GTTS_DEFAULT_CHUNK_CONCURRENCY. */
  chunkConcurrency?: number;
}

export class GTTSEngine implements TTSEngine {
  private readonly cache: AudioCache;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retries: number;
  private readonly chunkConcurrency: number;

  constructor(cache: AudioCache, opts: GttsOptions = {}) {
    this.cache = cache;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.retries = opts.retries ?? GTTS_DEFAULT_RETRIES;
    this.chunkConcurrency = opts.chunkConcurrency ?? GTTS_DEFAULT_CHUNK_CONCURRENCY;
  }

  async synth(req: SynthRequest): Promise<string> {
    const key = cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const lang = gttsLangOfModel(req.model);
    // deCapsForGoogle: prevents Google from SPELLING OUT all-caps words (see function).
    const chunks = chunkText(deCapsForGoogle(req.text), GTTS_MAX_CHARS);
    if (chunks.length === 0) {
      throw new Error('gTTS: empty text');
    }

    // One MP3 per chunk; the bytes are concatenated (MP3 frames of the same format) and
    // ffmpeg demuxes the whole stream at once. BOUNDED fan-out (default 3): chunks in
    // parallel, ORDER preserved in the array. The per-chunk retry/backoff (fetchChunk)
    // stays intact; a chunk that fails (attempts exhausted) rejects the whole synthesis —
    // exactly like the old serial loop.
    const mp3s = await mapWithConcurrency(chunks, this.chunkConcurrency, (c) =>
      this.fetchChunk(c, lang),
    );
    const mp3 = Buffer.concat(mp3s);

    let wav = await mp3ToWav(mp3, req.speed);
    // Lead silence (same semantics as Piper): PREPENDED to the WAV.
    if (req.leadSilenceMs && req.leadSilenceMs > 0) {
      wav = concatWavs([silenceWav(req.leadSilenceMs), wav], { silenceMs: 0 });
    }

    const workDir = mkdtempSync(join(tmpdir(), 'gtts-'));
    const outPath = join(workDir, 'out.wav');
    try {
      writeFileSync(outPath, wav);
      return this.cache.put(key, outPath);
    } finally {
      rmDirSafe(workDir);
    }
  }

  /**
   * Fetches ONE chunk, with RETRY for TRANSIENT failures (intermittent network, 5xx,
   * momentary 429) — Google translate_tts is an unofficial endpoint and fails now and then
   * for an instant. Does NOT retry timeouts (avoids stacking 15s×N) or 403/blocks (retrying
   * does not help). Keeps the SAME Google voice — does not switch engines.
   */
  private async fetchChunk(text: string, lang: string): Promise<Buffer> {
    return retryAsync(() => this.fetchChunkOnce(text, lang), {
      retries: this.retries,
      sleep: this.sleep,
      onRetry: (err, attempt) =>
        log.warn(`[gtts] attempt ${attempt + 1} failed (${(err as Error).message}); retrying`),
    });
  }

  /** One fetch attempt. Throws a TAGGED error (retryable) for the retry to decide. */
  private async fetchChunkOnce(text: string, lang: string): Promise<Buffer> {
    const url =
      `${GTTS_URL}?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}` +
      `&q=${encodeURIComponent(text)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GTTS_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { 'User-Agent': GTTS_UA },
        signal: controller.signal,
      });
    } catch (err) {
      const isTimeout = (err as Error)?.name === 'AbortError';
      const reason = isTimeout ? `timeout (${GTTS_TIMEOUT_MS}ms)` : (err as Error).message;
      // A timeout is NOT retryable (do not stack 15s waits); another network failure is transient.
      throw taggedError(`gTTS: network failure (${reason})`, !isTimeout);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // 429 = Google rate-limit (the price of an unofficial endpoint); 5xx = server error.
      // Both transient -> retry. 403/other 4xx -> hard failure.
      throw taggedError(
        `gTTS: HTTP ${res.status} ${res.statusText} (429 = Google rate limit)`,
        isRetryableStatus(res.status),
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw taggedError('gTTS: empty response', false);
    return buf;
  }
}

/**
 * Converts an MP3 buffer into WAV 22050Hz mono 16-bit (Piper's format) via ffmpeg-static.
 * `speed` != 1 applies the `atempo` filter (0.5–2.0). Uses temporary files (same pattern
 * as the rest of the pipeline). Rejects on ffmpeg error.
 */
function mp3ToWav(mp3: Buffer, speed: number): Promise<Buffer> {
  const ff = ffmpegPath as unknown as string | null;
  if (!ff) {
    return Promise.reject(new Error('gTTS: ffmpeg-static not found (run install.js)'));
  }
  // Guarded synchronous setup: if mkdtempSync/writeFileSync throws (disk full, EACCES),
  // we clean up the already-created workDir before propagating — otherwise it would leak a
  // temp dir per failed conversion.
  const workDir = mkdtempSync(join(tmpdir(), 'gtts-conv-'));
  const inPath = join(workDir, 'in.mp3');
  const outPath = join(workDir, 'out.wav');
  try {
    writeFileSync(inPath, mp3);
  } catch (err) {
    rmDirSafe(workDir);
    throw err;
  }

  const args = ['-hide_banner', '-loglevel', 'error', '-i', inPath];
  if (speed > 0 && Math.abs(speed - 1) > 1e-6) {
    const s = Math.min(2.0, Math.max(0.5, speed));
    args.push('-filter:a', `atempo=${s}`);
  }
  args.push('-ar', '22050', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav', outPath, '-y');

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    // Best-effort cleanup that NEVER throws: a failure to delete the tmp (e.g. Windows
    // EBUSY right after the SIGKILL, before the OS releases the dead ffmpeg's handles)
    // must not prevent the Promise from resolving/rejecting. CRITICAL: always settle BEFORE
    // calling cleanup(), otherwise a throw from cleanup (with the `settled` latch already
    // on) would leave the Promise PENDING forever and stall the guild's voice worker.
    const cleanup = (): void => {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore — best-effort cleanup
      }
    };
    // Time guard: a stuck ffmpeg (blocked child, clogged pipe) would never emit 'close' —
    // the Promise would stay pending and stall the guild's playback worker FOREVER. On
    // expiry, we kill the process and reject.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill('SIGKILL');
      } catch {
        // already dead
      }
      reject(new Error(`gTTS: ffmpeg exceeded ${GTTS_FFMPEG_TIMEOUT_MS}ms (killed)`));
      cleanup();
    }, GTTS_FFMPEG_TIMEOUT_MS);
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`gTTS: failed to start ffmpeg: ${err.message}`));
      cleanup();
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        let buf: Buffer;
        try {
          buf = readFileSync(outPath);
        } catch (e) {
          reject(new Error(`gTTS: failed to read the converted WAV: ${(e as Error).message}`));
          cleanup();
          return;
        }
        resolve(buf);
        cleanup();
      } else {
        reject(new Error(`gTTS: ffmpeg exited with ${code}: ${stderr.trim()}`));
        cleanup();
      }
    });
  });
}
