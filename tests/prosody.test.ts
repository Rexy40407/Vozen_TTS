import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isQuestion,
  splitTailWav,
  ProsodyEngine,
  QUESTION_FILTER,
  EXCLAMATION_FILTERS,
} from '../src/tts/prosody';
import { silenceWav, parseWav, buildWav } from '../src/tts/wavConcat';
import { AudioCache } from '../src/tts/cache';
import type { SynthRequest, TTSEngine } from '../src/tts/engine';

describe('isQuestion — the speech ends with "?"', () => {
  it('true when it ends with "?" (tolerates quotes/parentheses/spaces)', () => {
    expect(isQuestion('tudo bem?')).toBe(true);
    expect(isQuestion('a sério?  ')).toBe(true);
    expect(isQuestion('(estás aí?)')).toBe(true);
    expect(isQuestion('ele disse "queres?"')).toBe(true);
  });

  it('recognizes localized question marks', () => {
    expect(isQuestion('هل أنت بخير؟')).toBe(true);
    expect(isQuestion('大丈夫？')).toBe(true);
    expect(isQuestion('ինչպե՞ս')).toBe(true);
    expect(isQuestion('ደህና ነህ፧')).toBe(true);
  });

  it('false when it is not a question or the "?" is in the middle', () => {
    expect(isQuestion('olá tudo bem')).toBe(false);
    expect(isQuestion('a sério? claro que sim')).toBe(false); // "?" in the middle
    expect(isQuestion('cuidado!')).toBe(false);
    expect(isQuestion('WHAT?!')).toBe(false); // ends with "!" -> a shout, not a question
    expect(isQuestion('')).toBe(false);
  });
});

describe('QUESTION_FILTER — uses only CORE ffmpeg filters', () => {
  it('is asetrate+aresample+atempo (same mechanic as deep/chipmunk)', () => {
    expect(QUESTION_FILTER).toContain('asetrate=22050');
    expect(QUESTION_FILTER).toContain('aresample=22050');
    expect(QUESTION_FILTER).toContain('atempo=');
  });
});

describe('splitTailWav — cuts the last ms as a WAV', () => {
  it('splits a valid WAV into [body, tail] with the sum of durations intact', () => {
    const wav = silenceWav(1000); // 22050 samples * 2 bytes = 44100 bytes de dados
    const split = splitTailWav(wav, 500);
    expect(split).not.toBeNull();
    const headLen = parseWav(split!.head, 0).data.length;
    const tailLen = parseWav(split!.tail, 0).data.length;
    expect(tailLen).toBe(11025 * 2); // 500 ms @ 22050 Hz, 16-bit mono
    expect(headLen + tailLen).toBe(44100); // nothing is lost
  });

  it('short speech -> empty body, tail = everything', () => {
    const wav = silenceWav(200); // 4410 samples
    const split = splitTailWav(wav, 500);
    expect(split).not.toBeNull();
    expect(parseWav(split!.head, 0).data.length).toBe(0);
    expect(parseWav(split!.tail, 0).data.length).toBe(4410 * 2);
  });

  it('unexpected format (sample rate ≠ 22050) -> null (fail-safe)', () => {
    const wav = Buffer.from(silenceWav(300)); // mutable copy
    wav.writeUInt32LE(24000, 24); // patch the sample rate in the canonical header
    expect(splitTailWav(wav, 500)).toBeNull();
  });

  it('non-WAV -> null', () => {
    expect(splitTailWav(Buffer.from('isto não é um wav'), 500)).toBeNull();
  });
});

// Fake of the ffmpeg spawn: 'ok' writes a VALID WAV to out and exits 0; 'fail' exits 1.
function fakeFfmpeg(behavior: 'ok' | 'fail', filters?: string[]) {
  return ((_ff: string, args: readonly string[]) => {
    const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter; kill: () => void };
    child.stderr = new EventEmitter();
    child.kill = () => {};
    const filterIndex = args.indexOf('-af');
    if (filterIndex !== -1) filters?.push(args[filterIndex + 1]);
    queueMicrotask(() => {
      if (behavior === 'ok') {
        const outPath = args[args.length - 2]; // [..., outPath, '-y']
        writeFileSync(outPath, silenceWav(200)); // canonical WAV 22050/mono/16
        child.emit('close', 0);
      } else {
        child.stderr.emit('data', Buffer.from('bad filter'));
        child.emit('close', 1);
      }
    });
    return child;
  }) as unknown as typeof import('node:child_process').spawn;
}

const REQ_Q: SynthRequest = { text: 'tudo bem?', model: 'en_US-amy-medium', speed: 1 };
const innerReturning = (p: string): TTSEngine => ({ synth: async () => p });

describe('ProsodyEngine — question intonation', () => {
  const dirs: string[] = [];
  const cache = () => {
    const d = mkdtempSync(join(tmpdir(), 'q-cache-'));
    dirs.push(d);
    return new AudioCache(d);
  };
  const baseWav = () => {
    const d = mkdtempSync(join(tmpdir(), 'q-base-'));
    dirs.push(d);
    const p = join(d, 'base.wav');
    writeFileSync(p, silenceWav(1000));
    return p;
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('speech WITHOUT "?" -> returns the base WAV as-is (does not call ffmpeg)', async () => {
    const eng = new ProsodyEngine(innerReturning('/base.wav'), cache(), {
      spawnImpl: fakeFfmpeg('fail'), // would fail if it were called
    });
    expect(await eng.synth({ ...REQ_Q, text: 'olá tudo bem' })).toBe('/base.wav');
  });

  it('question -> new WAV in the "q" cache (valid) and cache-hit on the 2nd', async () => {
    const base = baseWav();
    const eng = new ProsodyEngine(innerReturning(base), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok'),
    });
    const out1 = await eng.synth({ ...REQ_Q });
    expect(out1).not.toBe(base);
    expect(existsSync(out1)).toBe(true);
    expect(() => parseWav(readFileSync(out1), 0)).not.toThrow(); // it is a valid WAV
    const out2 = await eng.synth({ ...REQ_Q });
    expect(out2).toBe(out1); // cache-hit
  });

  it('terminal exclamation -> language-independent falling contour', async () => {
    const base = baseWav();
    const filters: string[] = [];
    const eng = new ProsodyEngine(innerReturning(base), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok', filters),
    });
    const out = await eng.synth({ ...REQ_Q, text: 'cuidado!', emphasisSource: 'cuidado!' });
    expect(out).not.toBe(base);
    expect(filters).toContain(EXCLAMATION_FILTERS.soft);
  });

  it('strong exclamation uses the stronger contour', async () => {
    const base = baseWav();
    const filters: string[] = [];
    const eng = new ProsodyEngine(innerReturning(base), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok', filters),
    });
    await eng.synth({ ...REQ_Q, text: 'STOP!', emphasisSource: 'STOP!' });
    expect(filters).toContain(EXCLAMATION_FILTERS.strong);
  });

  it('uses emphasisSource, so an injected suffix cannot hide the user punctuation', async () => {
    const base = baseWav();
    const eng = new ProsodyEngine(innerReturning(base), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok'),
    });
    const out = await eng.synth({
      ...REQ_Q,
      text: 'Rexy said tudo bem a gif',
      emphasisSource: 'tudo bem?',
    });
    expect(out).not.toBe(base);
  });

  it('CRITICAL: ffmpeg failure -> falls back to the CLEAN VOICE (never throws)', async () => {
    const base = baseWav();
    const eng = new ProsodyEngine(innerReturning(base), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('fail'),
    });
    await expect(eng.synth({ ...REQ_Q })).resolves.toBe(base);
  });

  it('unexpected base sample rate is normalized, then receives the contour', async () => {
    const d = mkdtempSync(join(tmpdir(), 'q-odd-'));
    dirs.push(d);
    const odd = join(d, 'odd.wav');
    const wav = Buffer.from(silenceWav(1000));
    wav.writeUInt32LE(24000, 24); // wrong sample rate
    writeFileSync(odd, wav);
    const filters: string[] = [];
    const eng = new ProsodyEngine(innerReturning(odd), cache(), {
      ffmpegPath: '/fake/ffmpeg',
      spawnImpl: fakeFfmpeg('ok', filters),
    });
    await expect(eng.synth({ ...REQ_Q })).resolves.not.toBe(odd);
    expect(filters[0]).toBe('anull');
    expect(filters[1]).toBe(QUESTION_FILTER);
  });

  it('buildWav round-trip: the canonical header parses again', () => {
    const wav = buildWav(Buffer.alloc(100));
    expect(parseWav(wav, 0).data.length).toBe(100);
  });
});
