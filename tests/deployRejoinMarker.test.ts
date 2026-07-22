import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEPLOY_REJOIN_MARKER,
  consumeDeployRejoinMarker,
  consumePlannedRejoinMarker,
  writePlannedRejoinMarker,
} from '../src/voice/deployRejoinMarker';

describe('deploy rejoin marker', () => {
  let dir: string;
  const now = 1_000_000;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vozen-deploy-rejoin-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts and consumes a fresh marker exactly once', () => {
    const marker = join(dir, DEPLOY_REJOIN_MARKER);
    writeFileSync(marker, '');
    utimesSync(marker, new Date(now), new Date(now));

    expect(consumeDeployRejoinMarker(dir, now + 1)).toBe(true);
    expect(consumeDeployRejoinMarker(dir, now + 2)).toBe(false);
  });

  it('removes a stale marker without authorizing a later restart', () => {
    const marker = join(dir, DEPLOY_REJOIN_MARKER);
    writeFileSync(marker, '');
    utimesSync(marker, new Date(now), new Date(now));

    expect(consumeDeployRejoinMarker(dir, now + 10 * 60_000 + 1)).toBe(false);
    expect(consumeDeployRejoinMarker(dir, now + 10 * 60_000 + 2)).toBe(false);
  });

  it('rejects a future marker instead of treating it as fresh', () => {
    const marker = join(dir, DEPLOY_REJOIN_MARKER);
    writeFileSync(marker, '');
    utimesSync(marker, new Date(now + 1), new Date(now + 1));

    expect(consumeDeployRejoinMarker(dir, now)).toBe(false);
  });

  it('restores only the calls that were live at a clean restart', () => {
    expect(writePlannedRejoinMarker(['G1', 'G2', 'G1'], dir)).toBe(true);
    // Windows can expose a file mtime a few milliseconds ahead of the immediately
    // subsequent Date.now(); a restarted process has far more than this gap.
    const scope = consumePlannedRejoinMarker(dir, Date.now() + 1_000);

    expect(scope).not.toBeNull();
    expect(scope).not.toBe('all');
    expect(scope instanceof Set && [...scope].sort()).toEqual(['G1', 'G2']);
    expect(consumePlannedRejoinMarker(dir, Date.now() + 1_001)).toBeNull();
  });

  it('rejects malformed scoped data rather than restoring every stored call', () => {
    writeFileSync(join(dir, DEPLOY_REJOIN_MARKER), '{"guildIds":[42]}');

    expect(consumePlannedRejoinMarker(dir, Date.now() + 1_000)).toBeNull();
  });
});
