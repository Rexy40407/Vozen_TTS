import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb } from '../src/store/db';
import { isDetectionOn, setDetection } from '../src/store/langDetect';

describe('langDetect store — /voice detection toggle (opt-in, default OFF)', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });
  function freshDb() {
    dir = mkdtempSync(join(tmpdir(), 'vozen-ld-'));
    return initDb(join(dir, 't.db'));
  }

  it('default OFF; on/off round-trip; turning on twice is idempotent', () => {
    const db = freshDb();
    expect(isDetectionOn(db, 'g', 'u')).toBe(false); // default OFF (no row)
    setDetection(db, 'g', 'u', true);
    expect(isDetectionOn(db, 'g', 'u')).toBe(true);
    setDetection(db, 'g', 'u', true); // idempotent (ON CONFLICT DO NOTHING)
    expect(isDetectionOn(db, 'g', 'u')).toBe(true);
    setDetection(db, 'g', 'u', false);
    expect(isDetectionOn(db, 'g', 'u')).toBe(false); // back to default
    db.close();
  });

  it('scoped per (guild,user): one user ON does not affect others', () => {
    const db = freshDb();
    setDetection(db, 'g', 'u1', true);
    expect(isDetectionOn(db, 'g', 'u1')).toBe(true);
    expect(isDetectionOn(db, 'g', 'u2')).toBe(false); // other user in same guild
    expect(isDetectionOn(db, 'g2', 'u1')).toBe(false); // same user in another guild
    db.close();
  });
});
