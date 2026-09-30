import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const deployScript = resolve('scripts/deploy-rust-vps.sh').replaceAll('\\', '/');
function posix(value) {
  const normalized = value.replaceAll('\\', '/');
  return process.platform === 'win32'
    ? normalized.replace(/^([A-Za-z]):/, (_match, drive) => `/${drive.toLowerCase()}`)
    : normalized;
}
// Execute the production script, replacing only its external services. No Docker,
// network, production database, or credentials are used by these fixtures.
function runDeploy(scenario, prebuilt = false) {
  const root = mkdtempSync(resolve(tmpdir(), 'vozen-deploy-test-'));
  try {
    mkdirSync(resolve(root, 'rust-data'));
    writeFileSync(resolve(root, '.env.rust.prod'), 'TEST_ONLY=true\n');
    writeFileSync(resolve(root, 'rust-data/tts.db'), 'fixture');
    const result = spawnSync(
      bash,
      [
        '-c',
        `
      git() { printf '%040d\\n' 1; }
      systemctl() { return 1; }
      ${process.platform === 'win32' ? 'install() { mkdir -p "${@: -1}"; }; chmod() { :; }' : ''}
      sleep() { :; }
      seq() { printf '1\\n'; }
      curl() { return 0; }
      python3() {
        if [[ "$1" == '-' ]]; then
          cat >/dev/null
          [[ "$SCENARIO" != 'database-failure' ]]
        else
          [[ "$SCENARIO" != 'backup-failure' ]]
        fi
      }
      docker() {
        printf '%s\\n' "$*" >> "$VOZEN_CALLS"
        case "$*" in
          'image inspect --format {{.Id}} '*) printf 'sha256:previous-prod\\n' ;;
          'image inspect --format '* ) printf '%040d\\n' 1 ;;
          'container inspect --format {{.Image}} '*) printf 'sha256:previous\\n' ;;
          'container inspect --format '* ) printf 'healthy\\n' ;;
          'logs '*)
            if [[ "$SCENARIO" == 'health-failure' ]]; then
              printf 'not ready\\n'
            else
              printf 'healthy: Ready\\n'
              if [[ "$SCENARIO" == 'large-logs' ]]; then
                for ((i=0; i<5000; i++)); do printf '%0200d\\n' "$i" || return; done
              fi
            fi ;;
          *' build '*) [[ "$SCENARIO" != 'build-failure' ]] ;;
          *' up -d --force-recreate '* )
            if [[ ! -f "$VOZEN_START_SEEN" ]]; then
              touch "$VOZEN_START_SEEN"
              [[ "$SCENARIO" != 'start-failure' ]]
            fi ;;
          *) return 0 ;;
        esac
      }
      source "$VOZEN_DEPLOY_SCRIPT"
    `,
      ],
      {
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          SCENARIO: scenario,
          VOZEN_PREBUILT_IMAGE: prebuilt ? 'vozen-rust:candidate' : '',
          VOZEN_DEPLOY_STATE_DIR: posix(resolve(root, 'state')),
          VOZEN_START_SEEN: posix(resolve(root, 'started')),
          VOZEN_DEPLOY_SCRIPT: deployScript,
          VOZEN_DEPLOY_DIR: posix(root),
          VOZEN_CALLS: posix(resolve(root, 'calls')),
        },
      },
    );
    if (result.error) throw result.error;
    const callsPath = resolve(root, 'calls');
    return { ...result, calls: existsSync(callsPath) ? readFileSync(callsPath, 'utf8') : '' };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('production deploy rollback behavior', () => {
  it.each(['start-failure', 'database-failure', 'health-failure'])(
    'restores the previous container after %s',
    (scenario) => {
      const result = runDeploy(scenario);
      expect(result.status, result.stderr).not.toBe(0);
      expect(result.calls).toContain('image tag vozen-rust:rollback vozen-rust:prod');
      expect(result.calls).toContain('up -d --force-recreate --no-build vozen');
      expect(result.calls).not.toContain('image rm vozen-rust:rollback');
    },
  );
  it.each(['build-failure', 'backup-failure'])(
    'keeps the running container online after %s',
    (scenario) => {
      const result = runDeploy(scenario);
      expect(result.status, result.stderr).not.toBe(0);
      expect(result.calls).toContain('image tag vozen-rust:rollback vozen-rust:prod');
      expect(result.calls).not.toContain(' up ');
      expect(result.calls).not.toContain(' stop ');
    },
  );
  it.each(['success', 'large-logs'])('finishes a healthy deployment with %s', (scenario) => {
    const result = runDeploy(scenario);
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).not.toContain('image rm vozen-rust:rollback');
    expect(result.calls).not.toContain('up -d --force-recreate --no-build vozen');
  });
});

describe('CI image rollback behavior', () => {
  it.each(['start-failure', 'database-failure', 'health-failure', 'backup-failure'])(
    'restores the previous image after %s with a prebuilt candidate',
    (scenario) => {
      const result = runDeploy(scenario, true);
      expect(result.status, result.stderr).not.toBe(0);
      expect(result.calls).toContain(
        scenario === 'backup-failure'
          ? 'image tag sha256:previous-prod vozen-rust:prod'
          : 'image tag vozen-rust:rollback vozen-rust:prod',
      );
      expect(result.calls).toContain('image rm vozen-rust:candidate');
      expect(result.calls).not.toContain('image rm vozen-rust:rollback');
      if (scenario === 'backup-failure') expect(result.calls).not.toContain(' up ');
      else expect(result.calls).toContain('up -d --force-recreate --no-build vozen');
    },
  );
  it('deploys the verified CI image and retains rollback', () => {
    const result = runDeploy('success', true);
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toContain('image tag vozen-rust:candidate vozen-rust:prod');
    expect(result.calls).not.toContain('image rm vozen-rust:rollback');
  });
});
