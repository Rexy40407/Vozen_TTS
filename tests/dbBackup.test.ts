import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('production SQLite backup', () => {
  it('runs before checks and the production service restart', () => {
    const workflow = readFileSync('.github/workflows/deploy-bot.yml', 'utf8');
    const backupAt = workflow.indexOf('npm run backup:db');
    const checksAt = workflow.indexOf('npm run check');
    const secretsAt = workflow.indexOf('node scripts/sync-deploy-env.mjs');
    const restartAt = workflow.indexOf('sudo -n systemctl restart vozen.service');

    expect(backupAt).toBeGreaterThan(-1);
    expect(checksAt).toBeGreaterThan(backupAt);
    expect(secretsAt).toBeGreaterThan(checksAt);
    expect(restartAt).toBeGreaterThan(secretsAt);
  });

  it('creates a consistent restorable copy outside the live database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vozen-backup-'));
    const dbPath = join(dir, 'live.db');
    const backupDir = join(dir, 'backups');
    try {
      const live = new Database(dbPath);
      live.exec('CREATE TABLE marker (value TEXT NOT NULL)');
      live.prepare('INSERT INTO marker (value) VALUES (?)').run('persists-across-deploy');
      live.close();

      execFileSync(process.execPath, ['scripts/backup-db.mjs'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DB_PATH: dbPath,
          DB_BACKUP_DIR: backupDir,
          DB_BACKUP_RETENTION_DAYS: '30',
        },
        stdio: 'pipe',
      });

      const backups = readdirSync(backupDir).filter((name) => name.endsWith('.db'));
      expect(backups).toHaveLength(1);
      const restored = new Database(join(backupDir, backups[0]), { readonly: true });
      try {
        expect(restored.prepare('SELECT value FROM marker').get()).toEqual({
          value: 'persists-across-deploy',
        });
      } finally {
        restored.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
