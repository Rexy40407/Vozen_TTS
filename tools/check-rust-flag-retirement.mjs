import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const matrix = readFileSync(resolve(root, 'docs/RUST-FLAG-RETIREMENT.md'), 'utf8');
const runtime = readFileSync(resolve(root, 'crates/vozen-runtime/src/runtime_mode.rs'), 'utf8');
const staging = readFileSync(resolve(root, '.env.rust.staging.example'), 'utf8');
const production = readFileSync(resolve(root, '.env.rust.prod.example'), 'utf8');
const auxiliaryFlags = [
  'RUST_RUNTIME_MODE',
  'RUST_COMMANDS_GUILD_ID',
  'RUST_COMMANDS_STATE_PATH',
  'RUST_PAYMENTS_ENABLED',
  'RUST_POSTGRES_MODE',
  'RUST_POSTGRES_POOL_MAX',
  'RUST_POSTGRES_IMPORT_SQLITE',
  'RUST_POSTGRES_REPLICA_OUTBOX',
  'RUST_POSTGRES_VOICE_READ_CACHE',
  'RUST_VOICE_CACHE_DIR',
  'RUST_TTS_FILE_CACHE_DIR',
  'RUST_GTTS_CACHE_DIR',
  'RUST_NEURAL_CACHE_DIR',
  'RUST_GCLOUD_CACHE_DIR',
  'RUST_KOKORO_CACHE_DIR',
  'RUST_ENV_FILE',
  'RUST_BACKTRACE',
];

const fullList = runtime.match(/pub const FULL_RUNTIME_FLAGS: &\[&str\] = &\[([\s\S]*?)\];/);
if (!fullList) throw new Error('could not find FULL_RUNTIME_FLAGS');
const sourceFlags = [...fullList[1].matchAll(/"(RUST_[A-Z0-9_]+)"/g)].map((match) => match[1]);
const matrixFlags = [...matrix.matchAll(/^\| (RUST_[A-Z0-9_]+) \|/gm)].map((match) => match[1]);
const stagingFlags = [...staging.matchAll(/^\s*(RUST_[A-Z0-9_]+)=/gm)].map((match) => match[1]);
const productionFlags = [...production.matchAll(/^\s*(RUST_[A-Z0-9_]+)=/gm)].map((match) => match[1]);

function unique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) throw new Error(`${label} has duplicates: ${duplicates.join(', ')}`);
}

function diff(expected, actual) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((value) => !actualSet.has(value)),
    extra: actual.filter((value) => !expectedSet.has(value)),
  };
}

unique(sourceFlags, 'FULL_RUNTIME_FLAGS');
unique(matrixFlags, 'retirement matrix');
const inventoryDiff = diff(sourceFlags, matrixFlags);
if (inventoryDiff.missing.length || inventoryDiff.extra.length) {
  throw new Error(
    `retirement matrix diff: missing=${inventoryDiff.missing.join(',') || 'none'} extra=${inventoryDiff.extra.join(',') || 'none'}`,
  );
}

for (const flag of sourceFlags) {
  if (!stagingFlags.includes(flag)) throw new Error(`staging template is missing ${flag}`);
  if (!productionFlags.includes(flag)) throw new Error(`production template is missing ${flag}`);
}

const auxiliaryRows = auxiliaryFlags.filter((flag) => !matrix.includes(`\`${flag}\``));
if (auxiliaryRows.length > 0) {
  throw new Error(`auxiliary flags missing from retirement document: ${auxiliaryRows.join(', ')}`);
}

console.log(
  `[check-rust-flag-retirement] ${sourceFlags.length} canaries match the ownership matrix and staging/production templates; generated inventory diff is empty`,
);
