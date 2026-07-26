import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const rustSource = readFileSync(resolve(root, 'crates/vozen-runtime/src/runtime_mode.rs'), 'utf8');
const nodeSource = readFileSync(resolve(root, 'src/migration/rustVoiceAuthority.ts'), 'utf8');
const stagingTemplate = readFileSync(resolve(root, '.env.rust.staging.example'), 'utf8');

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`could not find ${label}`);
  return match[1];
}

function quotedFlags(source, quote) {
  return [...source.matchAll(new RegExp(`${quote}(RUST_[A-Z0-9_]+)${quote}`, 'g'))].map(
    (match) => match[1],
  );
}

function assertUnique(flags, label) {
  const duplicates = flags.filter((flag, index) => flags.indexOf(flag) !== index);
  if (duplicates.length > 0)
    throw new Error(`${label} contains duplicates: ${duplicates.join(', ')}`);
}

function assertSame(left, right, label) {
  const rightSet = new Set(right);
  const leftSet = new Set(left);
  const missing = left.filter((flag) => !rightSet.has(flag));
  const extra = right.filter((flag) => !leftSet.has(flag));
  if (missing.length || extra.length) {
    throw new Error(
      `${label} differs (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
    );
  }
}

function assertContains(expected, actual, label) {
  const actualSet = new Set(actual);
  const missing = expected.filter((flag) => !actualSet.has(flag));
  if (missing.length) throw new Error(`${label} is missing: ${missing.join(', ')}`);
}

const rustFlags = quotedFlags(
  requiredMatch(
    rustSource,
    /pub const FULL_RUNTIME_FLAGS: &\[&str\] = &\[\s*([\s\S]*?)\];/,
    'Rust full canary list',
  ),
  '"',
);
const nodeFlags = quotedFlags(
  requiredMatch(
    nodeSource,
    /export const FULL_RUST_RUNTIME_FLAGS = \[\s*([\s\S]*?)\] as const;/,
    'TypeScript full canary list',
  ),
  "'",
);
const templateFlags = [...stagingTemplate.matchAll(/^\s*(RUST_[A-Z0-9_]+)=/gm)].map(
  (match) => match[1],
);

assertUnique(rustFlags, 'Rust full canary list');
assertUnique(nodeFlags, 'TypeScript full canary list');
assertUnique(templateFlags, 'staging template canary list');
assertSame(rustFlags, nodeFlags, 'Rust and TypeScript canary lists');
assertContains(rustFlags, templateFlags, 'Rust and staging template canary lists');

const functionalFlags = rustFlags.filter((flag) => flag !== 'RUST_RUNTIME_READY');
if (functionalFlags.length !== 52) {
  throw new Error(`expected 52 functional cutover canaries, found ${functionalFlags.length}`);
}

console.log(
  `[check-rust-canaries] ${functionalFlags.length} functional canaries + RUST_RUNTIME_READY match Rust, TypeScript and staging template`,
);
