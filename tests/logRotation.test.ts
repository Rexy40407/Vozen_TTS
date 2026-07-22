// tests/logRotation.test.ts — supervisor log rotation MID-run (plan 028).
// Before this change rotation only ran at start-prod.mjs startup; a child in a
// crash-loop flooded logs/vozen.log without limit until the disk filled up. Covers: rotation on
// exceeding maxBytes on a mid-run write, seeding the counter from the already-existing
// file (rotation also at startup), and that write() NEVER throws even with the folder
// removed mid-run (degrades silently).
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeRotatingWriter } from '../scripts/logRotation.mjs';

const dirs: string[] = [];
function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), 'logrotation-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('makeRotatingWriter — mid-run rotation', () => {
  it('rotates to .1 when the bytes written exceed maxBytes, keeping 1 generation', () => {
    const dir = makeTmpDir();
    const writer = makeRotatingWriter(dir, 'vozen.log', 50);

    // 6 chunks of 10 bytes = 60 bytes, exceeds the limit of 50 mid-sequence.
    for (let i = 0; i < 6; i++) writer.write('0123456789');

    expect(existsSync(writer.rotatedFile)).toBe(true);
    expect(statSync(writer.currentFile).size).toBeLessThan(50);
  });

  it('keeps only 1 generation — successive rotations do not accumulate .2, .3, …', () => {
    const dir = makeTmpDir();
    const writer = makeRotatingWriter(dir, 'vozen.log', 20);

    for (let i = 0; i < 3; i++) writer.write('12345678901234567890123456789012345');

    expect(existsSync(writer.rotatedFile)).toBe(true);
    expect(existsSync(`${writer.rotatedFile}.1`)).toBe(false);
    expect(existsSync(`${writer.currentFile}.2`)).toBe(false);
  });

  it('seeds the counter from the size of the existing file (rotation also at startup)', () => {
    const dir = makeTmpDir();
    const filePath = join(dir, 'vozen.log');
    // File from a previous session already above the limit.
    writeFileSync(filePath, 'x'.repeat(100));

    const writer = makeRotatingWriter(dir, 'vozen.log', 50);

    // The constructor must have already rotated — without waiting for any write.
    expect(existsSync(writer.rotatedFile)).toBe(true);
    expect(readFileSync(writer.rotatedFile, 'utf8')).toBe('x'.repeat(100));
  });

  it('write() NEVER throws even with the folder removed mid-run (degrades silently)', () => {
    const dir = makeTmpDir();
    const writer = makeRotatingWriter(dir, 'vozen.log', 50);

    writer.write('linha inicial\n');
    rmSync(dir, { recursive: true, force: true });

    expect(() => writer.write('linha depois da pasta desaparecer\n')).not.toThrow();
    expect(() => writer.write('mais uma para garantir\n')).not.toThrow();
  });

  it('constructor NEVER throws even when the folder cannot be created', () => {
    const dir = makeTmpDir();
    // Creates a FILE where the writer will try to create a FOLDER — mkdirSync fails.
    const blockedDirPath = join(dir, 'bloqueado');
    writeFileSync(blockedDirPath, 'sou um ficheiro, não uma pasta');

    expect(() => {
      const writer = makeRotatingWriter(blockedDirPath, 'vozen.log', 50);
      writer.write('nunca deve lançar\n');
    }).not.toThrow();
  });
});
