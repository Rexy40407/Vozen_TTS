import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sweepOrphanSttTemps } from '../src/voice/transcriptionSession';

describe('sweepOrphanSttTemps — reconciliation of orphan STT WAVs (PRIVACY §2.4)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vozen-stt-sweep-'));
    writeFileSync(join(dir, 'vozen-stt-1234-abcdef-0.wav'), 'x');
    writeFileSync(join(dir, 'vozen-stt-1234-abcdef-1.wav'), 'x');
    writeFileSync(join(dir, 'other-file.wav'), 'x'); // not STT -> never touch
    writeFileSync(join(dir, 'vozen-stt-note.txt'), 'x'); // not a .wav -> never touch
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('deletes old STT temp files and preserves unrelated files', () => {
    // now in the future -> the just-created WAVs count as > 5 min old (orphans from a crash).
    const removed = sweepOrphanSttTemps(dir, Date.now() + 10 * 60_000);
    expect(removed).toBe(2);
    expect(existsSync(join(dir, 'vozen-stt-1234-abcdef-0.wav'))).toBe(false);
    expect(existsSync(join(dir, 'vozen-stt-1234-abcdef-1.wav'))).toBe(false);
    expect(existsSync(join(dir, 'other-file.wav'))).toBe(true);
    expect(existsSync(join(dir, 'vozen-stt-note.txt'))).toBe(true);
  });

  it('age guard: does not delete a recent WAV (may be alive in another process)', () => {
    const removed = sweepOrphanSttTemps(dir, Date.now()); // just-created files
    expect(removed).toBe(0);
    expect(readdirSync(dir)).toHaveLength(4);
  });

  it('nonexistent dir -> 0, without throwing', () => {
    expect(() => sweepOrphanSttTemps(join(dir, 'nope'))).not.toThrow();
    expect(sweepOrphanSttTemps(join(dir, 'nope'))).toBe(0);
  });
});
