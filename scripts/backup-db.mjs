import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath = path.resolve(process.env.DB_PATH?.trim() || './tts.db');
const backupDir = path.resolve(
  process.env.DB_BACKUP_DIR?.trim() || path.join(process.cwd(), '..', 'vozen-backups'),
);
const retentionDays = Number(process.env.DB_BACKUP_RETENTION_DAYS || 30);

if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  throw new Error('DB_BACKUP_RETENTION_DAYS must be a positive integer');
}
if (!fs.statSync(dbPath, { throwIfNoEntry: false })?.isFile()) {
  throw new Error(`SQLite database not found: ${dbPath}`);
}
if (dbPath === backupDir || backupDir.startsWith(`${dbPath}${path.sep}`)) {
  throw new Error('DB_BACKUP_DIR cannot be the database file or a child of it');
}

fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const safeBase = path.basename(dbPath, path.extname(dbPath)).replaceAll(/[^a-zA-Z0-9_-]/g, '_');
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const destination = path.join(backupDir, `${safeBase}-${stamp}.db`);

const source = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  await source.backup(destination);
} finally {
  source.close();
}

const cutoff = Date.now() - retentionDays * 86_400_000;
let removed = 0;
for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.startsWith(`${safeBase}-`) || !entry.name.endsWith('.db')) {
    continue;
  }
  const candidate = path.join(backupDir, entry.name);
  if (candidate === destination) continue;
  if (fs.statSync(candidate).mtimeMs < cutoff) {
    fs.rmSync(candidate);
    removed += 1;
  }
}

process.stdout.write(`SQLite backup created: ${destination}\n`);
if (removed > 0) process.stdout.write(`Expired backups removed: ${removed}\n`);
