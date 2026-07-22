import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { purgeCloneDerivedAudio, CLONE_DERIVED_NAMESPACES } from '../src/tts/cache';

describe('purgeCloneDerivedAudio — deletion of effect-derived audio (GDPR)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vozen-cache-'));
    for (const ns of ['fx', 'q', 'piper']) {
      mkdirSync(join(root, ns), { recursive: true });
      writeFileSync(join(root, ns, 'a.wav'), 'x');
    }
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('covers the fx (voice-effect) namespace', () => {
    expect([...CLONE_DERIVED_NAMESPACES].sort()).toEqual(['fx']);
  });

  it('purges the effect-derived namespaces and preserves the others', () => {
    purgeCloneDerivedAudio(root);
    expect(existsSync(join(root, 'fx'))).toBe(false);
    expect(existsSync(join(root, 'q'))).toBe(true); // prosody: not effect-derived, untouched
    expect(existsSync(join(root, 'piper'))).toBe(true); // normal engine: untouched
  });

  it('does not throw if the cache root does not exist', () => {
    expect(() => purgeCloneDerivedAudio(join(root, 'nope'))).not.toThrow();
  });
});
