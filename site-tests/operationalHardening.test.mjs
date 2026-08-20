import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const source = (path) => readFileSync(resolve(process.cwd(), path), { encoding: 'utf8' });
// The site's assets are cache-busted by FILENAME (never a query string), so every rename churns
// these tests too. One constant each: the rename is then a one-line edit here, not a hunt.
const SITE_JS = 'site/js/main-v51.js';
const SITE_I18N = 'site/js/i18n-v41.js';
const SITE_CSS = 'site/css/main-v43.css';
const ACCOUNT_CSS = 'site/css/account-v6.css';
const BILLING_CSS = 'site/css/billing-v3.css';
/** Body of a top-level function in the site bundle, comments stripped. Comments are dropped
 *  because these assertions are about the markup a function RENDERS — a comment explaining why
 *  some wiring is avoided must not read as using it. */
const fnSource = (script, signature) => {
  const start = script.indexOf(signature);
  if (start < 0) throw new Error(`not found in site bundle: ${signature}`);
  const rest = script.slice(start + 1);
  const end = rest.indexOf('\n  function ');
  return (end < 0 ? rest : rest.slice(0, end)).replace(/^\s*\/\/.*$/gm, '');
};
const claimCardSource = () => fnSource(source(SITE_JS), 'function claimCard()');
const helpModalSource = () => fnSource(source(SITE_JS), 'function claimHelpModal()');
const i18nBundle = () => {
  const sandbox = {
    window: {},
  };
  new Function('window', source(SITE_I18N))(sandbox.window);
  return sandbox.window.VOZEN_I18N ?? {};
};
describe('operational security configuration', () => {
  it('gates pull requests and GitHub Pages with the same site verification command', () => {
    const pkg = JSON.parse(source('package.json'));
    const ci = source('.github/workflows/ci.yml');
    const pages = source('.github/workflows/pages.yml');
    expect(pkg.scripts?.['check:site']).toBe(
      'vitest run site-tests/operationalHardening.test.mjs site-tests/siteTrust.test.mjs site-tests/siteI18n.test.mjs site-tests/dashboardCoreSettings.test.mjs site-tests/siteUxPolish.test.mjs site-tests/fullAuditRegression.test.mjs && npm run check:i18n && npm run check:site-copy && npm run build:site',
    );
    expect(ci).toMatch(/\n {2}site:\s*\n/);
    expect(ci).toMatch(/\n\s+- run: npm run check:site\s*\n/);
    expect(pages).toMatch(/\n\s+run: npm run check:site\s*\n/);
    expect(pages).not.toMatch(/\n\s+run: npm run build:site\s*\n/);
  });
  it('diagnoses VPS deployment inputs before opening the SSH action', () => {
    const deploy = source('.github/workflows/deploy-bot.yml');
    expect(deploy).toContain('name: Validate VPS deploy inputs');
    expect(deploy).toContain('Missing VPS_HOST');
    expect(deploy).toContain('Missing VPS_USER');
    expect(deploy).toContain('Missing VPS_SSH_KEY');
    expect(deploy).toContain('debug: true');
    expect(deploy).toContain('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c');
    expect(deploy).toContain('appleboy/scp-action@ff85246acaad7bdce478db94a363cd2bf7c90345');
    expect(deploy).toContain('.conclusion == "success"');
    expect(deploy).toContain('.event == "push"');
    expect(deploy).toContain('.head_repository.id == $repository_id');
    expect(deploy).toContain('.head_sha == $sha');
    expect(deploy).toContain('sha256sum --check "vozen-rust-$DEPLOY_SHA.tar.gz.sha256"');
    expect(deploy).toContain('artifact_bytes <= 2 * 1024 * 1024 * 1024');
    expect(deploy).toContain('unpacked_bytes <= 8 * 1024 * 1024 * 1024');
    expect(deploy).toContain('docker_root="$(docker info');
    expect(deploy).toContain('docker buildx prune --all --force');
    expect(deploy).toContain('container="vozen-prod-vozen-1"');
    expect(deploy).toContain('docker image tag "$live_image" vozen-rust:rollback');
    expect(deploy).toContain('docker image rm vozen-rust:prod || true');
    expect(deploy).toContain('docker system prune --force');
    expect(deploy).toContain('neither --all nor --volumes');
    expect(deploy).not.toContain('docker system prune --all');
    expect(deploy).not.toContain('docker system prune --volumes');
    expect(deploy).toContain('combined_required="$((ARTIFACT_BYTES + docker_required))"');
    expect(deploy).toContain('Reject dirty and stale production state before pruning');
    expect(deploy).toContain('capture_stdout: true');
    expect(deploy).toContain("steps.release_decision.outputs.decision == 'deploy'");
    expect(deploy).toContain('candidate_cleanup_armed=true');
    expect(deploy).toContain('docker image rm "$candidate_image"');
    expect(deploy).toContain('python3 scripts/validate-docker-image-archive.py');
    expect(deploy).toContain("if: always() && env.DIAGNOSTICS_ONLY != 'true'");
  });
  it('normalizes one preflight marker from bannered ssh-action stdout', () => {
    const bash =
      process.env.VOZEN_TEST_BASH ??
      (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
    const workflow = source('.github/workflows/deploy-bot.yml');
    const stepStart = workflow.indexOf('- name: Normalize production preflight decision');
    const stepEnd = workflow.indexOf('\n      - name:', stepStart + 1);
    const step = workflow.slice(stepStart, stepEnd);
    const marker = step.match(/^([ \t]*)run: \|\r?$/m);
    expect(marker).not.toBeNull();
    const indent = marker[1].length + 2;
    const script = step
      .slice(marker.index + marker[0].length)
      .replace(/^\r?\n/, '')
      .split(/\r?\n/)
      .map((line) => (line.startsWith(' '.repeat(indent)) ? line.slice(indent) : line))
      .join('\n');
    const runNormalizer = (captured) => {
      const root = mkdtempSync(join(tmpdir(), 'vozen-preflight-normalizer-'));
      try {
        const output = join(root, 'github-output');
        const result = spawnSync(bash, ['-c', script], {
          encoding: 'utf8',
          env: { ...process.env, GITHUB_OUTPUT: output, PREFLIGHT_STDOUT: captured },
        });
        return {
          decision: existsSync(output) ? readFileSync(output, 'utf8').trim() : '',
          result,
        };
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    };

    const bannered = runNormalizer(
      "======CMD======\nprintf 'VOZEN_PREFLIGHT=stale\\n'\nprintf 'VOZEN_PREFLIGHT=deploy\\n'\n======END======\nVOZEN_PREFLIGHT=deploy\n================================\n✅ Successfully executed commands",
    );
    expect(bannered.result.status, bannered.result.stderr).toBe(0);
    expect(bannered.decision).toBe('decision=deploy');
    expect(runNormalizer('out: VOZEN_PREFLIGHT=stale').decision).toBe('decision=stale');
    expect(
      runNormalizer('out: VOZEN_PREFLIGHT=deploy\nout: VOZEN_PREFLIGHT=stale').result.status,
    ).toBe(1);
    expect(runNormalizer('Successfully executed commands').result.status).toBe(1);
  });
  it('keeps every canonical deploy branch fail-closed and CI-pinned', () => {
    const bash =
      process.env.VOZEN_TEST_BASH ??
      (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
    if (process.platform === 'win32' && !existsSync(bash)) {
      throw new Error('Set VOZEN_TEST_BASH to a Git Bash-compatible executable.');
    }
    const workflow = source('.github/workflows/deploy-bot.yml');
    const deployStep = workflow.slice(
      workflow.indexOf('# This action receives the production SSH key'),
    );
    const marker = deployStep.match(/^([ \t]*)script: \|\r?$/m);
    expect(marker).not.toBeNull();
    const remoteIndent = marker[1].length + 2;
    const scriptBlock = deployStep
      .slice(marker.index + marker[0].length)
      .replace(/^\r?\n/, '')
      .split(/\r?\n/)
      .map((line) => (line.startsWith(' '.repeat(remoteIndent)) ? line.slice(remoteIndent) : line))
      .join('\n');
    const nextStep = scriptBlock.search(/^ {6}- name:/m);
    const remoteScript = scriptBlock
      .slice(0, nextStep === -1 ? undefined : nextStep)
      .replace('cd ~/vozen-rust-prod', 'cd "$VOZEN_TEST_DEPLOY_DIR"');
    const targetSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const currentByMode = {
      diagnostics: targetSha,
      dirty: targetSha,
      forward: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      runtime: targetSha,
      same: targetSha,
      stale: 'cccccccccccccccccccccccccccccccccccccccc',
      status_error: targetSha,
      unrelated: 'dddddddddddddddddddddddddddddddddddddddd',
    };
    const runFixture = (mode) => {
      const root = mkdtempSync(join(tmpdir(), 'vozen-main-deploy-'));
      try {
        const deployDir = join(root, 'deploy');
        const artifactRoot = join(root, 'artifacts');
        const artifactDir = join(artifactRoot, targetSha);
        const bashEnv = join(root, 'bash-env.sh');
        const gitLog = join(root, 'git.log');
        const mutationLog = join(root, 'mutation.log');
        mkdirSync(deployDir);
        mkdirSync(artifactDir, { recursive: true });
        writeFileSync(join(artifactDir, `vozen-rust-${targetSha}.tar.gz`), 'fixture');
        writeFileSync(join(artifactDir, `vozen-rust-${targetSha}.tar.gz.sha256`), 'fixture');
        writeFileSync(
          join(deployDir, '.env.rust.prod'),
          'STRIPE_SECRET_KEY=test\nSTRIPE_PUBLISHABLE_KEY=test\nSTRIPE_WEBHOOK_SECRET=test\n',
        );
        writeFileSync(
          bashEnv,
          String.raw`git() {
printf '%s\n' "$*" >> "$FAKE_GIT_LOG"
if [ "$1" = "fetch" ] || [ "$1" = "cat-file" ]; then return 0; fi
if [ "$1" = "rev-parse" ]; then echo "$FAKE_CURRENT_SHA"; return 0; fi
if [ "$1" = "status" ]; then
  [[ "$*" == *":(exclude).env.rust.prod"* ]] || return 65
  [[ "$*" == *":(exclude).env.rust.prod.backup-*"* ]] || return 65
  [[ "$*" == *":(exclude)rust-data/**"* ]] || return 65
  [ "$FAKE_MODE" = "status_error" ] && return 2
  [ "$FAKE_MODE" = "dirty" ] && echo "?? crates/rogue.rs"
  return 0
fi
if [ "$1" = "merge-base" ]; then
  [ "$4" = "origin/migration/vozen-rust" ] && return 0
  [ "$FAKE_MODE" = "stale" ] && [ "$3" = "$FAKE_TARGET_SHA" ] && return 0
  [ "$FAKE_MODE" = "forward" ] && [ "$3" = "$FAKE_CURRENT_SHA" ] && return 0
  return 1
fi
if [ "$1" = "merge" ] || [ "$1" = "checkout" ]; then return 0; fi
return 64
}
docker() { printf 'docker %s\n' "$*" >> "$FAKE_MUTATION_LOG"; }
bash() { printf 'deploy %s\n' "$*" >> "$FAKE_MUTATION_LOG"; }
chmod() { return 0; }
gzip() { return 0; }
python3() { return 0; }
sha256sum() { return 0; }
export -f git docker bash chmod gzip python3 sha256sum`,
        );
        const posix = (value) => {
          const normalized = value.replaceAll('\\', '/');
          return process.platform === 'win32'
            ? normalized.replace(/^([A-Za-z]):/, (_match, drive) => `/${drive.toLowerCase()}`)
            : normalized;
        };
        const result = spawnSync(bash, ['-c', remoteScript], {
          encoding: 'utf8',
          timeout: 3_000,
          env: {
            ...process.env,
            BASH_ENV: posix(bashEnv),
            DEPLOY_SHA: targetSha,
            DIAGNOSTICS_ONLY: mode === 'diagnostics' ? 'true' : 'false',
            FAKE_CURRENT_SHA: currentByMode[mode],
            FAKE_GIT_LOG: posix(gitLog),
            FAKE_MODE: mode,
            FAKE_MUTATION_LOG: posix(mutationLog),
            FAKE_TARGET_SHA: targetSha,
            VOZEN_TEST_DEPLOY_DIR: posix(deployDir),
            VOZEN_ARTIFACT_ROOT: posix(artifactRoot),
          },
        });
        return {
          envFile: readFileSync(join(deployDir, '.env.rust.prod'), 'utf8'),
          gitCalls: existsSync(gitLog) ? readFileSync(gitLog, 'utf8') : '',
          mutations: existsSync(mutationLog) ? readFileSync(mutationLog, 'utf8') : '',
          result,
          stagedArtifactPresent: existsSync(join(artifactDir, `vozen-rust-${targetSha}.tar.gz`)),
        };
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    };

    const diagnostics = runFixture('diagnostics');
    expect(diagnostics.result.status).toBe(0);
    expect(diagnostics.mutations).toContain('docker system df --verbose');
    expect(diagnostics.mutations).toContain('docker ps --all --size');
    expect(diagnostics.mutations).not.toContain('docker builder prune');
    expect(diagnostics.mutations).not.toContain('deploy scripts/deploy-rust-vps.sh');
    expect(diagnostics.gitCalls).toBe('');

    const statusError = runFixture('status_error');
    expect(
      statusError.result.status,
      `${statusError.result.stdout}\n${statusError.result.stderr}`,
    ).toBe(1);
    expect(statusError.result.stdout).toContain('Unable to verify production checkout cleanliness');
    expect(statusError.mutations).toBe('');
    expect(statusError.stagedArtifactPresent).toBe(false);

    const dirty = runFixture('dirty');
    expect(dirty.result.status).toBe(1);
    expect(dirty.result.stdout).toContain('Production checkout has local changes');
    expect(dirty.mutations).toBe('');
    expect(dirty.stagedArtifactPresent).toBe(false);

    const stale = runFixture('stale');
    expect(stale.result.status).toBe(0);
    expect(stale.result.stdout).toContain('refusing rollback');
    expect(stale.mutations).toBe('');
    expect(stale.stagedArtifactPresent).toBe(false);
    expect(stale.envFile).not.toContain('RUST_PAYMENTS_ENABLED');

    const same = runFixture('same');
    expect(same.result.status).toBe(0);
    expect(same.mutations).toContain('docker builder prune --all --force');
    expect(same.mutations).toContain('deploy scripts/deploy-rust-vps.sh');
    expect(same.gitCalls).toContain(':(exclude).env.rust.prod');
    expect(same.gitCalls).toContain(':(exclude).env.rust.prod.backup-*');
    expect(same.gitCalls).toContain(':(exclude)rust-data/**');

    const runtime = runFixture('runtime');
    expect(runtime.result.status).toBe(0);
    expect(runtime.mutations).toContain('deploy scripts/deploy-rust-vps.sh');

    const forward = runFixture('forward');
    expect(forward.result.status).toBe(0);
    expect(forward.gitCalls).toContain(`merge --ff-only ${targetSha}`);
    expect(forward.mutations).toContain('deploy scripts/deploy-rust-vps.sh');

    const unrelated = runFixture('unrelated');
    expect(unrelated.result.status).toBe(0);
    expect(unrelated.gitCalls).toContain(`checkout --detach ${targetSha}`);
    expect(unrelated.mutations).toContain('deploy scripts/deploy-rust-vps.sh');
  }, 30_000);
  it('keeps payment credentials in the VPS runtime file instead of the SSH command line', () => {
    const deploy = source('.github/workflows/deploy-bot.yml');
    expect(deploy).toContain('require_runtime_secret STRIPE_SECRET_KEY');
    expect(deploy).toContain('require_runtime_secret STRIPE_PUBLISHABLE_KEY');
    expect(deploy).toContain('require_runtime_secret STRIPE_WEBHOOK_SECRET');
    expect(deploy).toContain('the remote command line is observable to local processes');
    expect(deploy).not.toContain('STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}');
    expect(deploy).not.toContain('STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}');
    expect(deploy).not.toContain('STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}');
    expect(deploy).not.toMatch(/^\s*envs:\s*.*STRIPE_/m);
  });
  it('keeps the Night Signal treatment scoped to Discord entry points', () => {
    const css = source(SITE_CSS);
    const index = source('site/index.html');
    const account = source('site/account.html');
    const dashboard = source('site/dashboard.html');
    for (const pagePath of [
      'site/index.html',
      'site/account.html',
      'site/dashboard.html',
      'site/privacy.html',
      'site/terms.html',
    ]) {
      const page = source(pagePath);
      expect(page, pagePath).toContain('css/main-v43.css');
      expect(page, pagePath).not.toContain('css/main-v41.css');
    }
    expect(existsSync(resolve(process.cwd(), 'site/css/main-v41.css'))).toBe(false);
    for (const [pagePath, page] of [
      ['site/index.html', index],
      ['site/account.html', account],
      ['site/dashboard.html', dashboard],
    ]) {
      const navLoginClasses = page.match(
        /<button class="([^"]+)" id="navLogin" type="button">/,
      )?.[1];
      expect(navLoginClasses, pagePath).toContain('btn--discord-cta');
    }
    const inviteClasses = [...index.matchAll(/<a class="([^"]*\bjs-invite\b[^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(inviteClasses).toHaveLength(3);
    for (const classes of inviteClasses) expect(classes).toContain('btn--discord-cta');
    expect(css).toMatch(
      /\.btn--discord-cta\s*\{[^}]*color:\s*#fff;[^}]*linear-gradient\(115deg,\s*#4f46e5 0%,\s*#365bc9 52%,\s*#0f766e 100%\)/s,
    );
    expect(css).toContain('.btn--discord-cta:hover');
    expect(css).toContain('.btn--discord-cta:active');
    expect(css).toContain('.btn--discord-cta:focus-visible');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.btn--discord-cta/);
    const dashboardScript = source('site/js/dashboard-v8.js');
    expect(dashboardScript).toContain('var BTN = "btn btn--primary";');
    expect(dashboardScript).not.toContain('var BTN = "btn btn--primary btn--discord-cta";');
  });
  it('keeps the account redesign isolated, responsive, and wired to the versioned runtime', () => {
    const page = source('site/account.html');
    const css = source(ACCOUNT_CSS);
    expect(page).toContain('css/account-v6.css');
    expect(page).not.toContain('css/account-v5.css');
    expect(css).toMatch(/body\.page-account \.ppanel__av\s*\{\s*border-radius:\s*50%;\s*\}\s*$/);
    expect(page).toContain('<header class="nav" id="nav">');
    expect(page).toContain('class="account-workspace"');
    expect(page).toContain('class="account-membership"');
    expect(page).toContain('class="account-tasklist"');
    expect(page).toContain('id="accountBilling"');
    expect(page).not.toContain('id="accountActivateOpen"');
    expect(page).toContain('js/main-v51.js');
    expect(page).toContain('css/billing-v3.css?v=compact-checkout-v1');
    expect(page).toContain('https://js.stripe.com/dahlia/stripe.js');
    expect(page).toContain('frame-src https://checkout.stripe.com https://js.stripe.com');
    expect(css).toContain('body.page-account');
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)/);
    expect(css).toMatch(/@media\s*\(min-width:\s*1280px\)\s*and\s*\(min-height:\s*800px\)/);
    expect(css).toContain('clamp(430px, 33.333%, 520px)');
    expect(css).not.toMatch(/body\.page-account\s+\.nav\s*\{[^}]*display:\s*none;?[^}]*\}/s);
  });
  it('keeps the account journey focused and the session exit visible', () => {
    const script = source(SITE_JS);
    const claim = claimCardSource();
    expect(claim).toContain('return "";');
    expect(claim).not.toContain('Stripe subscriptions are managed from the account panel.');
    expect(script).toContain('function billingCheckoutModal(plan, interval)');
    expect(script).toContain('function ensureStripeJs()');
    expect(script).toContain('createEmbeddedCheckoutPage');
    expect(script).not.toContain('stripe.initCheckout');
    expect(script).not.toContain('createPaymentElement');
    expect(script).toContain('payload.clientSecret');
    expect(script).toContain('window.location.assign(payload.url)');
    expect(script).toContain('function continueHostedBillingCheckout()');
    const billingErrorSource = script.slice(
      script.indexOf('function showBillingError('),
      script.indexOf('function closeBillingCheckout'),
    );
    expect(billingErrorSource).not.toContain('claim.loginAgain');
    expect(script).not.toContain('vozenDiscordAuth');
    expect(script).not.toContain('window.open("about:blank"');
    expect(script).not.toContain('vozenDiscordLogin');
    expect(script).not.toContain('vozen:discord-auth');
    expect(script).toContain('login({ billing: true });');
    expect(script).toContain('BILLING_INTENT_KEY');
    expect(script).toContain('const BILLING_OAUTH_REDIRECT = new URL("/", location.href).href');
    expect(script).toContain(
      'options && options.billing === true ? BILLING_OAUTH_REDIRECT : OAUTH_REDIRECT',
    );
    expect(script).toContain('location.replace("/#premium")');
    expect(script).toContain('history.replaceState(null, "", "#premium")');
    const checkoutSource = script.slice(
      script.indexOf('async function startCheckout('),
      script.indexOf('const billingInterval'),
    );
    expect(checkoutSource).not.toContain('window.location.href');
    expect(claim).toContain('id="activate-purchase"');
    expect(claim).toContain('role="dialog"');
    expect(claim).toContain('id="ppClaimClose"');
    expect(claim).toContain('<details class="ppanel__receipt"');
    expect(claim).toContain('class="ppanel__activatebtn"');
    expect(script).toContain('class="ppanel__logout-icon"');
    expect(script).toContain('function openPurchaseActivation()');
    expect(script).toContain('function mountPurchaseActivation(el)');
  });
  it('loads Stripe.js for the on-site embedded Checkout and cache-busts the runtime', () => {
    const page = source('site/index.html');
    expect(page).toContain('css/billing-v3.css?v=compact-checkout-v1');
    expect(page).toContain('js/i18n-v41.js?v=payment-element');
    expect(page).toContain(
      '<script defer data-vozen-stripe src="https://js.stripe.com/dahlia/stripe.js"></script>',
    );
    expect(page).toContain('js/main-v51.js?v=embedded-checkout-v1');
    expect(source(SITE_JS)).toContain('BILLING_COPY_FALLBACKS');
  });
  it('keeps the embedded checkout error inside the dark blurred modal', () => {
    const css = source(BILLING_CSS);
    const script = source(SITE_JS);
    expect(css).toContain('backdrop-filter: blur(12px) saturate(0.72)');
    expect(css).toContain('width: min(100%, 600px)');
    expect(css).toContain('.billing-elements');
    expect(css).toContain('min-height: 420px');
    expect(css).toContain('background: #0c1220');
    expect(css).not.toContain('background: #fff');
    expect(script).toContain('billing-modal__error-icon');
    expect(script).toContain('window.scrollY');
    expect(script).toContain('window.scrollTo(0, billingScrollY)');
    expect(script).toContain('billingBodyStyle');
    expect(script).toContain('pointerdown');
    expect(script).toContain('preserveScrollBeforeFocus');
    expect(script).toContain('billingPendingScrollY');
    expect(script).toContain('document.documentElement.insertAdjacentHTML');
  });
  it('cache-busts the checkout layout whenever the billing stylesheet changes', () => {
    for (const pagePath of ['site/index.html', 'site/account.html']) {
      const page = source(pagePath);
      expect(page, pagePath).toContain('css/billing-v3.css');
      expect(page, pagePath).not.toContain('css/billing-v1.css');
      expect(page, pagePath).not.toContain('css/billing-v2.css');
    }
  });
  it('keeps the Cloudflare CSP aligned with the self-hosted-font privacy promise', () => {
    const script = source('tools/cf-security-headers.mjs');
    expect(script).not.toContain('fonts.googleapis.com');
    expect(script).not.toContain('fonts.gstatic.com');
    expect(script).toContain("style-src 'self' 'unsafe-inline'");
    expect(script).toContain("font-src 'self'");
    expect(script).toContain("script-src 'self' https://js.stripe.com https://*.js.stripe.com");
    expect(script).toContain('frame-src https://checkout.stripe.com https://js.stripe.com');
    expect(script).toContain('https://api.stripe.com');
    expect(script).toContain('https://link.com');
    expect(script).toContain('payment=(self');
    expect(source('.github/workflows/security-headers.yml')).toContain('CF_API_TOKEN');
  });
  it('verifies both downloaded Kokoro model assets against pinned SHA-256 hashes', () => {
    const script = source('tools/setup-kokoro.ps1');
    expect(script).toContain('7D5DF8ECF7D4B1878015A32686053FD0EEBE2BC377234608764CC0EF3636A6C5');
    expect(script).toContain('BCA610B8308E8D99F32E6FE4197E7EC01679264EFED0CAC9140FE9C29F1FBF7D');
    expect(script).toContain('Get-FileHash');
  });
  it('does not ship byte-identical font files under duplicate names', () => {
    const fontDir = resolve(process.cwd(), 'site/assets/fonts');
    const byHash = new Map();
    for (const name of readdirSync(fontDir)) {
      const bytes = readFileSync(resolve(fontDir, name));
      const hash = createHash('sha256').update(bytes).digest('hex');
      expect(byHash.get(hash), `${name} duplicates ${byHash.get(hash)}`).toBeUndefined();
      byHash.set(hash, name);
    }
  });
  it('keeps every font URL in the site stylesheet resolvable', () => {
    const css = source(SITE_CSS);
    const urls = [...css.matchAll(/url\("\.\.\/assets\/fonts\/([^"?]+)"\)/g)].map(
      (match) => match[1],
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const name of urls) {
      expect(existsSync(resolve(process.cwd(), 'site/assets/fonts', name)), name).toBe(true);
    }
  });
  it('localizes account accessibility labels from the canonical dictionary', () => {
    const script = source(SITE_JS);
    expect(script).toContain('t("account.copyDiscordId")');
    expect(script).toContain('t("account.closeActivation")');
    expect(script).not.toContain('aria-label="Copy Discord ID"');
  });
  // Delivery happens when the buyer activates here, so the checkbox itself must explicitly name
  // immediate performance and the applicable loss of the withdrawal right before either path.
  it('gates pass activation behind an express consent checkbox', () => {
    const script = source(SITE_JS);
    expect(script).toContain('id="ppClaimConsent"');
    expect(script).toContain('claim.consent');
    // The guard must refuse when unticked — failing open would activate the pass with no
    // acknowledgement at all.
    expect(script).toMatch(/if \(!consent \|\| !consent\.checked\)/);
    expect(script).toContain('claim.consentRequired');
  });
  it('renders explicit immediate-delivery consent with a real terms link', () => {
    const card = fnSource(source(SITE_JS), 'function claimCard()');
    expect(card).toContain('claim.consent');
    expect(card).toContain('claim.consentTerms');
    expect(card).toMatch(/<a href="\/terms"/);
    // The <a> is injected in place of the {terms} placeholder inside the trusted consent copy.
    expect(card).toContain('.replace("{terms}"');
    const english = i18nBundle().en['claim.consent'];
    expect(english).toMatch(/immediate activation/i);
    expect(english).toMatch(/withdrawal right/i);
  });
  it('implements instant activation with strict success parsing and one-shot OAuth resume', () => {
    const script = source(SITE_JS);
    const card = claimCardSource();
    const activation = fnSource(script, 'async function doInstantActivation(');
    expect(card).toContain('id="ppActivateBtn"');
    expect(card).toContain('claim.giftNote');
    expect(card.indexOf('ppActivateBtn')).toBeLessThan(card.indexOf('ppClaimCode'));
    expect(script).toContain('const ACTIVATION_TERMS_VERSION = "2026-07-19"');
    expect(script).toContain('u.searchParams.set("scope", "identify email")');
    expect(activation).toContain('PREMIUM_API_BASE + "/api/activate"');
    expect(activation).toContain('termsAccepted: true');
    expect(activation).toMatch(/res\.status === 200 && body\.ok === true/);
    expect(script).toContain('const ACTIVATION_INTENT_TTL_MS = 5 * 60 * 1000');
    expect(script).toContain('sessionStorage.removeItem(ACTIVATION_INTENT_KEY)');
    expect(script).toContain('allowRelogin: false');
    expect(script).toContain('downloadActivationConfirmation');
    expect(script).toContain('acceptedAtIso');
  });
  // The claim field takes the whole receipt URL now (extractReceiptCode, src/premium/claim.ts),
  // so the copy must stop teaching people to perform surgery on an address bar — "the code
  // after txid=" was never a reasonable thing to ask, and on the monthly receipt it actively
  // misled: the code sits mid-URL, so selecting to the end drags &mode=g along.
  //
  // Asserted as an absence, deliberately. Checking that ten languages each "say to paste the
  // link" is not something a string match can honestly do — but the surgical instruction is
  // one literal token, and its absence is checkable in every language.
  it('no longer asks buyers to extract the code from the URL', () => {
    const bundle = source(SITE_I18N);
    const sandbox = {
      window: {},
    };
    new Function('window', bundle)(sandbox.window);
    const all = sandbox.window.VOZEN_I18N ?? {};
    const langs = Object.keys(all);
    expect(langs.length).toBeGreaterThan(0);
    for (const lang of langs) {
      for (const key of [
        'claim.hint',
        'claim.placeholder',
        'claim.useReceiptCode',
        'claim.notfound',
      ]) {
        expect(all[lang][key], `${lang} ${key} exists`).toBeTruthy();
        expect(all[lang][key], `${lang} ${key} still says txid=`).not.toContain('txid=');
      }
    }
  });
  // Closing the receipt tab is not a dead end — Ko-fi emails the buyer a receipt — but the card
  // never said so, which made it one in practice. The line has to name the email first (the copy
  // every buyer has), and hand the genuinely-stuck tail to the help modal (plan 036) rather than
  // dumping them straight on support.
  it('offers a way back when the buyer no longer has the receipt', () => {
    const card = claimCardSource();
    expect(card).toContain('claim.lost');
    expect(card).toContain('claim.lostHelp');
    // The modal is the escape hatch now; support lives inside it, one step further in.
    expect(card).toContain('ppClaimHelpOpen');
  });
  // The `.js-support` wiring at the top of the file runs ONCE over the document at load, and both
  // the claim card and the help modal are injected later, after OAuth. An anchor leaning on that
  // wiring would render with no href at all — so the markup must carry the URL itself. A silent
  // hrefless link is exactly the failure the recovery path exists to prevent.
  it('renders the support link with a real href, not the one-time wiring', () => {
    const modal = helpModalSource();
    expect(modal).toContain('${SUPPORT_URL}');
    expect(modal, 'must not rely on the one-time .js-support wiring').not.toContain('js-support');
  });
  // The Ko-fi email receipt shows `Ref: S-M1X823C9FW` — the only code-looking string in the whole
  // email, and one we can NEVER accept: the webhook payload has no such field, so no pending row
  // carries it. Someone hunting for a code finds that, pastes it, and gets a flat "no purchase
  // found" for a purchase they really made. Catch the shape before the request leaves the browser
  // and send them somewhere useful instead.
  it('catches the Ko-fi order Ref before it reaches the server', () => {
    const script = source(SITE_JS);
    expect(script).toMatch(/REF_RE\s*=/);
    const claim = fnSource(script, 'async function doClaim(');
    expect(claim).toContain('REF_RE');
    expect(claim).toContain('claim.help.refPasted');
    // Must be decided BEFORE the fetch: reaching the server means a 404 the buyer cannot act on.
    const refAt = claim.indexOf('REF_RE');
    const fetchAt = claim.indexOf('fetch(');
    expect(refAt, 'Ref check must precede the fetch').toBeLessThan(fetchAt);
  });
  // Every dismissal a modal can offer, because someone who cannot close it is trapped on the one
  // page they went to for help. Esc is the one most often forgotten.
  it('makes the help modal dismissable and announced', () => {
    const modal = helpModalSource();
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-labelledby');
    const script = source(SITE_JS);
    expect(script).toContain('ppClaimHelpClose'); // the X
    expect(script).toMatch(/Escape/); // keyboard
    expect(script).toContain('ppClaimHelpBackdrop'); // click-outside
  });
  // The help request carries the EMAIL, not the Ref: Ko-fi's transaction search matches by email,
  // so the Ref is useless to the owner (verified against the live seller panel, 2026-07-17). The
  // email is a lookup hint, not proof — the owner still confirms the paid order and grants by hand.
  it('collects the Ko-fi email in the help modal and posts it, not the Ref', () => {
    const modal = helpModalSource();
    expect(modal).toContain('id="ppClaimHelpEmail"');
    expect(modal).toContain('type="email"');
    expect(modal).toContain('claim.help.emailPlaceholder');
    const script = source(SITE_JS);
    // The POST body must send { email: ... } — a lingering { ref } would reach the endpoint's
    // bad_email guard and the buyer would get nothing.
    expect(script).toMatch(/body:\s*JSON\.stringify\(\{\s*email:/);
  });
  it('translates the recovery and help copy into every advertised site language', () => {
    const all = i18nBundle();
    const langs = Object.keys(all);
    expect(langs.length).toBeGreaterThan(0);
    for (const lang of langs) {
      // Split into separate keys on purpose: no translation has to carry markup through esc().
      for (const key of [
        'claim.lost',
        'claim.lostHelp',
        'claim.help.title',
        'claim.help.step1',
        'claim.help.step2',
        'claim.help.emailPlaceholder',
        'claim.help.send',
        'claim.help.refPasted',
        'claim.help.notEmail',
        'claim.help.sent',
        'claim.help.stillStuck',
      ]) {
        expect(all[lang][key], `${lang} ${key}`).toBeTruthy();
      }
    }
  });
  it('translates the consent copy into every advertised site language', () => {
    const bundle = source(SITE_I18N);
    const sandbox = {
      window: {},
    };
    new Function('window', bundle)(sandbox.window);
    const all = sandbox.window.VOZEN_I18N ?? {};
    const langs = Object.keys(all);
    expect(langs.length).toBeGreaterThan(0);
    for (const lang of langs) {
      // Untranslated consent text is not a cosmetic gap: someone who cannot read what they
      // are accepting has not knowingly accepted it.
      expect(all[lang]['claim.consent'], `${lang} claim.consent`).toBeTruthy();
      expect(all[lang]['claim.consentRequired'], `${lang} claim.consentRequired`).toBeTruthy();
      expect(all[lang]['claim.consentTerms'], `${lang} claim.consentTerms`).toBeTruthy();
      // Every consent string must keep the {terms} placeholder — that is where the clickable
      // terms link is injected. A translation that drops it would render a linkless sentence.
      expect(all[lang]['claim.consent'], `${lang} keeps the {terms} slot`).toContain('{terms}');
      for (const key of [
        'claim.instantBtn',
        'claim.instantWorking',
        'claim.giftNote',
        'claim.orReceipt',
        'claim.activationOk',
        'claim.downloadConfirmation',
        'claim.emailMissing',
        'claim.emailUnverified',
        'claim.serviceUnavailable',
        'claim.loginAgain',
        'claim.resumeExpired',
      ]) {
        expect(all[lang][key], `${lang} ${key}`).toBeTruthy();
      }
    }
  });
  // The terms link inside the consent line must look clickable — a distinct colour, not the dim
  // body colour it would inherit from .ppanel__claimconsent. Without it the only affordance is the
  // cursor, which nobody sees; the buyer never realises the terms are a link.
  it('styles the consent terms link as clickable', () => {
    const css = source(SITE_CSS);
    expect(css).toMatch(/\.ppanel__claimconsent a\s*\{[^}]*var\(--aqua\)/);
  });
  it('documents the Stripe digital checkout contract', () => {
    const terms = source('site/terms.html');
    expect(terms).toMatch(/14-day withdrawal right/i);
    expect(terms).toMatch(/digital subscriptions processed by Stripe/i);
    expect(terms).toMatch(/does not collect a shipping address/i);
    expect(terms).not.toMatch(/Ko-fi purchase/i);
  });
  it('keeps Stripe-hosted checkout as a safe fallback and configures embedded Checkout', () => {
    const stripe = source('crates/vozen-api/src/stripe_api.rs');
    const hosted = stripe.slice(
      stripe.indexOf('async fn checkout('),
      stripe.indexOf('async fn checkout_elements('),
    );
    const elements = stripe.slice(
      stripe.indexOf('async fn checkout_elements('),
      stripe.indexOf('async fn portal('),
    );
    expect(hosted).toContain('("ui_mode", "hosted_page".to_owned())');
    expect(hosted).toContain('("success_url", success_url)');
    expect(hosted).toContain('("cancel_url", cancel_url)');
    expect(hosted).toContain('v.get("url")');
    expect(elements).toContain('("ui_mode", "embedded_page".to_owned())');
    expect(elements).toContain('("redirect_on_completion", "never".to_owned())');
    expect(elements).toContain('"clientSecret"');
    expect(elements).toContain('"publishableKey"');
    expect(elements).toContain('json_no_store_response');
    expect(elements).toContain('checkout_identity_mismatch');
    expect(stripe).toContain('.route("/api/billing/checkout/status", any(checkout_status))');
    expect(stripe).toContain('fn valid_stripe_session_id');
    expect(stripe).toContain('.header("Stripe-Version", STRIPE_API_VERSION)');
    expect(elements).not.toContain('"return_url"');
  });
});
