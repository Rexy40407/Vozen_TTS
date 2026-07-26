import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('production SQLite backup', () => {
  it('waits for green CI and backs up before the Rust container cutover', () => {
    const workflow = readFileSync('.github/workflows/deploy-bot.yml', 'utf8');
    const deploy = readFileSync('scripts/deploy-rust-vps.sh', 'utf8');
    const buildAt = deploy.indexOf('build "$SERVICE"');
    const backupAt = deploy.indexOf('python3 scripts/backup-rust-db.py');
    const recreateAt = deploy.indexOf('up -d --force-recreate "$SERVICE"');
    const readyAt = deploy.indexOf('healthy: Ready');

    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain('bash scripts/deploy-rust-vps.sh');
    expect(workflow).not.toContain('systemctl restart vozen.service');
    expect(buildAt).toBeGreaterThan(-1);
    expect(backupAt).toBeGreaterThan(-1);
    expect(backupAt).toBeGreaterThan(buildAt);
    expect(recreateAt).toBeGreaterThan(backupAt);
    expect(readyAt).toBeGreaterThan(recreateAt);
    expect(deploy).toContain('Rolling back to the previous Rust image.');
    expect(deploy).toContain('PRAGMA integrity_check');
    expect(deploy).toContain('PRAGMA foreign_key_check');
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
