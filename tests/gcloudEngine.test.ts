import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GCloudEngine, bcp47OfModel, type GcloudUsage, type GcloudLimits } from '../src/tts/gcloud';
import { AudioCache } from '../src/tts/cache';
import { metrics } from '../src/metrics';
import type { SynthRequest } from '../src/tts/engine';

// A toy "WAV": the bytes do not matter for the test (we do not play them back), only that
// what Google returns as base64 lands intact on disk.
const FAKE_WAV = Buffer.from('RIFF....WAVEfake-linear16-pcm');

/** Fake fetch that returns { audioContent } (base64) with 200, and records the sent body. */
function okFetch(audio: Buffer): {
  impl: typeof fetch;
  calls: Array<{ url: string; body: unknown }>;
} {
  const calls: Array<{ url: string; body: unknown }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      async json() {
        return { audioContent: audio.toString('base64') };
      },
      async text() {
        return '';
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

let dir: string;
let cache: AudioCache;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gcloud-test-'));
  cache = new AudioCache(dir, 0); // 0 = no evict, isolated per test
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const req = (over: Partial<SynthRequest> = {}): SynthRequest => ({
  text: 'olá mundo',
  model: 'pt_PT-tuga-medium',
  speed: 1,
  engine: 'gcloud',
  ...over,
});

describe('bcp47OfModel — Piper model id -> BCP-47 languageCode', () => {
  it('pt_PT-... -> pt-PT', () => expect(bcp47OfModel('pt_PT-tuga-medium')).toBe('pt-PT'));
  it('en_US-amy-medium -> en-US', () => expect(bcp47OfModel('en_US-amy-medium')).toBe('en-US'));
  it('es_ES-... -> es-ES', () => expect(bcp47OfModel('es_ES-mls-medium')).toBe('es-ES'));
  it('ja_JP-... -> ja-JP', () => expect(bcp47OfModel('ja_JP-x-medium')).toBe('ja-JP'));
  it('without a recognizable locale -> en-US (safe fallback)', () =>
    expect(bcp47OfModel('weird')).toBe('en-US'));
});

describe('GCloudEngine — synthesis via the official Google Cloud TTS API', () => {
  it('POST synthesize; writes the WAV from the base64 audioContent; returns a path', async () => {
    const { impl, calls } = okFetch(FAKE_WAV);
    const eng = new GCloudEngine('KEY', cache, { fetchImpl: impl });
    const out = await eng.synth(req());
    expect(out.endsWith('.wav')).toBe(true);
    expect(readFileSync(out).equals(FAKE_WAV)).toBe(true);
    // 1 request, to the right endpoint, with the API key in the X-Goog-Api-Key header.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('texttospeech.googleapis.com');
    // Body: LINEAR16 + languageCode derived from the model.
    const body = calls[0].body as {
      audioConfig: { audioEncoding: string };
      voice: { languageCode: string };
      input: { text: string };
    };
    expect(body.audioConfig.audioEncoding).toBe('LINEAR16');
    expect(body.voice.languageCode).toBe('pt-PT');
  });

  it('reads from cache on the 2nd identical request (no 2nd call to Google)', async () => {
    const { impl, calls } = okFetch(FAKE_WAV);
    const eng = new GCloudEngine('KEY', cache, { fetchImpl: impl });
    const a = await eng.synth(req());
    const b = await eng.synth(req());
    expect(a).toBe(b);
    expect(calls).toHaveLength(1); // cache hit on the 2nd
  });

  it('UPPERCASE in runs of 2+ is lowered in the input (does not spell out)', async () => {
    const { impl, calls } = okFetch(FAKE_WAV);
    const eng = new GCloudEngine('KEY', cache, { fetchImpl: impl });
    await eng.synth(req({ text: 'VOLTEI já' }));
    const body = calls[0].body as { input: { text: string } };
    expect(body.input.text).toBe('voltei já');
  });

  it('HTTP != ok -> throw (so the RouterEngine falls back to gTTS)', async () => {
    const impl = (async () =>
      ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        async text() {
          return 'API key invalid';
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const eng = new GCloudEngine('KEY', cache, { fetchImpl: impl });
    await expect(eng.synth(req())).rejects.toThrow(/403/);
  });

  it('empty audioContent -> throw', async () => {
    const impl = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        async json() {
          return { audioContent: '' };
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const eng = new GCloudEngine('KEY', cache, { fetchImpl: impl });
    await expect(eng.synth(req())).rejects.toThrow();
  });
});

// Phase 3 — allowances/counters at the CHOKEPOINT. With `limits`+`usage`, the engine counts
// the chars ONLY on the real call (cache-miss) and DENIES (throw -> the RouterEngine falls
// back to gTTS) when: there is no budget (fail-safe), the text exceeds maxChars, the monthly
// pool is exhausted, or the global/day backstop blows. Without `limits` (Phase 1) none of
// this applies.
function memUsage(): GcloudUsage & {
  store: Map<string, number>;
  getMonthly: (scope: string, key: string, month: string) => number;
  addMonthly: (scope: string, key: string, month: string, chars: number) => void;
} {
  const store = new Map<string, number>();
  const k = (s: string, key: string, mo: string) => `${s}|${key}|${mo}`;
  return {
    store,
    getMonthly: (s, key, mo) => store.get(k(s, key, mo)) ?? 0,
    addMonthly: (s, key, mo, chars) =>
      store.set(k(s, key, mo), (store.get(k(s, key, mo)) ?? 0) + chars),
    reserve: (s, key, mo, limit, day, dailyLimit, chars) => {
      const current = store.get(k(s, key, mo)) ?? 0;
      if (current + chars > limit) return false;
      const dailyKey = `daily|${day}`;
      const dailyCurrent = store.get(dailyKey) ?? 0;
      if (dailyLimit > 0 && dailyCurrent + chars > dailyLimit) return false;
      store.set(k(s, key, mo), current + chars);
      if (dailyLimit > 0) store.set(dailyKey, dailyCurrent + chars);
      return true;
    },
    refund: (s, key, mo, day, dailyLimit, chars) => {
      store.set(k(s, key, mo), Math.max(0, (store.get(k(s, key, mo)) ?? 0) - chars));
      if (dailyLimit > 0) {
        const dailyKey = `daily|${day}`;
        store.set(dailyKey, Math.max(0, (store.get(dailyKey) ?? 0) - chars));
      }
    },
  };
}
const LIMITS: GcloudLimits = {
  maxChars: 10,
  plusMonthly: 100,
  pass3Monthly: 400,
  pass8Monthly: 1000,
  dailyBudget: 500,
};
const FIXED_NOW = () => Date.UTC(2026, 6, 15, 12); // 2026-07-15 (month '2026-07')

describe('GCloudEngine — allowances at the chokepoint (Phase 3)', () => {
  beforeEach(() => metrics.reset());

  function eng(usage: GcloudUsage, over: Partial<GcloudLimits> = {}) {
    const { impl, calls } = okFetch(FAKE_WAV);
    return {
      engine: new GCloudEngine('KEY', cache, {
        fetchImpl: impl,
        usage,
        limits: { ...LIMITS, ...over },
        now: FIXED_NOW,
      }),
      calls,
    };
  }
  const budgeted = (over: Partial<SynthRequest> = {}): SynthRequest =>
    req({ text: 'ola', gcloudBudget: { scope: 'user', key: 'u1' }, ...over });

  it('gcloud WITHOUT budget + limits present -> throw (fail-safe), does NOT call Google', async () => {
    const u = memUsage();
    const { engine, calls } = eng(u);
    await expect(engine.synth(req({ text: 'ola' }))).rejects.toThrow(); // no gcloudBudget
    expect(calls).toHaveLength(0);
    expect(metrics.snapshot().gcloudFallbacks).toBe(1);
  });

  it('text above maxChars -> throw, does NOT call Google', async () => {
    const u = memUsage();
    const { engine, calls } = eng(u);
    await expect(engine.synth(budgeted({ text: 'x'.repeat(11) }))).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('under the monthly limit -> synthesizes and COUNTS the chars in the right pool', async () => {
    const u = memUsage();
    const { engine, calls } = eng(u);
    await engine.synth(budgeted({ text: 'ola' })); // 3 chars
    expect(calls).toHaveLength(1);
    expect(u.getMonthly('user', 'u1', '2026-07')).toBe(3);
    expect(metrics.snapshot().gcloudChars).toBe(3);
    expect(metrics.snapshot().gcloudSynths).toBe(1);
  });

  it('monthly pool EXHAUSTED -> throw, does NOT call Google', async () => {
    const u = memUsage();
    u.addMonthly('user', 'u1', '2026-07', 99); // plus limit = 100; 1 left
    const { engine, calls } = eng(u);
    await expect(engine.synth(budgeted({ text: 'ola' }))).rejects.toThrow(); // 3 > 1 -> denied
    expect(calls).toHaveLength(0);
    expect(metrics.snapshot().gcloudFallbacks).toBe(1);
  });

  it('cache-hit does NOT count (no Google cost on the 2nd identical request)', async () => {
    const u = memUsage();
    const { engine, calls } = eng(u);
    await engine.synth(budgeted({ text: 'ola' }));
    await engine.synth(budgeted({ text: 'ola' })); // cache-hit
    expect(calls).toHaveLength(1);
    expect(u.getMonthly('user', 'u1', '2026-07')).toBe(3); // counted only once
  });

  it('PASS pool uses the tier by seats (3 servers -> pass3Monthly)', async () => {
    const u = memUsage();
    u.addMonthly('pass', 'owner-1', '2026-07', 399); // pass3 = 400; 1 left
    const { engine, calls } = eng(u);
    const r = req({ text: 'ola', gcloudBudget: { scope: 'pass', key: 'owner-1', seats: 3 } });
    await expect(engine.synth(r)).rejects.toThrow(); // 3 > 1 -> denied (3-server tier)
    expect(calls).toHaveLength(0);
  });

  it('GLOBAL/day backstop blows -> throw even with monthly pool available', async () => {
    const u = memUsage();
    const { engine, calls } = eng(u, { dailyBudget: 2 }); // low daily ceiling
    await expect(engine.synth(budgeted({ text: 'ola' }))).rejects.toThrow(); // 3 > 2 daily
    expect(calls).toHaveLength(0);
  });

  it('concurrency: 2 syntheses from the SAME pool do not exceed the ceiling (check-then-act race)', async () => {
    // fetch with a barrier: both requests pass validation before Google responds.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls: string[] = [];
    const impl = (async (_url: string, init?: RequestInit) => {
      calls.push(String((init as { body?: string } | undefined)?.body ?? ''));
      await gate;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async json() {
          return { audioContent: FAKE_WAV.toString('base64') };
        },
        async text() {
          return '';
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const u = memUsage();
    // Monthly pool = 5: fits ONE synthesis of 3 chars, not two (3+3=6 > 5).
    const engine = new GCloudEngine('KEY', cache, {
      fetchImpl: impl,
      usage: u,
      limits: { ...LIMITS, plusMonthly: 5 },
      now: FIXED_NOW,
    });
    const pool = { scope: 'user', key: 'u1' } as const;
    // DIFFERENT texts (distinct cache keys) but the SAME budget pool.
    const p1 = engine.synth(req({ text: 'aaa', gcloudBudget: pool }));
    const p2 = engine.synth(req({ text: 'bbb', gcloudBudget: pool }));
    release();
    const results = await Promise.allSettled([p1, p2]);

    // Only ONE could go to Google; the pool never exceeds the ceiling.
    expect(calls.length).toBe(1);
    expect(u.getMonthly('user', 'u1', '2026-07')).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('failed synthesis returns the reservation to the pool (refund)', async () => {
    const u = memUsage();
    const impl = (async () =>
      ({
        ok: false,
        status: 500,
        statusText: 'Err',
        async text() {
          return 'boom';
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const engine = new GCloudEngine('KEY', cache, {
      fetchImpl: impl,
      usage: u,
      limits: LIMITS,
      now: FIXED_NOW,
    });
    await expect(
      engine.synth(req({ text: 'ola', gcloudBudget: { scope: 'user', key: 'u1' } })),
    ).rejects.toThrow();
    // Failed -> must not consume budget.
    expect(u.getMonthly('user', 'u1', '2026-07')).toBe(0);
  });
});
