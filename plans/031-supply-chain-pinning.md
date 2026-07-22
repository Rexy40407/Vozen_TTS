# Plan 031: Shrink the install-script surface + pin the Whisper sidecar (supply-chain)

> **Executor instructions**: CI/tooling + sidecar installers. Verify the bot still
> builds native modules. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat f1a1ac1..HEAD -- package.json .github/workflows/ci.yml .github/workflows/deploy-bot.yml tools/setup-whisper.sh tools/setup-whisper.ps1`

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED (native modules must still build/boot)
- **Depends on**: none (but coordinate with plan 027 which also edits `deploy-bot.yml`)
- **Category**: security / supply-chain
- **Planned at**: commit `f1a1ac1`, audit findings DEP-01, DEP-02, DEP-03. `npm audit` is CLEAN; these are install-time RCE surface + reproducibility, not CVEs.

## Why this matters

1. **`allowScripts` is inert** (DEP-01). `package.json:59-64` lists 4 packages as if
   install scripts were restricted to them, but nothing consumes that key
   (no `@lavamoat/allow-scripts`, no `.npmrc ignore-scripts` — the repo's own
   `ci.yml:24-28` comment says so). So `npm ci` runs lifecycle scripts for **all
   363 dependencies** on the CI runner AND on the **production VPS during unattended
   auto-deploy** (`deploy-bot.yml`). Any transitive package with a malicious install
   script (a hijacked release entering the lockfile) runs arbitrary code as the
   deploy user on prod. The implied surface is 4; the real surface is 363.
2. **`faster-whisper` installed unpinned on the VPS** (DEP-02). `tools/setup-whisper.sh:11`
   (the VPS installer) does `pip install ... faster-whisper` with no version/hash;
   the other two sidecars (`requirements-clone.txt`, `requirements-kokoro.txt`) pin
   with `==`. Two rebuilds can install different versions; a compromised release
   (of faster-whisper or a transitive) is pulled and run on prod at setup time.
3. **Sidecar pins lack hashes** (DEP-03, lower). The pinned sidecars pin only
   top-level packages; transitives still float (no `--require-hashes`).

## Current state

- `package.json:59-64` — `allowScripts` block (inert); `ci.yml:24-28` comment
  confirms it. No `.npmrc` in the repo. Native modules needing build/fetch scripts:
  `better-sqlite3`, `@discordjs/opus` (node-pre-gyp), `esbuild`, `ffmpeg-static`.
- `deploy-bot.yml:37` + `ci.yml` — `npm ci` (runs all install scripts).
  `scripts/start-prod.mjs` does a native-module preheat at startup (a failed rebuild
  is caught early — the verification story for the `--ignore-scripts` approach).
- `tools/setup-whisper.sh:11` + `tools/setup-whisper.ps1:40` — unpinned
  `faster-whisper`. Contrast `tools/requirements-clone.txt`, `requirements-kokoro.txt`.

## Scope

**In scope**: `package.json` (allowScripts strategy), `.npmrc` (new, if adopting
option A), `ci.yml` + `deploy-bot.yml` (install command), `tools/setup-whisper.{sh,ps1}`
+ a new `tools/requirements-whisper.txt`.
**Out of scope**: bumping any runtime dependency version; the sidecar Python code;
GPU/clone specifics.

## Steps

### Part A — shrink the npm install-script surface (DEP-01)

Choose ONE (document which in a comment):

- **Option A (proper allow-scripts):** add `@lavamoat/allow-scripts` to
  devDependencies, add `.npmrc` with `ignore-scripts=true`, move the 4-package list
  under `lavamoat.allowScripts` in `package.json`, and run `allow-scripts` (or
  `npx lavamoat-allow-scripts`) as a step AFTER `npm ci` in BOTH `ci.yml` and
  `deploy-bot.yml`. Only the 4 listed packages then run scripts.
- **Option B (simpler):** switch `npm ci` → `npm ci --ignore-scripts` in `ci.yml`
  and `deploy-bot.yml`, then add an explicit `npm rebuild better-sqlite3 @discordjs/opus`
  step (and confirm `esbuild`/`ffmpeg-static` binaries still resolve — they fetch
  prebuilt binaries; if `--ignore-scripts` skips their fetch, add them to the rebuild
  or a postinstall allowlist). Either way the startup native-preheat in
  `start-prod.mjs` verifies the bot can boot.

Whichever option: the `allowScripts` key must stop being a no-op — either it becomes
real (A) or it's replaced by `--ignore-scripts` + explicit rebuilds (B) and the dead
key is removed with a comment explaining the new posture.

### Part B — pin faster-whisper (DEP-02)

- Create `tools/requirements-whisper.txt` pinning `faster-whisper==<current>` and,
  ideally, its heavy natives `ctranslate2==<current>` / `onnxruntime==<current>`
  (get the current known-good versions by reading what a fresh install resolves, or
  from the running VPS if available — do NOT invent version numbers).
- Change `tools/setup-whisper.sh` and `.ps1` to `pip install -r tools/requirements-whisper.txt`
  (mirror how `setup-clone`/`setup-kokoro` use `-r`).

### Part C — hashes (DEP-03, optional/lower)

- If cheap, generate fully-resolved hashed lockfiles per sidecar
  (`pip-compile --generate-hashes` or `pip freeze` per venv) and install with
  `--require-hashes`. If it materially complicates the installers, note it as a
  follow-up rather than shipping a half-measure.

## Test plan

- No unit tests. Verification is operational:
  - After Part A, `npm ci` (or the new install command) + `npm run build` still
    succeed and the native preheat in `start-prod.mjs` passes (the bot boots).
  - After Part B, `tools/setup-whisper.sh` installs the pinned version (dry-read the
    script; the actual pip run happens on the VPS — do NOT run installs from the
    audit environment).

## Done criteria

- [ ] The `allowScripts` key is no longer inert — either real via `@lavamoat/allow-scripts` (+`.npmrc`) OR replaced by `--ignore-scripts` + explicit native rebuilds, in BOTH `ci.yml` and `deploy-bot.yml`
- [ ] `npm run build` + native preheat still succeed (bot boots) after the change
- [ ] `tools/requirements-whisper.txt` exists and both setup-whisper scripts install via `-r`
- [ ] Coordinated with plan 027 so both `deploy-bot.yml` edits merge cleanly
- [ ] `npm run check` exits 0 (Part A must not break the build)

## STOP conditions

- If `--ignore-scripts` breaks native-module resolution (bot won't boot after
  `npm rebuild`), STOP and prefer Option A, or report exactly which package's script
  is required.
- Do NOT run `npm audit fix --force` (forbidden — downgrades discord.js to v13).
- Do NOT invent pinned version numbers for faster-whisper — read the actual resolved
  versions; if unavailable, STOP and ask which version the VPS currently runs.

## Maintenance notes

- With allow-scripts/ignore-scripts in place, adding a new native dependency
  requires adding it to the allowlist (A) or the explicit rebuild list (B) — this is
  intended friction; document it near the install step.
- Bumping `faster-whisper` becomes a deliberate edit to `requirements-whisper.txt`.
