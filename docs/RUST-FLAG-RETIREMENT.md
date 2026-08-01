# Rust canary ownership and flag-retirement matrix

Status: design and inventory only (2026-08-01). This document does not change
runtime behavior, traffic ownership, environment defaults, or deployment files.

## Scope and evidence

`FULL_RUNTIME_FLAGS` in `crates/vozen-runtime/src/runtime_mode.rs` is the
authoritative cutover set. The matrix below covers every member of that set.
The staging template is intentionally `shadow` with `RUST_RUNTIME_READY=false`;
the production fragment is `full` and enables the functional canaries. While
shadow mode is active, Node remains the compatibility owner for interactions
whose Rust canary is false. In full mode, the owner shown below is Rust.

The following checks are the evidence required for this inventory and for each
future retirement review:

```text
node tools/check-rust-canaries.mjs
node tools/check-rust-flag-retirement.mjs
node tools/check-rust-contracts.mjs
```

The canary checker proves that the Rust full list and staging template agree
and that every Discord command leaf has a Rust ownership mapping. The retirement
checker compares the generated source inventory with this matrix and reports
missing, extra, or undocumented flags. Neither check performs a deploy.

## Ownership matrix

`staging` is the value in `.env.rust.staging.example`; `prod` is the intended
value in `.env.rust.prod.example` after the full-mode gate is approved. `class`
is the lifecycle classification: `release-gate` is not a feature toggle,
`staging-canary` is validated before promotion, and `production-default` is
enabled for the Rust full runtime. No full-runtime flag is classified as
legacy or staging-only; removing one would change the public surface.

| flag | owner in full | staging | prod | class | purpose | retirement guard / rollback |
| --- | --- | --- | --- | --- | --- | --- |
| RUST_RUNTIME_READY | Rust release gate | false | true | release-gate | permits the full-mode cutover gate | all functional rows green; revert to false and restart the previous image |
| RUST_REGISTER_COMMANDS_ENABLED | Rust command registrar | true | true | staging-canary | registers the Rust command set | command diff and registration canary; restore Node registration before disabling |
| RUST_AUTOCOMPLETE_ENABLED | Rust interaction gateway | true | true | production-default | serves autocomplete interactions | autocomplete probe and error-rate parity; re-enable Node handler |
| RUST_CORE_VOICE_ENABLED | Rust voice gateway | false | true | production-default | join, leave, TTS, skip, and voice controls | voice smoke plus latency/error parity; re-enable Node voice owner |
| RUST_QUEUE_ENABLED | Rust queue service | false | true | production-default | queue and queue-role behavior | queue replay test and backlog parity; restore Node queue path |
| RUST_PRONUNCIATION_ENABLED | Rust pronunciation service | false | true | production-default | pronunciation CRUD and lookup | contract and CRUD probes; restore Node pronunciation handlers |
| RUST_CONFIG_LANGUAGE_ENABLED | Rust config command | false | true | production-default | `/config language` | command probe and persisted-value parity; restore Node config handler |
| RUST_CONFIG_TOGGLES_ENABLED | Rust config command | false | true | production-default | boolean config toggles, including auto-join and streaks | toggle round-trip test; restore Node config handler |
| RUST_CONFIG_NUMERIC_ENABLED | Rust config command | false | true | production-default | numeric config validation | invalid/valid boundary probes; restore Node config handler |
| RUST_CONFIG_ROLE_ENABLED | Rust config command | false | true | production-default | role configuration | permission and persistence probes; restore Node config handler |
| RUST_CONFIG_DEFAULT_VOICE_ENABLED | Rust config command | false | true | production-default | default voice configuration | voice selection probe; restore Node config handler |
| RUST_CONFIG_CHANNEL_ENABLED | Rust config command | false | true | production-default | TTS-channel configuration | channel permission probe; restore Node config handler |
| RUST_CONFIG_QUEUE_ROLES_ENABLED | Rust config command | false | true | production-default | queue and priority-role configuration | role precedence probe; restore Node config handler |
| RUST_CONFIG_GREET_LANGUAGE_ENABLED | Rust config command | false | true | production-default | greet-language configuration | join-only greeting probe; restore Node greet/config handlers |
| RUST_CONFIG_BLOCKWORD_ENABLED | Rust config command | false | true | production-default | block-word configuration | add/remove and enforcement probe; restore Node config handler |
| RUST_CONFIG_SHOW_ENABLED | Rust config command | false | true | production-default | displays effective configuration | output contract probe; restore Node config handler |
| RUST_CONFIG_RESET_ENABLED | Rust config command | false | true | production-default | resets configuration | reset and persistence probe; restore Node config handler |
| RUST_UPTIME_ENABLED | Rust public command | false | true | production-default | `/uptime` | public command probe and response contract; restore Node public command |
| RUST_INVITE_ENABLED | Rust public command | false | true | production-default | `/invite` | public command probe and link contract; restore Node public command |
| RUST_HELP_ENABLED | Rust public command | false | true | production-default | `/help` | public command probe and localized output; restore Node public command |
| RUST_VOTE_ENABLED | Rust public command | false | true | production-default | `/vote` | public command probe and URL contract; restore Node public command |
| RUST_TOP_SPEAKERS_ENABLED | Rust public command | false | true | production-default | `/top-speakers` | fixture ranking probe; restore Node public command |
| RUST_BIRTHDAY_ENABLED | Rust public command | false | true | production-default | birthday commands | date and permission probes; restore Node birthday handlers |
| RUST_BOT_STATS_ENABLED | Rust public command | false | true | production-default | `/bot-stats` | metrics response probe; restore Node public command |
| RUST_SERVER_STATS_ENABLED | Rust public command | false | true | production-default | `/server-stats` | guild metrics probe; restore Node public command |
| RUST_STATS_ENABLED | Rust public command | false | true | production-default | `/stats` | metrics response probe; restore Node public command |
| RUST_PREMIUM_ENABLED | Rust premium command | false | true | production-default | premium status and entitlements | entitlement parity and billing smoke; restore Node premium owner |
| RUST_REDEEM_ENABLED | Rust redemption service | false | true | production-default | premium-code redemption | idempotency and audit probe; restore Node redemption owner |
| RUST_PRIVACY_ENABLED | Rust privacy service | false | true | production-default | privacy erase workflow | deletion/tombstone evidence; restore Node privacy owner |
| RUST_GAME_LIST_ENABLED | Rust game command | false | true | production-default | game list and catalog | catalog contract and response probe; restore Node game owner |
| RUST_GAME_SCORES_ENABLED | Rust game command | false | true | production-default | game leaderboard and stats | deterministic fixture probe; restore Node game owner |
| RUST_GAME_PLAY_ENABLED | Rust game command | false | true | production-default | game play and stop | round-trip gameplay probe; restore Node game owner |
| RUST_PUBLIC_COMMANDS_ENABLED | Rust public command bundle | false | true | production-default | shared public-command gate | all public leaves mapped and green; restore Node public bundle |
| RUST_TTS_FILE_ENABLED | Rust file-export service | false | true | production-default | file TTS export | file permission and download smoke; restore Node file exporter |
| RUST_TRANSCRIBE_MESSAGE_ENABLED | Rust transcription service | false | true | production-default | voice-message transcription | fixture accuracy and timeout probe; restore Node transcription owner |
| RUST_TRANSCRIBE_LIVE_ENABLED | Rust transcription service | false | true | production-default | live transcription | live-session probe and latency budget; restore Node live STT owner |
| RUST_TRANSCRIBE_CONTROL_ENABLED | Rust transcription service | false | true | production-default | transcription revoke/control | revoke authorization probe; restore Node control owner |
| RUST_SPEAK_CONTEXT_ENABLED | Rust context command | false | true | production-default | context-aware speak command | context response contract; restore Node context owner |
| RUST_VOICE_PREFERENCES_ENABLED | Rust voice preference service | false | true | production-default | voice preference commands | preference round-trip probe; restore Node voice owner |
| RUST_TRANSLATE_TEXT_ENABLED | Rust translation service | false | true | production-default | text translation commands | locale/translation contract; restore Node translation owner |
| RUST_TRANSLATE_CONTEXT_ENABLED | Rust translation service | false | true | production-default | context translation | context translation probe; restore Node translation owner |
| RUST_TRANSLATION_ADMIN_ENABLED | Rust translation admin service | false | true | production-default | translation administration | authorization and persistence probe; restore Node admin owner |
| RUST_TRANSLATION_PREFERENCES_ENABLED | Rust translation preference service | false | true | production-default | translation language/opt-out preferences | preference round-trip probe; restore Node preference owner |
| RUST_AUTOMATIC_TRANSLATION_ENABLED | Rust translation service | false | true | production-default | automatic translation | channel event and opt-out probe; restore Node translation owner |
| RUST_WELCOME_ENABLED | Rust welcome service | false | true | production-default | welcome messages | join event and duplicate suppression probe; restore Node welcome owner |
| RUST_MESSAGE_AUTOREAD_ENABLED | Rust voice gateway | false | true | production-default | automatic message readout | join/readout and opt-out probe; restore Node voice owner |
| RUST_RANDOMIZER_ENABLED | Rust voice gateway | false | true | production-default | randomizer command | deterministic seed/permission probe; restore Node voice owner |
| RUST_CAST_ENABLED | Rust voice gateway | false | true | production-default | cast command | cast transport smoke; restore Node voice owner |
| RUST_SETUP_ENABLED | Rust setup service | false | true | production-default | setup flow | setup idempotency probe; restore Node setup owner |
| RUST_OWNER_COMMANDS_ENABLED | Rust owner command service | false | true | production-default | owner-only commands | owner authorization probe; restore Node owner command path |
| RUST_BROWSER_API_ENABLED | Rust browser API | false | true | production-default | dashboard/browser HTTP API | authenticated health and API probe; restore Node API process |
| RUST_DASHBOARD_ENABLED | Rust dashboard API | false | true | production-default | dashboard routes | auth and route smoke; restore Node dashboard API |
| RUST_ADMIN_API_ENABLED | Rust admin API | false | true | production-default | admin routes | auth/audit smoke; restore Node admin API |

## Auxiliary `RUST_*` variables

These variables are operational configuration, not full-runtime cutover
canaries. They must not be removed as part of this matrix. Their lifecycle is
tracked separately because they have no Discord command ownership:

| variables | classification | rule |
| --- | --- | --- |
| `RUST_RUNTIME_MODE`, `RUST_COMMANDS_GUILD_ID`, `RUST_COMMANDS_STATE_PATH` | deployment control | retain while shadow/full rollback exists; validate in staging preflight |
| `RUST_PAYMENTS_ENABLED` | billing/deployment control | remains a separate Stripe safety switch; the Rust premium surface must stay fail-closed when it is false; rollback by disabling it and restoring the previous billing owner |
| `RUST_POSTGRES_MODE`, `RUST_POSTGRES_POOL_MAX`, `RUST_POSTGRES_IMPORT_SQLITE`, `RUST_POSTGRES_REPLICA_OUTBOX`, `RUST_POSTGRES_VOICE_READ_CACHE` | staging/replica-only | retain until the Postgres migration and rollback runbook are signed off |
| `RUST_VOICE_CACHE_DIR`, `RUST_TTS_FILE_CACHE_DIR`, `RUST_GTTS_CACHE_DIR`, `RUST_NEURAL_CACHE_DIR`, `RUST_GCLOUD_CACHE_DIR`, `RUST_KOKORO_CACHE_DIR` | runtime storage | retain while the corresponding cache backend is enabled |
| `RUST_ENV_FILE` | staging tooling | retain for staging preflight; never add it to production secrets |
| `RUST_BACKTRACE` | runtime diagnostic | Docker/runtime diagnostic only; never use it as a traffic or ownership switch |

## Deprecation sequence and sign-off

| phase/date | action | removal guard | rollback and sign-off |
| --- | --- | --- | --- |
| 2026-08-01--2026-08-15 | collect shadow/full canary evidence and command ownership output | `check-rust-canaries`, `check-rust-flag-retirement`, contract checks, and Plan 006 gateway tests are green | runtime owner records artifact IDs; no deletion |
| 2026-08-16--2026-09-15 | promote one surface at a time in a disposable staging guild, then observe production parity | two clean deploys, no ownership gap, no error/latency regression, and explicit rollback drill | runtime owner + Discord on-call approve each surface; keep Node fallback |
| 2026-09-16 or later | consider deleting a redundant flag only when its surface is permanently Rust-owned | zero Node-owned leaves, documented telemetry for 14 days, runbook updated, and product/security sign-off | rollback is the prior image plus Node owner; never remove `RUST_RUNTIME_READY` or controls before the final cutover review |

No flag is approved for deletion by this plan. An unresolved owner, missing
rollback path, or requirement for a live deploy is a STOP condition for the
retirement work.
