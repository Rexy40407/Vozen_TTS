import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSqliteSchemaContract } from '../src/contracts/sqliteSchemaContract';

describe('Rust migration SQLite contract', () => {
  it('keeps the versioned schema fixture equivalent to the current Node migrator', () => {
    const fixture = readFileSync(path.resolve('contracts/sqlite-schema.json'), 'utf8');
    expect(JSON.parse(fixture)).toEqual(JSON.parse(buildSqliteSchemaContract()));
  });
});
