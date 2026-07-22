// tests/piper.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { PiperEngine, isSafeModelName } from '../src/tts/piper';
import { AudioCache } from '../src/tts/cache';
import type { SynthRequest } from '../src/tts/engine';

// Only child_process is mocked; fs is real (we need the model's existsSync guard
// + the cache's temporary directory).
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

const spawnMock = vi.mocked(spawn);

/**
 * Fake child: real EventEmitter with stdin/stderr (also EventEmitters) and
 * stdin.write/end + kill as spies. The listeners are registered synchronously
 * inside the Promise executor, so emitting right after synth() works.
 */
function makeFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  const stdin = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  stdin.write = vi.fn();
  stdin.end = vi.fn();
  child.stdin = stdin;
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('PiperEngine.synth — mocked spawn (EPIPE / failures)', () => {
  let dir: string;
  let modelsDir: string;
  let cache: AudioCache;
  let engine: PiperEngine;
  const req: SynthRequest = { text: 'ola', model: 'pt_PT-test', speed: 1 };

  beforeEach(() => {
    spawnMock.mockReset();
    dir = mkdtempSync(join(tmpdir(), 'pipercache-'));
    modelsDir = mkdtempSync(join(tmpdir(), 'pipermodels-'));
    // Dummy .onnx so the existsSync(modelPath) guard passes.
    writeFileSync(join(modelsDir, `${req.model}.onnx`), 'dummy');
    cache = new AudioCache(dir);
    engine = new PiperEngine('piper', modelsDir, cache);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(modelsDir, { recursive: true, force: true });
  });

  it('stdin emits EPIPE + child closes with code != 0 -> rejects cleanly, without crashing', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);

    const p = engine.synth(req);
    // The EPIPE on stdin should be swallowed (child died -> 'close' handles it).
    child.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    child.stderr.emit('data', Buffer.from('piper died'));
    child.emit('close', 1);

    await expect(p).rejects.toThrow(/saiu com codigo 1/);
  });

  it('stdin EPIPE followed by close(0) -> no WAV produced (settles, does not crash)', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);

    const p = engine.synth(req);
    child.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    child.emit('close', 0); // exited 0 but nothing written to outPath (real fs)

    await expect(p).rejects.toThrow(/did not produce a WAV/);
  });

  it('NON-EPIPE stdin error -> rejects with "Falha ao escrever no stdin"', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);

    const p = engine.synth(req);
    child.stdin.emit('error', Object.assign(new Error('boom'), { code: 'ERR_OTHER' }));

    await expect(p).rejects.toThrow(/Falha ao escrever no stdin do Piper/);
  });

  it('spawn fails (ENOENT) -> rejects with "Falha ao iniciar Piper"', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);

    const p = engine.synth(req);
    child.emit('error', Object.assign(new Error('spawn piper ENOENT'), { code: 'ENOENT' }));

    await expect(p).rejects.toThrow(/Falha ao iniciar Piper/);
  });

  it('synchronous write throws -> rejects cleanly with "Falha ao escrever no stdin"', async () => {
    const child = makeFakeChild();
    child.stdin.write.mockImplementation(() => {
      throw new Error('stream destroyed');
    });
    spawnMock.mockReturnValue(child as never);

    await expect(engine.synth(req)).rejects.toThrow(/Falha ao escrever no stdin do Piper/);
  });

  it('exit code != 0 (no EPIPE) -> rejects with code and stderr', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);

    const p = engine.synth(req);
    child.stderr.emit('data', Buffer.from('bad model'));
    child.emit('close', 2);

    await expect(p).rejects.toThrow(/saiu com codigo 2: bad model/);
  });

  it('calibration: spawn receives --length_scale ~1.65 for pt_PT-tugao-medium (1.5 ×1.10 organic)', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);
    const calibReq: SynthRequest = { text: 'ola', model: 'pt_PT-tugao-medium', speed: 1 };
    writeFileSync(join(modelsDir, `${calibReq.model}.onnx`), 'dummy');

    const p = engine.synth(calibReq);
    const args = spawnMock.mock.calls[0][1] as string[];
    const idx = args.indexOf('--length_scale');
    expect(idx).toBeGreaterThanOrEqual(0);
    // 1.5 × 1.10 = 1.6500000000000001 in floating point; the arg is String(number),
    // so we compare numerically with tolerance.
    expect(Number(args[idx + 1])).toBeCloseTo(1.65);

    // settle the promise so we do not leave a pending rejection
    child.emit('close', 1);
    await expect(p).rejects.toThrow();
  });

  // Quality params: with the engine built WITHOUT overrides (ORGANIC preset
  // defaults), the args carry noise_scale/noise_w/sentence_silence at the
  // organic defaults AND the length_scale reflects the ×1.10 calibration (tugao ~1.65).
  it('quality defaults: args carry --noise_scale/--noise_w/--sentence_silence at the organic defaults, length_scale ×1.10', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);
    const calibReq: SynthRequest = { text: 'ola', model: 'pt_PT-tugao-medium', speed: 1 };
    writeFileSync(join(modelsDir, `${calibReq.model}.onnx`), 'dummy');

    const p = engine.synth(calibReq);
    const args = spawnMock.mock.calls[0][1] as string[];

    const ls = args.indexOf('--length_scale');
    expect(Number(args[ls + 1])).toBeCloseTo(1.65); // tugao calibration (1.5) × 1.10 organic

    const ns = args.indexOf('--noise_scale');
    expect(ns).toBeGreaterThanOrEqual(0);
    expect(args[ns + 1]).toBe('0.75');

    const nw = args.indexOf('--noise_w');
    expect(nw).toBeGreaterThanOrEqual(0);
    expect(args[nw + 1]).toBe('0.95');

    const ss = args.indexOf('--sentence_silence');
    expect(ss).toBeGreaterThanOrEqual(0);
    expect(args[ss + 1]).toBe('0.4');

    child.emit('close', 1);
    await expect(p).rejects.toThrow();
  });

  // The engine accepts CUSTOM quality defaults (the path by which the global config
  // — NOISE_SCALE/etc — reaches the spawn via factory). They are reflected in the args.
  it('custom quality params on the engine are reflected in the spawn args', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child as never);
    const customEngine = new PiperEngine('piper', modelsDir, cache, {
      noiseScale: 0.5,
      noiseW: 0.9,
      sentenceSilence: 0.4,
    });

    const p = customEngine.synth(req);
    const args = spawnMock.mock.calls[0][1] as string[];

    expect(args[args.indexOf('--noise_scale') + 1]).toBe('0.5');
    expect(args[args.indexOf('--noise_w') + 1]).toBe('0.9');
    expect(args[args.indexOf('--sentence_silence') + 1]).toBe('0.4');

    child.emit('close', 1);
    await expect(p).rejects.toThrow();
  });
});

describe('isSafeModelName — model name validation (anti path-traversal)', () => {
  it('rejects names with separators, ".." or empty', () => {
    for (const bad of ['../../etc/x', '..\\x', 'a/b', 'a\\b', '/abs', '', '..', '.']) {
      expect(isSafeModelName(bad)).toBe(false);
    }
  });

  it('accepts real names (letters/digits/_/-, no separators)', () => {
    for (const good of [
      'en_US-amy-medium',
      'pt_BR-cadu-medium',
      'pt_PT-tugao-medium',
      'pt_PT-test',
    ]) {
      expect(isSafeModelName(good)).toBe(true);
    }
  });
});

describe('PiperEngine.synth — unsafe name guard (rejects before spawn)', () => {
  let dir: string;
  let modelsDir: string;
  let cache: AudioCache;
  let engine: PiperEngine;

  beforeEach(() => {
    spawnMock.mockReset();
    dir = mkdtempSync(join(tmpdir(), 'pipercache-'));
    modelsDir = mkdtempSync(join(tmpdir(), 'pipermodels-'));
    cache = new AudioCache(dir);
    engine = new PiperEngine('piper', modelsDir, cache);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(modelsDir, { recursive: true, force: true });
  });

  it('name with path-traversal -> rejects with "Invalid model name" and never spawns', async () => {
    const badReq: SynthRequest = { text: 'ola', model: '../../etc/passwd', speed: 1 };
    await expect(engine.synth(badReq)).rejects.toThrow(/Invalid model name/);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
