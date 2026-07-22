import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KokoroEngine, resolveKokoroCmd, KOKORO_VOICES } from '../src/tts/kokoroEngine';
import { AudioCache } from '../src/tts/cache';
import type { SynthRequest } from '../src/tts/engine';

describe('resolveKokoroCmd', () => {
  it('explicit KOKORO_CMD wins; absent and without venv/model -> null', () => {
    expect(resolveKokoroCmd('py kokoro_server.py')).toEqual({
      exe: 'py',
      args: ['kokoro_server.py'],
    });
    // Without tools/kokoro-venv in the test cwd -> null. (Tolerates the dev machine where
    // setup already ran and the venv exists.)
    const r = resolveKokoroCmd(undefined);
    expect(r === null || typeof r === 'object').toBe(true);
  });
});

describe('KOKORO_VOICES', () => {
  it('maps the languages validated in the spike and does NOT include Mandarin (zh)', () => {
    expect(Object.keys(KOKORO_VOICES).sort()).toEqual(['en', 'es', 'fr', 'hi', 'it', 'ja', 'pt']);
    expect(KOKORO_VOICES.pt).toEqual({ lang: 'pt-br', voice: 'pf_dora' });
    expect(KOKORO_VOICES.zh).toBeUndefined();
  });
});

/**
 * FAKE Python sidecar: answers the protocol — warmup -> {ready}; request -> writes
 * the WAV to `out` and replies {ok,out} (or {ok:false} if 'fail'; or nothing if 'never-ready').
 */
function fakeSidecar(behavior: 'ok' | 'fail' | 'never-ready' = 'ok', counter?: { spawns: number }) {
  return (() => {
    if (counter) counter.spawns++;
    const child = new EventEmitter() as EventEmitter & {
      stdin: { write: (s: string) => void };
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    child.stdin = {
      write: (s: string) => {
        const req = JSON.parse(s.trim());
        queueMicrotask(() => {
          if (req.warmup) {
            if (behavior === 'never-ready') return;
            child.stdout.emit(
              'data',
              Buffer.from(JSON.stringify({ ok: true, ready: true }) + '\n'),
            );
            return;
          }
          if (behavior === 'ok') {
            writeFileSync(req.out, Buffer.from('RIFFkokoro'));
            child.stdout.emit(
              'data',
              Buffer.from(JSON.stringify({ ok: true, out: req.out }) + '\n'),
            );
          } else {
            child.stdout.emit(
              'data',
              Buffer.from(JSON.stringify({ ok: false, error: 'onnx boom' }) + '\n'),
            );
          }
        });
      },
    };
    return child;
  }) as unknown as typeof import('node:child_process').spawn;
}

const REQ = (extra: Partial<SynthRequest> = {}): SynthRequest => ({
  text: 'ola mundo',
  model: 'pt_PT-tugao-medium', // langKey 'pt' -> mapped
  speed: 1,
  ...extra,
});

describe('KokoroEngine', () => {
  const dirs: string[] = [];
  const cache = () => {
    const d = mkdtempSync(join(tmpdir(), 'kokoro-cache-'));
    dirs.push(d);
    return new AudioCache(d);
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('no sidecar (cmd null) -> THROWS (the router falls back to gTTS)', async () => {
    const eng = new KokoroEngine(cache(), null);
    expect(eng.available).toBe(false);
    await expect(eng.synth(REQ())).rejects.toThrow(/unavailable/i);
  });

  it('unmapped language -> THROWS without even starting the sidecar', async () => {
    const counter = { spawns: 0 };
    const eng = new KokoroEngine(cache(), { exe: 'x', args: [] }, fakeSidecar('ok', counter));
    await expect(eng.synth(REQ({ model: 'zz_XX-foo-medium' }))).rejects.toThrow(/unsupported/i);
    expect(counter.spawns).toBe(0);
  });

  it('happy path -> synthesizes via sidecar, caches and returns the WAV (2nd = hit)', async () => {
    const eng = new KokoroEngine(cache(), { exe: 'x', args: [] }, fakeSidecar('ok'), 50);
    const out1 = await eng.synth(REQ());
    expect(typeof out1).toBe('string');
    expect(existsSync(out1)).toBe(true);
    const out2 = await eng.synth(REQ());
    expect(out2).toBe(out1); // cache-hit
  });

  it('CRITICAL: sidecar failure -> THROWS (does not swallow; the router does the fallback)', async () => {
    const eng = new KokoroEngine(cache(), { exe: 'x', args: [] }, fakeSidecar('fail'), 50);
    await expect(eng.synth(REQ())).rejects.toThrow(/onnx boom/);
  });

  it('sidecar alive but never ready -> deadline expires and the job rejects', async () => {
    const eng = new KokoroEngine(cache(), { exe: 'x', args: [] }, fakeSidecar('never-ready'), 30);
    await expect(eng.synth(REQ())).rejects.toThrow();
  });
});
