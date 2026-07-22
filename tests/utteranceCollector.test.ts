import { describe, it, expect } from 'vitest';
import { UtteranceCollector } from '../src/voice/utteranceCollector';

// UTTERANCE segmenter for STT: accumulates PCM frames and closes an utterance when there is
// a silence GAP after speech (or when the cap is reached). See src/voice/utteranceCollector.
// In the tests we use bytesPerMs=2 (1 int16 sample = 1 ms) for simple arithmetic.

const BPM = 2;
/** PCM frame of `ms` (int16 LE): samples at 6000 (speech, RMS>>threshold) or 0 (silence). */
function frame(ms: number, voiced: boolean): Buffer {
  const b = Buffer.alloc(ms * BPM);
  if (voiced) for (let i = 0; i < ms; i++) b.writeInt16LE(6000, i * 2);
  return b;
}
function make() {
  return new UtteranceCollector({
    bytesPerMs: BPM,
    rmsThreshold: 350,
    silenceGapMs: 100,
    minUtteranceMs: 50,
    maxUtteranceMs: 1000,
  });
}

describe('UtteranceCollector — segmentation by silence', () => {
  it('only silence -> nothing (pre-speech silence is ignored)', () => {
    const c = make();
    expect(c.push(frame(200, false))).toBeNull();
    expect(c.flush()).toBeNull();
  });

  it('speech + silence gap -> emits an utterance', () => {
    const c = make();
    expect(c.push(frame(200, true))).toBeNull();
    const u = c.push(frame(100, false)); // 100ms silence >= gap 100, voice 200 >= min 50
    expect(u).not.toBeNull();
    expect(u!.voicedMs).toBe(200);
  });

  it('two utterances separated by a gap -> two emits', () => {
    const c = make();
    expect(c.push(frame(150, true))).toBeNull();
    const u1 = c.push(frame(120, false));
    expect(u1!.voicedMs).toBe(150);
    expect(c.push(frame(150, true))).toBeNull();
    const u2 = c.push(frame(120, false));
    expect(u2!.voicedMs).toBe(150);
  });

  it('short blip (< minUtteranceMs) is discarded', () => {
    const c = make();
    expect(c.push(frame(30, true))).toBeNull(); // 30ms of speech
    expect(c.push(frame(120, false))).toBeNull(); // gap, but 30 < min 50 -> discards
    expect(c.flush()).toBeNull();
  });

  it('long monologue -> forced close when the cap is reached', () => {
    const c = make();
    expect(c.push(frame(600, true))).toBeNull();
    const u = c.push(frame(600, true)); // total 1200 >= max 1000 -> closes
    expect(u).not.toBeNull();
    expect(u!.voicedMs).toBe(1200);
  });

  it('flush emits the pending final utterance (no gap)', () => {
    const c = make();
    expect(c.push(frame(200, true))).toBeNull();
    const u = c.flush();
    expect(u!.voicedMs).toBe(200);
  });

  it('gap IN THE MIDDLE of speech does not split the utterance (short silence < gap)', () => {
    const c = make();
    expect(c.push(frame(120, true))).toBeNull();
    expect(c.push(frame(60, false))).toBeNull(); // 60 < gap 100 -> continues
    expect(c.push(frame(120, true))).toBeNull();
    const u = c.push(frame(100, false)); // now closes
    expect(u!.voicedMs).toBe(240); // 120 + 120
  });
});
