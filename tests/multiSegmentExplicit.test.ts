// tests/multiSegmentExplicit.test.ts — EXPLICIT segments path (req.segments)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MultiSegmentEngine } from '../src/tts/multiSegment';
import { AudioCache } from '../src/tts/cache';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';

const SAMPLE_RATE = 22050;
const BLOCK_ALIGN = 2;

function makeWav(data: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * BLOCK_ALIGN, 28);
  header.writeUInt16LE(BLOCK_ALIGN, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const AVAILABLE = ['en_US-amy-medium', 'pt_PT-tugao-medium'];

describe('MultiSegmentEngine — EXPLICIT segments (req.segments)', () => {
  let dir: string;
  let cache: AudioCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'multiseg-explicit-'));
    cache = new AudioCache(dir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeBase(): { engine: TTSEngine; calls: SynthRequest[] } {
    const calls: SynthRequest[] = [];
    let n = 0;
    const engine: TTSEngine = {
      synth: vi.fn(async (req: SynthRequest) => {
        calls.push({ ...req });
        n += 1;
        const p = join(dir, `seg-${n}.wav`);
        writeFileSync(p, makeWav(Buffer.from([n, n, n, n])));
        return p;
      }),
    };
    return { engine, calls };
  }

  it('req.segments length 2 -> base.synth once per segment with the right {text,model} + concatenates', async () => {
    const { engine: base, calls } = makeBase();
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const req: SynthRequest = {
      text: 'isto ta a funcionar by the way',
      model: 'pt_PT-tugao-medium',
      speed: 1,
      segments: [
        { text: 'isto ta a funcionar', model: 'pt_PT-tugao-medium' },
        { text: 'by the way', model: 'en_US-amy-medium' },
      ],
    };

    const resolved = await eng.synth(req);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      text: 'isto ta a funcionar',
      model: 'pt_PT-tugao-medium',
      speed: 1,
    });
    expect(calls[1]).toMatchObject({ text: 'by the way', model: 'en_US-amy-medium', speed: 1 });

    const buf = readFileSync(resolved);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    const dataSize = buf.readUInt32LE(40);
    expect(dataSize).toBeGreaterThan(8); // 4 + silence + 4
  });

  it('PROPAGATES engine + gcloudBudget to EACH sub-request (otherwise Google HD falls back to gTTS)', async () => {
    // Regression (Phase 4 review): the gcloud engine is gated at the chokepoint by req.gcloudBudget.
    // If the per-segment path did not inherit it, a multilingual message from a Premium user
    // would reach GCloudEngine WITHOUT a budget -> fail-safe -> gTTS (Google HD only worked in
    // the novelty commands, not in normal chat). Each segment MUST carry engine + gcloudBudget.
    const { engine: base, calls } = makeBase();
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const budget = { scope: 'user', key: 'u1' } as const;
    const req: SynthRequest = {
      text: 'isto ta a funcionar by the way',
      model: 'pt_PT-tugao-medium',
      speed: 1,
      engine: 'gcloud',
      gcloudBudget: budget,
      segments: [
        { text: 'isto ta a funcionar', model: 'pt_PT-tugao-medium' },
        { text: 'by the way', model: 'en_US-amy-medium' },
      ],
    };

    await eng.synth(req);
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.engine).toBe('gcloud');
      expect(c.gcloudBudget).toEqual(budget);
    }
  });

  it('req.segments length 1 -> ONE call to base with the segment {text,model}', async () => {
    const { engine: base, calls } = makeBase();
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const req: SynthRequest = {
      text: 'ola mundo',
      model: 'pt_PT-tugao-medium',
      speed: 1.2,
      segments: [{ text: 'ola mundo', model: 'pt_PT-tugao-medium' }],
    };

    await eng.synth(req);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ text: 'ola mundo', model: 'pt_PT-tugao-medium', speed: 1.2 });
  });

  it('the cache key of explicit segments does NOT collide with a simple req of the same `text`', async () => {
    // T is MULTI-SCRIPT (EN + RU) so that the SIMPLE req also takes the
    // combined (script-based) path and produces its own 'multiseg' key. If the
    // two keys collided, the 2nd request would return the WAV of the 1st.
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    const T = `${en}. ${ru}`;

    // 1st engine: EXPLICIT per-segment path.
    const base1 = makeBase();
    const eng1 = new MultiSegmentEngine(base1.engine, AVAILABLE, cache);
    const explicitReq: SynthRequest = {
      text: T,
      model: 'pt_PT-tugao-medium',
      speed: 1,
      segments: [
        { text: en, model: 'en_US-amy-medium' },
        { text: ru, model: 'ru_RU-denis-medium' },
      ],
    };
    const explicitPath = await eng1.synth(explicitReq);

    // 2nd engine: per-SCRIPT path (no segments), SAME `text`.
    const base2 = makeBase();
    const eng2 = new MultiSegmentEngine(base2.engine, AVAILABLE, cache);
    const plainReq: SynthRequest = { text: T, model: 'pt_PT-tugao-medium', speed: 1 };
    const plainPath = await eng2.synth(plainReq);

    // Distinct cache keys -> distinct file paths (no collision).
    expect(explicitPath).not.toBe(plainPath);
  });
});
