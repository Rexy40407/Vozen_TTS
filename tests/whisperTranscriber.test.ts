import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  WhisperOverloadError,
  WhisperTranscriber,
  resolveSttConcurrency,
} from '../src/voice/whisperTranscriber';

// FAKE Whisper sidecar: prints {ready} BY ITSELF on startup (no warmup prompt, like the
// real tools/whisper_sidecar.py), then responds to each line (=WAV path) with
// {text,lang} — or {error} — in 'fail'. 'never-ready' never emits {ready}.
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
        const path = s.trim();
        queueMicrotask(() => {
          if (behavior === 'ok') {
            child.stdout.emit(
              'data',
              Buffer.from(JSON.stringify({ text: `t:${path}`, lang: 'en' }) + '\n'),
            );
          } else {
            child.stdout.emit('data', Buffer.from(JSON.stringify({ error: 'boom' }) + '\n'));
          }
        });
      },
    };
    // Emits {ready} right after spawn (the real sidecar does so after loading the model).
    if (behavior !== 'never-ready') {
      queueMicrotask(() =>
        child.stdout.emit(
          'data',
          Buffer.from(JSON.stringify({ ready: true, model: 'base' }) + '\n'),
        ),
      );
    }
    return child;
  }) as unknown as typeof import('node:child_process').spawn;
}

describe('WhisperTranscriber', () => {
  let t: WhisperTranscriber | null = null;
  afterEach(() => {
    t?.dispose();
    t = null;
  });

  it('available=false with no command (sidecar not installed)', () => {
    t = new WhisperTranscriber(null);
    expect(t.available).toBe(false);
  });

  it('transcribes a WAV -> {text,lang} after the {ready}', async () => {
    t = new WhisperTranscriber({ exe: 'py', args: ['w.py'] }, fakeSidecar('ok'));
    const r = await t.transcribe('/tmp/a.wav');
    expect(r).toEqual({ text: 't:/tmp/a.wav', lang: 'en' });
  });

  it('serializes the requests (cap=1): responds in order', async () => {
    t = new WhisperTranscriber({ exe: 'py', args: ['w.py'] }, fakeSidecar('ok'));
    const [a, b] = await Promise.all([t.transcribe('/tmp/1.wav'), t.transcribe('/tmp/2.wav')]);
    expect(a.text).toBe('t:/tmp/1.wav');
    expect(b.text).toBe('t:/tmp/2.wav');
  });

  it('sidecar error -> rejects', async () => {
    t = new WhisperTranscriber({ exe: 'py', args: ['w.py'] }, fakeSidecar('fail'));
    await expect(t.transcribe('/tmp/a.wav')).rejects.toThrow(/boom/);
  });

  it('reuses the SAME process across requests (persistent)', async () => {
    const counter = { spawns: 0 };
    t = new WhisperTranscriber({ exe: 'py', args: ['w.py'] }, fakeSidecar('ok', counter));
    await t.transcribe('/tmp/1.wav');
    await t.transcribe('/tmp/2.wav');
    expect(counter.spawns).toBe(1);
  });

  it('rejects excess pending work with a typed overload error', async () => {
    t = new WhisperTranscriber({ exe: 'py', args: ['w.py'] }, fakeSidecar('never-ready'), 1000, {
      maxPending: 1,
    });
    const first = t.transcribe('/tmp/1.wav');
    await expect(t.transcribe('/tmp/2.wav')).rejects.toBeInstanceOf(WhisperOverloadError);
    t.dispose();
    await expect(first).rejects.toThrow(/morreu/);
  });
});

// GLOBAL STT concurrency cap (plan 029/ABUSE-01): default 1 (SPIKE-STT), with override
// via STT_MAX_CONCURRENCY — same pattern as resolvePiperConcurrency (src/tts/piper.ts).
describe('resolveSttConcurrency', () => {
  const ORIGINAL = process.env.STT_MAX_CONCURRENCY;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.STT_MAX_CONCURRENCY;
    else process.env.STT_MAX_CONCURRENCY = ORIGINAL;
  });

  it('no env -> default 1 (cap-1 recommended by SPIKE-STT)', () => {
    delete process.env.STT_MAX_CONCURRENCY;
    expect(resolveSttConcurrency()).toBe(1);
  });

  it('STT_MAX_CONCURRENCY=3 -> respects the override', () => {
    process.env.STT_MAX_CONCURRENCY = '3';
    expect(resolveSttConcurrency()).toBe(3);
  });

  it('invalid value (0, negative, non-integer, garbage) -> falls back to default 1', () => {
    for (const bad of ['0', '-1', '1.5', 'abc', '  ']) {
      process.env.STT_MAX_CONCURRENCY = bad;
      expect(resolveSttConcurrency()).toBe(1);
    }
  });
});
