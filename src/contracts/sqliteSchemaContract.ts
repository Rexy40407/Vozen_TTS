import { initDb } from '../store/db';

export const SQLITE_SCHEMA_CONTRACT_VERSION = 1;
export const SQLITE_SCHEMA_CONTRACT_SOURCE = 'src/store/db.ts';

export type SqliteSchemaObject = {
  type: 'index' | 'table';
  name: string;
  sql: string;
};

/**
 * Captures the database layout produced by the live Node migrator. The Rust rewrite consumes
 * this mechanical contract before it owns migrations, so a schema change cannot silently omit
 * an existing user setting, entitlement, or privacy record.
 */
export function buildSqliteSchemaContract(): string {
  const db = initDb(':memory:');
  try {
    const objects = db
      .prepare(
        `SELECT type, name, sql
         FROM sqlite_master
         WHERE type IN ('table', 'index')
           AND name NOT LIKE 'sqlite_%'
           AND sql IS NOT NULL
         ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
      )
      .all() as SqliteSchemaObject[];

    return `${JSON.stringify(
      {
        schema_version: SQLITE_SCHEMA_CONTRACT_VERSION,
        generated_from: SQLITE_SCHEMA_CONTRACT_SOURCE,
        objects,
      },
      null,
      2,
    )}\n`;
  } finally {
    db.close();
  }
}
