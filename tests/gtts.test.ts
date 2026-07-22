import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  gttsLangOfModel,
  chunkText,
  deCapsForGoogle,
  GTTSEngine,
  retryAsync,
  isRetryableStatus,
  mapWithConcurrency,
} from '../src/tts/gtts';
import { createEngine } from '../src/tts/factory';
import { AudioCache } from '../src/tts/cache';
import type { AppConfig } from '../src/config/index';

/** Error tagged as in gtts.ts (retryable = transient). */
function tagged(msg: string, retryable: boolean): Error {
  const e = new Error(msg) as Error & { retryable: boolean };
  e.retryable = retryable;
  return e;
}
const noSleep = async () => {};

describe('gttsLangOfModel — Piper model id -> gTTS tl code', () => {
  it('uses the prefix before the "_" (ISO-639-1)', () => {
    expect(gttsLangOfModel('pt_BR-cadu-medium')).toBe('pt'); // pt = Brazil in Google
    expect(gttsLangOfModel('en_US-amy-medium')).toBe('en');
    expect(gttsLangOfModel('es_ES-davefx-medium')).toBe('es');
    expect(gttsLangOfModel('fr_FR-siwis-medium')).toBe('fr');
    expect(gttsLangOfModel('ru_RU-denis-medium')).toBe('ru');
    // gTTS-only synthetic Japanese voice (no Piper model): must map to tl=ja.
    expect(gttsLangOfModel('ja_JP-google-medium')).toBe('ja');
  });

  it('Chinese override (zh -> zh-CN) and fallback to English', () => {
    expect(gttsLangOfModel('zh_CN-chaowen-medium')).toBe('zh-CN');
    expect(gttsLangOfModel('semunderscore')).toBe('en');
    expect(gttsLangOfModel('')).toBe('en');
  });
});

describe('chunkText — splits by word respecting the limit', () => {
  it('short text -> 1 chunk', () => {
    expect(chunkText('ola amigos hello guys', 200)).toEqual(['ola amigos hello guys']);
  });

  it('empty/whitespace-only text -> []', () => {
    expect(chunkText('', 200)).toEqual([]);
    expect(chunkText('   ', 200)).toEqual([]);
  });

  it('splits at a word boundary and each chunk <= max', () => {
    const words = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(' ');
    const chunks = chunkText(words, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
    // Reconstruction by spaces preserves every word (none lost/cut).
    expect(chunks.join(' ').split(/\s+/)).toEqual(words.split(' '));
  });

  it('a word larger than max is force-cut', () => {
    const giant = 'x'.repeat(90);
    const chunks = chunkText(giant, 40);
    expect(chunks).toEqual(['x'.repeat(40), 'x'.repeat(40), 'x'.repeat(10)]);
  });

  it('giant word with surrogates: cuts by CODE POINT (encodeURIComponent never throws)', () => {
    // The leading 'a' MISALIGNS the boundaries (each emoji = 2 UTF-16 units), so a slice
    // by UTF-16 unit would leave a lone surrogate -> encodeURIComponent would throw
    // URIError (the bug). Cutting by code point (Array.from) avoids it.
    const giant = 'a' + '😀'.repeat(250);
    const chunks = chunkText(giant, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(() => encodeURIComponent(c)).not.toThrow(); // each chunk is valid text
    }
    expect(chunks.join('')).toBe(giant); // reconstructs the whole word
  });
});

// Bug (reported by Diogo, confirmed empirically in 22 languages): Google translate_tts
// SPELLS OUT all-caps words ("VOLTEI" -> "V O L T E I"). We lower runs of 2+ uppercase
// letters to lowercase before sending to Google, so they get READ.
describe('deCapsForGoogle — prevents Google from spelling out ALL-CAPS', () => {
  it('lowers an all-caps word to lowercase', () => {
    expect(deCapsForGoogle('VOLTEI')).toBe('voltei');
    expect(deCapsForGoogle('olá VOLTEI aqui')).toBe('olá voltei aqui');
    expect(deCapsForGoogle('NASA')).toBe('nasa');
    expect(deCapsForGoogle('OK')).toBe('ok');
  });

  it('does NOT touch lowercase, Title-Case, or a single uppercase letter', () => {
    expect(deCapsForGoogle('voltei')).toBe('voltei');
    expect(deCapsForGoogle('Voltei')).toBe('Voltei'); // only the "V" — 1 uppercase
    expect(deCapsForGoogle('I am a Robot')).toBe('I am a Robot'); // "I" stays
    expect(deCapsForGoogle('iPhone')).toBe('iPhone'); // no run of 2+
  });

  it('handles accents and digits', () => {
    expect(deCapsForGoogle('ÁGUA')).toBe('água'); // accented uppercase
    expect(deCapsForGoogle('COVID19')).toBe('covid19'); // run of letters + digits
    expect(deCapsForGoogle('GRITO!!!')).toBe('grito!!!'); // punctuation intact
  });

  it('empty -> empty', () => {
    expect(deCapsForGoogle('')).toBe('');
  });
});

describe('GTTSEngine.synth — sends the text WITHOUT all-caps to Google', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('the request q= uses the lowercase version of a caps word', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gtts-caps-'));
    let capturedUrl = '';
    const fetchImpl = vi.fn(async (url: string | URL) => {
      capturedUrl = String(url);
      throw tagged('stop-after-capture', false); // non-retryable: stops after capturing
    });
    const engine = new GTTSEngine(new AudioCache(dir), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });
    await engine
      .synth({ text: 'olá VOLTEI', model: 'es_ES-davefx-medium', speed: 1 })
      .catch(() => {});
    // The q parameter (already decoded by URLSearchParams) has the word in lowercase.
    const q = new URL(capturedUrl).searchParams.get('q');
    expect(q).toBe('olá voltei');
  });
});

describe('isRetryableStatus — 429/5xx transient; 403/4xx hard failure', () => {
  it('429 and 5xx -> retryable', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });
  it('403 and other 4xx -> NOT retryable', () => {
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
  });
});

describe('retryAsync — retries only transient errors, with a limit', () => {
  it('transient error 1x then success -> returns the result (retried)', async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n++;
      if (n === 1) throw tagged('blip', true);
      return 'ok';
    });
    const out = await retryAsync(fn, { retries: 2, sleep: noSleep });
    expect(out).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('NON-retryable error (e.g. timeout/403) -> fails IMMEDIATELY, no retry', async () => {
    const fn = vi.fn(async () => {
      throw tagged('timeout', false);
    });
    await expect(retryAsync(fn, { retries: 2, sleep: noSleep })).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  it('persistent transient error -> exhausts the attempts and propagates the last one', async () => {
    const fn = vi.fn(async () => {
      throw tagged('429', true);
    });
    await expect(retryAsync(fn, { retries: 2, sleep: noSleep })).rejects.toThrow('429');
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });
});

describe('GTTSEngine.fetchChunk — retry on fetch (via injected fetchImpl)', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('a momentary 503 is recovered on the 2nd attempt (same Google voice)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gtts-retry-'));
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls === 1)
        return { ok: false, status: 503, statusText: 'Service Unavailable' } as Response;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      } as Response;
    });
    const engine = new GTTSEngine(new AudioCache(dir), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });
    // synth calls fetchChunk; with 1 short chunk, ffmpeg converts the bytes. Here we only
    // exercise that it does NOT blow up on the 503 and that fetch was called 2x (recovered).
    await engine.synth({ text: 'ola', model: 'pt_BR-cadu-medium', speed: 1 }).catch(() => {});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('a 403 (block) is NOT retried — hard failure', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gtts-403-'));
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 403, statusText: 'Forbidden' }) as Response,
    );
    const engine = new GTTSEngine(new AudioCache(dir), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });
    await expect(
      engine.synth({ text: 'ola', model: 'pt_BR-cadu-medium', speed: 1 }),
    ).rejects.toThrow(/403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry
  });

  it('multi-chunk: does ONE fetch per chunk (fan-out), synthesis resolves/fails all the same', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gtts-multi-'));
    // 3 "words" of ~150 chars -> 3 chunks (cap 200, the word does not split).
    const text = `${'a'.repeat(150)} ${'b'.repeat(150)} ${'c'.repeat(150)}`;
    expect(chunkText(deCapsForGoogle(text), 200).length).toBe(3);
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        }) as Response,
    );
    const engine = new GTTSEngine(new AudioCache(dir), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });
    // ffmpeg on the fake bytes may fail — we only care about the number of fetches (1 per chunk).
    await engine.synth({ text, model: 'pt_BR-cadu-medium', speed: 1 }).catch(() => {});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('multi-chunk: a chunk with 403 rejects the whole synthesis (as in serial)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gtts-multi403-'));
    const text = `${'a'.repeat(150)} ${'b'.repeat(150)} ${'c'.repeat(150)}`;
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n++;
      if (n === 2) return { ok: false, status: 403, statusText: 'Forbidden' } as Response;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      } as Response;
    });
    const engine = new GTTSEngine(new AudioCache(dir), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: noSleep,
    });
    await expect(engine.synth({ text, model: 'pt_BR-cadu-medium', speed: 1 })).rejects.toThrow(
      /403/,
    );
  });
});

describe('mapWithConcurrency — order preserved, cap respected, rejection propagates', () => {
  it('preserves the input ORDER even with out-of-order completions', async () => {
    const items = [0, 1, 2, 3, 4, 5];
    // item i resolves after (items.length - i) ticks: the last ones resolve first.
    const out = await mapWithConcurrency(items, 3, async (n) => {
      await new Promise((r) => setTimeout(r, (items.length - n) * 2));
      return n * 10;
    });
    expect(out).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('never runs more than `limit` in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    expect(out).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThanOrEqual(2); // actually parallelized
  });

  it('a single rejection rejects the whole call', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
        if (n === 2) throw tagged('pedaço 2 rebentou', false);
        return n;
      }),
    ).rejects.toThrow(/pedaço 2 rebentou/);
  });
});

describe('createEngine — TTS_ENGINE=gtts selects the GTTSEngine', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });
  it('returns a GTTSEngine (no API key, no Piper path)', () => {
    dir = mkdtempSync(join(tmpdir(), 'gttscache-'));
    const cache = new AudioCache(dir);
    const cfg = { ttsEngine: 'gtts', openaiApiKey: undefined } as unknown as AppConfig;
    expect(createEngine(cfg, cache)).toBeInstanceOf(GTTSEngine);
  });
});
