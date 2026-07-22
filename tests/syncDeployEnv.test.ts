import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deployment secret synchronization', () => {
  it('atomically replaces duplicate allow-listed keys without exposing secret values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vozen-deploy-env-'));
    const envPath = join(dir, '.env');
    const topggSecret = 'whs_test_topgg_secret_1234567890';
    const redemptionSecret = 'redemption-secret-with-at-least-32-characters';
    try {
      writeFileSync(
        envPath,
        [
          'DISCORD_TOKEN=keep-me',
          'TOPGG_WEBHOOK_SECRET=stale',
          'export VOTE_REDEMPTION_SECRET=stale-too',
          'TOPGG_WEBHOOK_SECRET=',
          '',
        ].join('\n'),
      );

      const output = execFileSync(process.execPath, ['scripts/sync-deploy-env.mjs'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          VOZEN_ENV_PATH: envPath,
          TOPGG_WEBHOOK_SECRET: topggSecret,
          VOTE_REDEMPTION_SECRET: redemptionSecret,
        },
        encoding: 'utf8',
      });
      const updated = readFileSync(envPath, 'utf8');

      expect(updated).toContain('DISCORD_TOKEN=keep-me');
      expect(updated.match(/^TOPGG_WEBHOOK_SECRET=/gm)).toHaveLength(1);
      expect(updated.match(/^VOTE_REDEMPTION_SECRET=/gm)).toHaveLength(1);
      expect(updated).toContain(`TOPGG_WEBHOOK_SECRET=${topggSecret}`);
      expect(updated).toContain(`VOTE_REDEMPTION_SECRET=${redemptionSecret}`);
      expect(output).not.toContain(topggSecret);
      expect(output).not.toContain(redemptionSecret);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed before editing when a required secret is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vozen-deploy-env-invalid-'));
    const envPath = join(dir, '.env');
    try {
      writeFileSync(envPath, 'DISCORD_TOKEN=unchanged\n');

      expect(() =>
        execFileSync(process.execPath, ['scripts/sync-deploy-env.mjs'], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            VOZEN_ENV_PATH: envPath,
            TOPGG_WEBHOOK_SECRET: 'invalid',
            VOTE_REDEMPTION_SECRET: 'short',
          },
          stdio: 'pipe',
        }),
      ).toThrow();
      expect(readFileSync(envPath, 'utf8')).toBe('DISCORD_TOKEN=unchanged\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
