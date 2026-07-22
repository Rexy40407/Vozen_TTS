import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOUNDS,
  SOUND_KEYS,
  SOUND_CHOICES,
  soundByKey,
  soundFilename,
} from '../src/content/sounds';

// Soundboard WAV directory (repo root /assets/sfx). The tests run from the root.
const SFX_DIR = join(__dirname, '..', 'assets', 'sfx');

describe('sounds — curated soundboard registry', () => {
  it('unique keys, kebab-ascii, non-empty name', () => {
    const seen = new Set<string>();
    for (const s of SOUNDS) {
      expect(s.key).toMatch(/^[a-z0-9-]+$/); // safe as a filename and as a choice value
      expect(s.name.length).toBeGreaterThan(0);
      expect(seen.has(s.key)).toBe(false); // no duplicates
      seen.add(s.key);
    }
  });

  it('choices within the Discord limit (<=25) and with name+value', () => {
    expect(SOUND_CHOICES.length).toBeLessThanOrEqual(25);
    expect(SOUND_CHOICES.length).toBe(SOUNDS.length);
    for (const c of SOUND_CHOICES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(SOUND_KEYS).toContain(c.value);
    }
  });

  it('soundByKey finds the clip and returns undefined for an unknown one', () => {
    expect(soundByKey(SOUND_KEYS[0])?.key).toBe(SOUND_KEYS[0]);
    expect(soundByKey('nao-existe')).toBeUndefined();
  });

  it('soundFilename is the key + .wav', () => {
    expect(soundFilename('airhorn')).toBe('airhorn.wav');
  });

  // Integrity: every registered clip MUST have its WAV on disk — otherwise /sound
  // would offer a choice that only produces silence (the player skips missing assets).
  // This test fails if someone adds an entry without the file (or vice versa).
  it('every registered clip has the matching WAV in assets/sfx/', () => {
    expect(SOUND_KEYS.length).toBeGreaterThan(0);
    for (const key of SOUND_KEYS) {
      expect(existsSync(join(SFX_DIR, soundFilename(key)))).toBe(true);
    }
  });
});
