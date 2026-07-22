# Plan 016: Hybrid engine Phase 2 — add Kokoro (kokoro-onnx) as an OPT-IN per-user engine (gTTS stays the default)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/tts/engine.ts src/tts/perUserRouter.ts src/tts/factory.ts src/store/userVoice.ts src/tts/cache.ts src/commands/handlers/voice.ts src/commands/index.ts src/config/index.ts`
> The "Current state" excerpts were captured after plans 001–015 landed. If any
> in-scope file changed since, compare the excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (product differentiator: better free voices, opt-in)
- **Effort**: L
- **Risk**: MED (new Python sidecar; UI/enum/cache-key surface across a few files)
- **Depends on**: plan 015 (landed). Reuses the `RouterEngine` from Phase 1.
- **Category**: feature
- **Decisions locked (by the operator, Diogo)**:
  1. **Runtime = `kokoro-onnx`** (ONNX Runtime, CPU-only). A NEW, isolated Python
     sidecar — do NOT reuse the Chatterbox clone venv.
  2. **gTTS stays the default engine for everyone. Kokoro is OPT-IN**: a third
     choice in `/voice set engine` (alongside Google/Piper), exactly like Piper
     is an option today. Nobody's default voice changes. NO router-top insertion,
     NO premium gating.
  3. **Nothing is removed**: gTTS and Piper are untouched. With the sidecar
     absent, behavior is byte-identical to today.

## Goal / Objetivo

Let a user run `/voice set engine:Kokoro` and get Kokoro's higher-quality neural
voice for the ~8 languages Kokoro supports, falling back to **gTTS** for any
other language or on any Kokoro failure — so an opt-in user is never left
without audio, and a non-opting user hears exactly what they hear today (gTTS).
Implemented by adding `'kokoro'` as a third `SynthRequest.engine` value dispatched
by `PerUserEngineRouter`, where the Kokoro path is itself a tiny
`RouterEngine([kokoro (its langs) → gTTS (catch-all)])`.

## Why this matters

`docs/RESEARCH-TTS-BOT-VS-VOXI.md` and `docs/MONETIZATION.md` name Kokoro-quality
free voices as the product's differentiator. The operator wants it available
without disturbing the current default (gTTS), so this ships it as a per-user
option — the same mechanism that already lets users pick Piper.

## Phase 0 result (DONE — spike passed)

Ran in a throwaway venv (`scratchpad/kokoro-spike/`, Python 3.12):

- **`kokoro-onnx 0.5.0`** installs cleanly; pulls `onnxruntime`, `numpy`,
  `phonemizer-fork`, and **`espeakng-loader` (bundles espeak-ng)** → **pt-BR g2p
  works with NO system espeak-ng install**. This removes the biggest infra risk.
- Model `kokoro-v1.0.onnx` (311 MB) + `voices-v1.0.bin` (27 MB) from the
  `thewh1teagle/kokoro-onnx` `model-files-v1.0` GitHub release.
- **Load 1.1 s** (cold). Warm synth **RTF ≈ 0.25** (~1.0–1.15 s for a ~4 s
  sentence; a short Discord message ≈ 0.3–0.5 s) — well under the 2.5 s STOP
  threshold. Output **24 kHz** (matches Piper).
- **54 voices**; PT = `pf_dora`, `pm_alex`, `pm_santa`. API:
  `Kokoro(model, voices).create(text, voice=<id>, speed=<f>, lang="en-us"|"pt-br"|…)`
  (note: `get_languages()` does NOT exist in 0.5.0 — hardcode the lang map).
- Samples at `C:\Users\diogo\Videos\kokoro-samples\` (operator to confirm the
  voice quality is acceptable before Phase 1; the technical bar is met).

## Current state (verify before editing)

- **`src/tts/engine.ts`** — `SynthRequest.engine?: 'google' | 'piper'` (comment:
  default 'google'; enters the cache key only when 'piper' so audio isn't shared
  across engines). `TTSEngine.synth(req): Promise<string>` (abs `.wav` path).
- **`src/tts/perUserRouter.ts`** — `PerUserEngineRouter` (20 lines):
  `constructor(google, piper)`; `synth(req)` returns
  `(req.engine === 'piper' ? this.piper : this.google).synth(req)`. This is the
  opt-in dispatch point.
- **`src/tts/factory.ts`** — `createPerUserEngine(config, cache)` (28-46) builds
  `gtts`, wraps it in a `CircuitBreakerEngine` (`google`), builds `piper`, and
  returns `new PerUserEngineRouter(google, piper)`. `makePiper` at 48-56. The
  `RouterEngine` is imported here already (used by the `router` branch).
- **`src/tts/router.ts`** — `RouterEngine(routes: EngineRoute[])`, tries routes
  in order by `langKeyOfModel(req.model)`, throws-falls-through, last route MUST
  be catch-all (`langs: null`). REUSE it for the Kokoro→gTTS fallback path; do
  NOT modify it.
- **`src/store/userVoice.ts`** — `export type UserEngine = 'google' | 'piper'`
  (:6); row map `r.engine === 'piper' ? 'piper' : 'google'` (:32); setter default
  `engine: UserEngine = 'google'` (:48). The `user_voice.engine` column is
  `NOT NULL DEFAULT 'google'` (db.ts migration). Extend the type + the read/write
  to accept `'kokoro'`.
- **`src/commands/handlers/voice.ts`** — reads the engine option twice:
  `getString('engine') as 'google' | 'piper' | null` (:57 detection branch, :454
  the `/voice set` branch) and renders a label
  `engineOpt === 'piper' ? 'Piper' : 'Google'` (:70, :466). Extend the cast, the
  label, and the persistence to include `'kokoro'`.
- **`src/commands/index.ts`** — `commandDefsRaw` holds the `/voice set` `engine`
  string option with `.addChoices({name:'Google',value:'google'}, {name:'Piper',
value:'piper'})` (grep `addChoices` / `'engine'`). Add a `Kokoro` choice.
- **`src/tts/cache.ts`** — `cacheKey(...)` folds `engine` in only when `'piper'`.
  Fold `'kokoro'` in the SAME way (so Kokoro audio doesn't collide with
  gTTS/Piper for the same text+model).
- **`src/tts/cloneEngine.ts`** — the REFERENCE Python-sidecar pattern (spawn,
  warmup→`{ready}`, FIFO queue, per-job timeout, ready-deadline,
  `resolveCloneCmd` venv auto-detect returning `null` when absent). Mirror it for
  Kokoro MINUS GPU serialization; **KokoroEngine.synth THROWS on failure** so the
  wrapping `RouterEngine` falls to gTTS (do NOT swallow).
- **`tools/setup-clone.ps1` + `tools/requirements-clone.txt`** — install
  template (gitignored venv, pinned `pip install -r`). Mirror as
  `setup-kokoro.ps1` + `requirements-kokoro.txt` → `tools/kokoro-venv/`.
- **`src/config/index.ts`** — env helpers `numEnvPositive`, `boolEnvDefaultOff`,
  string reads (e.g. `cloneCmd` env `CLONE_CMD`). Add Kokoro fields.

Conventions: Portuguese comments; TS `NodeNext`/`strict`; tests flat in `tests/`;
full suite is the primary gate (**1349** at plan-015 DONE); CI runs
`build`+`typecheck`+`lint`+`format:check`+`vitest`.

## Scope

### In

- New sidecar: `tools/requirements-kokoro.txt`, `tools/setup-kokoro.ps1`,
  `tools/kokoro_server.py`; `.gitignore` += `tools/kokoro-venv/`.
- `src/tts/kokoroEngine.ts` (new; implements `TTSEngine`; `resolveKokoroCmd`).
- `src/tts/engine.ts` — extend `SynthRequest.engine` to include `'kokoro'`.
- `src/tts/perUserRouter.ts` — add a `kokoro` engine + dispatch.
- `src/tts/factory.ts` — `createPerUserEngine`: build the Kokoro path
  (`RouterEngine([kokoro→google])` when the sidecar resolves, else just `google`)
  and pass it to `PerUserEngineRouter`.
- `src/tts/cache.ts` — fold `'kokoro'` into `cacheKey` like `'piper'`.
- `src/store/userVoice.ts` — `UserEngine` += `'kokoro'`; read/write accept it.
- `src/commands/index.ts` — add the `Kokoro` choice to the `/voice set engine`
  option in `commandDefsRaw`.
- `src/commands/handlers/voice.ts` — accept/label/persist `'kokoro'`.
- `src/config/index.ts` — `kokoroCmd`, `kokoroLangs`, `kokoroChunkConcurrency`.
- Tests: `tests/kokoroEngine.test.ts` (new), extend `tests/factory.test.ts` and
  the userVoice/voice-command tests as needed.
- Docs: `.env.example`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`.

### Out (do NOT touch)

- `src/tts/router.ts` — reuse as-is; if you edit it, stop.
- The gTTS default path, `CircuitBreakerEngine`, Piper, `makePiper`, the `router`
  branch of `createEngine` (that is the OTHER, non-default engine mode).
- Premium gating / entitlements. Any change to the `router`-mode wiring.
- Kokoro voice _picking_ UI beyond the single engine choice (one voice per lang
  is chosen by the engine's internal map — no new `/voice` surface).

## Phases

### Phase 0 — Spike (DONE, see result above)

### Phase 1 — Sidecar install tooling + server

- [ ] `tools/requirements-kokoro.txt`: pin `kokoro-onnx==0.5.0`, `soundfile`, and
      the resolved transitive versions from the spike (`onnxruntime`,
      `phonemizer-fork`, `espeakng-loader`, `numpy` — capture with `pip freeze`).
- [ ] `tools/setup-kokoro.ps1` (mirror `setup-clone.ps1`): create
      `tools/kokoro-venv/`, `pip install -r`, and download
      `kokoro-v1.0.onnx` + `voices-v1.0.bin` into `tools/` (from the
      `model-files-v1.0` release). Idempotent; skips existing files.
- [ ] `tools/kokoro_server.py`: stdin line protocol like `clone_server.py` — read
      one JSON request per line (`{text, out, lang, voice, speed}`), synth to
      `out`, print the out path; print `{"ready":true}` once after model load.
- [ ] `.gitignore` += `tools/kokoro-venv/`, `tools/kokoro-v1.0.onnx`,
      `tools/voices-v1.0.bin`.
- **Done**: `pwsh tools/setup-kokoro.ps1` succeeds; a hand-fed JSON line prints a
  valid WAV path.

### Phase 2 — `KokoroEngine` (TS), implements `TTSEngine`

- [ ] `src/tts/kokoroEngine.ts`: mirror `CloneEngine` process management (spawn,
      warmup→ready with a ready-deadline, FIFO queue + per-job timeout, teardown),
      bounded concurrency (default 2, config). `resolveKokoroCmd(explicit)`
      auto-detects `tools/kokoro-venv` + `tools/kokoro_server.py` +
      the two model files; returns `null` when any is missing.
- [ ] `langKey → { kokoroLang, voice }` map (e.g. `en→{en-us, af_heart}`,
      `pt→{pt-br, pf_dora}`, …; use the exact ids from Phase 0). Cache namespace
      `'kokoro'`.
- [ ] **`synth` THROWS** on: sidecar unavailable, timeout, error line, or an
      unmapped language (so the wrapping RouterEngine falls to gTTS).
- [ ] `tests/kokoroEngine.test.ts` with a FAKE child: (a) ready→synth returns the
      WAV path, (b) sidecar error throws, (c) unmapped lang throws,
      (d) `resolveKokoroCmd` returns `null` when the venv/model is absent.
- **Done**: build+typecheck clean; new tests green; suite still ≥1349.

### Phase 3 — Wire as an opt-in per-user engine (the MVP)

- [ ] `src/tts/engine.ts`: `engine?: 'google' | 'piper' | 'kokoro'` (update the
      comment: 'kokoro' also enters the cache key).
- [ ] `src/tts/cache.ts`: fold `'kokoro'` into `cacheKey` exactly like `'piper'`.
- [ ] `src/tts/perUserRouter.ts`: `constructor(google, piper, kokoro)`;
      `synth` → `req.engine === 'kokoro' ? kokoro : req.engine === 'piper' ?
  piper : google`.
- [ ] `src/tts/factory.ts` `createPerUserEngine`: after building `google` and
      `piper`, resolve the sidecar; `kokoroPath = resolveKokoroCmd(config.kokoroCmd)
  ? new RouterEngine([{engine:new KokoroEngine(...), langs:config.kokoroLangs,
  label:'kokoro'}, {engine:google, langs:null, label:'gtts'}]) : google`.
      Return `new PerUserEngineRouter(google, piper, kokoroPath)`. When the sidecar
      is absent, `kokoroPath === google`, so choosing Kokoro transparently yields
      gTTS — no silence, no breakage.
- [ ] `src/store/userVoice.ts`: `UserEngine = 'google' | 'piper' | 'kokoro'`;
      read maps `'kokoro'` through; setter accepts it. (The DB column already
      stores an arbitrary string; verify the read-guard allows 'kokoro'.)
- [ ] `src/config/index.ts`: `kokoroCmd?` (env `KOKORO_CMD`),
      `kokoroLangs: Set<string>` (env `KOKORO_LANGS`, default the supported keys —
      verify against `langKeyOfModel`, e.g. `en,es,fr,hi,it,pt,ja,zh`),
      `kokoroChunkConcurrency` (numEnvPositive, default 2).
- **Done (MVP)**: with the sidecar installed, `/voice set engine:kokoro` then a
  message in a supported language is synthesized by Kokoro (logs show
  `kokoro`); an unsupported language or a Kokoro failure falls to gTTS; users
  who did not opt in are byte-identical to today. Suite ≥1349.

### Phase 4 — `/voice set engine` choice + docs

- [ ] `src/commands/index.ts`: add `{ name: 'Kokoro', value: 'kokoro' }` to the
      `engine` option's `addChoices` in `commandDefsRaw`.
- [ ] `src/commands/handlers/voice.ts`: extend the two `as 'google' | 'piper'`
      casts to include `'kokoro'`, the label ternary (`… : engine === 'kokoro' ?
  'Kokoro' : …`), and persistence. (Optional nicety: in the confirmation copy,
      note Kokoro covers ~8 languages and falls back to Google otherwise.)
- [ ] `.env.example` (KOKORO_* vars), `CONTRIBUTING.md` (optional Kokoro sidecar note,
      parallel to the clone one), `docs/ARCHITECTURE.md` (per-user engine now
      google/piper/kokoro).
- **Done**: `/voice set engine` lists Kokoro; docs updated; `.env.example` vars
  match `src/config/index.ts`.

### Phase 5 — Verification

- [ ] Live matrix (sidecar installed): opt-in user, en/pt message → Kokoro; an
      unsupported-language message → gTTS; Kokoro killed mid-run → clean fall to
      gTTS; a NON-opted user → unchanged gTTS. Sidecar ABSENT: choosing Kokoro
      behaves as gTTS.
- [ ] `npm run build && npm run typecheck && npm run lint && npm run format:check
  && npx vitest run` all green (≥1349).
- **Done**: matrix passes; all gates green.

## Git workflow

- Commit per phase (Portuguese one-liners), e.g.
  `feat(tts): sidecar kokoro-onnx (setup + server) (plano 016)`,
  `feat(tts): KokoroEngine (TTSEngine, sidecar) (plano 016)`,
  `feat(tts): Kokoro como motor opt-in no /voice (gTTS continua o default) (plano 016)`.
- Stage ONLY in-scope files by explicit path (never `git add -A`). Do NOT touch
  `.env`, `docs/RESEARCH-TTS-BOT-VS-VOXI.md`, or untracked `docs/*`.
- Commits contain only the human author's authorship.
- No push/PR unless told.

## Test plan

- New `tests/kokoroEngine.test.ts` (fake-child happy path, throw-on-failure,
  throw-on-unmapped-lang, `resolveKokoroCmd===null`).
- Extend `tests/factory.test.ts`: with the sidecar present (stubbed resolve) the
  per-user Kokoro path is a `RouterEngine([kokoro,gtts])`; absent, it is the plain
  `google` engine (so `PerUserEngineRouter` is unchanged for non-opters).
- If a userVoice/voice-command test enumerates engines, extend it to `'kokoro'`.
- CI never installs the sidecar — all tests pass with it ABSENT.
- Primary gate: `npx vitest run` never drops below the pre-plan count.

## Done criteria (machine-checkable)

- [ ] `npm run build && npm run typecheck && npm run lint && npm run format:check`
      all exit 0.
- [ ] `npx vitest run` ≥ 1349 pass, 0 fail.
- [ ] `ls src/tts/kokoroEngine.ts tools/kokoro_server.py tools/setup-kokoro.ps1 tools/requirements-kokoro.txt` — all exist.
- [ ] `grep -n "kokoro" src/tts/perUserRouter.ts src/tts/factory.ts` — dispatch +
      wiring present.
- [ ] `grep -n "'kokoro'" src/tts/engine.ts src/store/userVoice.ts` — enum
      extended in both.
- [ ] `git diff --stat -- src/tts/router.ts` empty (router untouched).
- [ ] `.env.example` KOKORO_* vars match `src/config/index.ts`.
- [ ] `plans/README.md` status row updated.

## Risks

- **UI/enum surface**: `'kokoro'` must be added in every place that today
  branches on `'piper'` (engine type, cache key, store read/write, command
  choice, handler label). → The Done-criteria greps enumerate them; a missed spot
  is caught by build/typecheck (the union type) or a test.
- **No-fallback trap**: `PerUserEngineRouter` has no fallback; a raw KokoroEngine
  as the kokoro arm would give silence on unsupported langs. → Mitigated by
  wrapping in `RouterEngine([kokoro→gTTS])` (Phase 3) — the plan's core trick.
- **CPU latency under concurrency** (many opt-in users at once). → bounded
  concurrency cap + AudioCache; the spike showed RTF 0.25 headroom.
- **Model asset size/licensing/offline**. → pinned + gitignored; documented in
  Phase 1.
- **Windows sidecar flakiness**. → mirror the battle-tested CloneEngine process
  management.

## MVP

**Phase 3.** `/voice set engine:kokoro` (once Phase 4 adds the choice) routes an
opt-in user's supported languages through Kokoro with a gTTS safety net, while
every non-opting user and every absent-sidecar install is byte-identical to
today.

## STOP conditions

- The operator judges Kokoro's voice quality NOT clearly better than gTTS for the
  languages that matter (Phase 0 samples) — then this feature is not worth
  shipping; report and stop.
- Wiring Kokoro requires editing `src/tts/router.ts` or changing the gTTS default
  path — means the design is being bent; re-plan.
- `npx vitest run` count drops below baseline at any step.
- The sidecar cannot be made to run reliably on Windows within Phase 1 (report
  the exact error).

Próxima ação concreta: o Diogo ouvir as 4 amostras em `C:\Users\diogo\Videos\kokoro-samples\` e confirmar que a qualidade do Kokoro compensa; com o sim, arranca a Phase 1 (tooling do sidecar).
