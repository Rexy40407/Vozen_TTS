import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const contract = JSON.parse(readFileSync(resolve(root, 'contracts/postgres-replica.json'), 'utf8'));
if (contract.schema_version !== 1 || !Array.isArray(contract.tables)) {
  throw new Error('invalid Postgres replica contract');
}

function rustTables(path, constant) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const match = source.match(new RegExp(`const ${constant}[^=]*=\\s*&\\[(.*?)\\];`, 's'));
  if (!match) throw new Error(`${constant} not found in ${path}`);
  return [...match[1].matchAll(/"([a-z0-9_]+)"/g)].map(([, value]) => value);
}

const expected = [...contract.tables].sort();
const sources = [
  [
    'runtime outbox',
    rustTables('crates/vozen-store/src/runtime_outbox.rs', 'POSTGRES_REPLICA_TABLES'),
  ],
  [
    'voice cache',
    rustTables('crates/vozen-runtime/src/postgres_voice_cache.rs', 'VOICE_CACHE_TABLES'),
  ],
];
const sql = readFileSync(
  resolve(root, 'supabase/migrations/20260729170000_vozen_replica_apply_function.sql'),
  'utf8',
);
const sqlTables = [...sql.matchAll(/'([a-z0-9_]+)'/g)]
  .map(([, value]) => value)
  .filter((value) => expected.includes(value));
sources.push(['SQL apply function', sqlTables]);
for (const [name, values] of sources) {
  const actual = [...new Set(values)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name} does not match contracts/postgres-replica.json`);
  }
}
console.log(`Postgres replica contract OK (${expected.length} tables)`);
