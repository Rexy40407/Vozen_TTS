import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

describe('Rust migration rollback documentation', () => {
  it('documents an isolated staging rollback without destroying the named volume', () => {
    const runbook = readFileSync(resolve(root, 'docs/RUST-MIGRATION-STAGING.md'), 'utf8');
    expect(runbook).toContain('## Abort and rollback');
    expect(runbook).toContain('docker compose -p vozen-staging');
    expect(runbook).toContain('Do not add `-v`');
    expect(runbook).toContain('Never run Node and Rust concurrently with the same Discord token');
  });

  it('requires integrity checks and a preserved SQLite backup before production fallback', () => {
    const runbook = readFileSync(resolve(root, 'docs/RUST-MIGRATION-STAGING.md'), 'utf8');
    expect(runbook).toContain('tts.db-wal');
    expect(runbook).toContain('PRAGMA integrity_check');
    expect(runbook).toContain('pre-cutover verified backup');
  });
});
