# Implementation Plans

Generated from a full audit of the repo on 2026-07-07 at
commit `fb7f916` (4 parallel category audits → 19 vetted findings → 15 plans).
Execute in the order below unless dependencies say otherwise. Each executor:
read the plan fully before starting, honor its STOP conditions, run every
verification command, and update your row when done.

Repo verification baseline at planning time: `npm run build` (tsc) exit 0;
`npx vitest run` → 114 files / **1298 tests, all passing**.

## Execution order & status

| Plan | Title                                                                                       | Priority | Effort | Depends on    | Status       |
| ---- | ------------------------------------------------------------------------------------------- | -------- | ------ | ------------- | ------------ |
| 001  | Clone sidecar warmup deadline (wedged sidecar can stall a guild's TTS)                      | P1       | S      | —             | DONE         |
| 002  | Voice soft-recovery: handle the losing `entersState` rejection                              | P1       | S      | —             | DONE         |
| 003  | `/game play`: deferReply before the thread-creation REST call                               | P1       | S      | —             | DONE         |
| 004  | Security hardening trio (vote webhook secret · gate guild `/redeem` · scrub error webhook)  | P1       | S      | 003*          | DONE         |
| 005  | Typecheck the test suite + `engines` field                                                  | P1       | S      | —             | DONE         |
| 007  | Pin the Python clone-sidecar dependencies                                                   | P2       | S      | —             | DONE         |
| 008  | AudioCache: size counter instead of per-synthesis directory scan                            | P2       | S      | —             | DONE         |
| 009  | gTTS: bounded-concurrency chunk fetch (cap 3)                                               | P2       | S-M    | —             | DONE         |
| 010  | Hot-path store cache (~10 SQLite reads/message → memory)                                    | P1       | M      | —             | DONE         |
| 011  | Supervisor (`start-prod.mjs`) tests via extracted pure policy                               | P2       | M      | 005*          | DONE         |
| 012  | `createVoiceSession` tests (onIdle identity guard)                                          | P2       | M      | —             | DONE         |
| 013  | Lint/format toolchain (ESLint flat + Prettier + editorconfig + CI)                          | P2       | M      | —             | DONE         |
| 014  | `guild_config` descriptor-driven store (kill the 10-edit lockstep)                          | P2       | M      | 010           | DONE         |
| 015  | Split `commands/index.ts` (2821 lines → handler modules)                                    | P3       | L      | 003, 004, 013 | DONE         |
| 016  | Hybrid engine Phase 2 — Kokoro (kokoro-onnx) as opt-in per-user engine (gTTS stays default) | P2       | L      | 015           | DONE         |
| 017  | Anti-spam de leitura (toggle por guild) + cooldown 5 min da saudação (pedido do Diogo)      | P2       | M      | —             | DONE         |
| 018  | Site "Hear it": 5 línguas (en/es/fr/it/pt) audíveis nos 3 motores — fora de/ja               | P3       | S-M    | —             | DONE         |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

`*` = soft dependency (same-file merge friction or tooling interplay), not a hard blocker.

## Dependency notes

- **004 after 003**: both edit `src/commands/index.ts` in different handlers; in-order execution avoids textual merge friction.
- **011 after 005**: plan 011 adds a `.d.mts` declaration specifically so plan 005's test-typecheck stays green; landing 005 first lets 011 verify against it.
- **014 after 010**: the descriptor refactor must preserve the cache invalidation hooks 010 installs in `setGuildConfig`.
- **015 last**: it moves the code that 003 and 004 edit, and should land after 013 so moved files are formatted exactly once.
- **007 is machine-bound**: its step 1 reads exact versions out of the known-good venv (`tools/clone-venv/`) on the maintainer's machine — STOP applies elsewhere.
- Everything else is independent; 001/002/005/006/008/009/010/012 can be executed in any order or in parallel worktrees.

## Findings considered and rejected

- **[BUG-04] piperPool per-utterance timeout armed at enqueue, not head-of-line** — real timer-semantics deviation, but unreachable under default config (global semaphore bounds concurrency; 15s timeout vs ~0.2s/utterance). Revisit only if `PIPER_MAX_CONCURRENCY`/warm-voices get tuned up.
- **[TEST-03] Test `index.ts` post-login wiring** — requires refactoring the composition root's top-level `main()` execution (MED risk) for modest gain; the smoke test already pins the dependency montage.
- **"AudioCache grows unbounded"** — disproven: LRU eviction with a 500-file cap exists (`cache.ts:127-172`).
- **"Games re-implement the QuizGame base"** — disproven: 7 games extend `QuizGame`; the direct implementers differ by genuine game shape.

## Direction findings (decisions for the maintainer — not planned)

- **Activate Discord Premium Apps**: entitlement sync is shipped but inert (no `PREMIUM_*_SKU_ID`); the site already sells €3.99. Remaining work is external (portal SKUs, verification gates), not code.
- **Kokoro engine (backlog task #60)**: free-voice quality is the product differentiator. Effort L. → **Promoted to plan 016** (runtime `kokoro-onnx`, OPT-IN per-user engine — gTTS stays the default; decisions locked with the maintainer). **Phase 0 spike DONE**: kokoro-onnx 0.5.0 runs on CPU, pt-BR works without a system espeak-ng (bundled), RTF ≈ 0.25, 1.1 s load — technical bar met; pending the operator's voice-quality confirmation.
- **24/7 in-call mode**: sold on the site's Premium card as "coming soon" with zero code behind it. Either build it (M) or remove it from the card — selling vapor is a trust risk.

## Note on plan 004 (product decision embedded)

Plan 004 gates **guild**-kind `/redeem` codes behind `ManageGuild` (user/Plus codes stay open). That was the audit's safe default — if the intended UX is "any member can redeem a guild code", drop that step of plan 004 and mark the SEC-02 finding REJECTED here instead.

## 2.ª auditoria — 2026-07-09 (executada DIRETAMENTE, sem ficheiros de plano)

Nova auditoria @ commit `8abbf1e` (4 áreas em paralelo → 20 achados
vetados). O Diogo pediu execução direta. Os 7 de maior
alavancagem foram feitos e verificados nesta sessão:

| # | Achado | Categoria | Commit |
| --- | --- | --- | --- |
| 019 | CI vermelho desde `449cf88` (prettier em `perUserRouter.test.ts`) | dx | `129a5cc` |
| 020 | Webhook Ko-fi sem idempotência (retry = premium a dobrar) → ledger `kofi_transaction` | bug/security | `bf27ac7` |
| 022 | Hardening da API do dinheiro (timingSafeEqual · XFF rightmost · bind loopback · fetch timeout) | security | `7c24ebd` |
| 025 | Testes do POST Ko-fi (401/400/413) + gate Free/Premium do `/pronunciation` | tests | `90eefcc` |
| 021 | `Restart=always` no `vozen.service` (kill ao leaf deixava o bot DOWN) | bug/ops | `956a628` |
| 023 | Node `>=22.12` + gitignore de runtime + `.env.example` completo + ARCHITECTURE | dx/docs | `0f5436a` |
| 024 | Auto-deploy do bot (`deploy-bot.yml` + deploy key + secrets) — testado ao vivo | dx/ci | `6269d2d` |

Verificação: 1449 testes verdes, CI verde (reposto), tudo deployado no VPS via o novo
auto-deploy. **Não planeados** (decisão do maintainer): "24/7 in-call" vendido sem código
(construir M ou tirar do cartão) · Premium Apps do Discord inertes (falta config no portal).
**Não feitos por baixa alavancagem**: PERF-01 (i18n 10 línguas — ganho modesto pós-gzip; só
falta `defer` nos scripts) · TEST-05 (extrair `esc` do site) · BUG-03 (buffer dos sidecars
não-reset — degradação limitada, com fallback) · DEBT-02 (split do array de builders em
`commands/index.ts`) · DEP-02 (lag de versões — nada urgente).

## Follow-up — 2026-07-09 (feature 24/7 + limpar os "não feitos")

O Diogo pediu para fechar tudo o que ficou de fora. Resolvido em 5 commits diretos:

| Item | O que | Commit |
| --- | --- | --- |
| 24/7 in-call | AloneWatcher ganha gate `isPremium`: guilds Premium ficam na call mesmo sozinhas. Ligado via `isGuildPremium`. +4 testes. | `0ecf9d5` |
| Copy honesto | Site deixa de vender "coming soon"/"on the way": `price.pro.3` + FAQ nas 10 línguas passam à garantia real ("fica no canal mesmo quando esvazia"). i18n v10→v11 + `defer` (PERF-01). | `0ff81f6` |
| BUG-03 | `teardown()` do kokoro+clone limpa `this.buffer` (bytes parciais colavam-se à 1.ª linha do respawn → JSON.parse partido). | `3e2b501` |
| DEBT-02 | `commandDefsRaw`/`commandDefs`/`ownerCommandDefs` → `commands/definitions.ts` (index.ts 1066→~300 linhas), re-exportados. | `9a14a16` |
| TEST-05 | Teste read-and-eval do `esc()` anti-XSS a partir da fonte real do site (sem tocar no load). +5 testes. | `8a94a97` |

Decisão sobre o 24/7: o gate dá "não sai quando fica sozinho". A persistência através de
restarts (guardar canal + rejoin no `ClientReady`) NÃO foi construída — mete-se no boot path
e não estava no âmbito; o copy do site foi acertado à garantia real em vez de prometer isso.
Fica como follow-up opcional se se quiser o "24/7 literal através de deploys".

Verificação: 1458 testes verdes, CI verde, site (pages) + bot (VPS `8a94a97`) deployados pelos
auto-deploys. **Premium Apps do Discord** continua inerte (falta config no Developer Portal —
não é código, só o Diogo pode).

## Follow-up 2 — 2026-07-10 (persistência real do 24/7)

Fechado o "24/7 literal através de deploys" que ficou como opcional: a call de servidores
Premium agora **sobrevive a restarts/deploys** (as ligações de voz morrem no encerramento —
antes o bot só voltava reativamente). Design validado com o advisor (o bloqueio era: confirmar
que o `shutdown.ts` NÃO passa pelos sítios de esquecer — confirmado, só faz `player.destroy()`).

- Tabela `voice_presence` (canal por guild) + store `voicePresence.ts`.
- Escrita gated a Premium em `createVoiceSession` (best-effort); esquecer só no `/leave` e
  `guildDelete` (não no `removePlayer`/`shutdown`) → a linha sobrevive ao deploy.
- `voice/rejoin.ts` (`planRejoin`, puro): Premium+canal-pronto → repor; não-Premium/canal-morto
  → esquecer; sem-permissões → mantém e tenta no próximo arranque. Wiring no `ClientReady`.
- +9 testes (store round-trip + política). Commit `b033337`. Suite 1467 verde.

**Premium Apps** continua a ser a única coisa que não é código — guia entregue ao Diogo (criar
SKUs no Developer Portal pós-verificação → colar `PREMIUM_GUILD_SKU_ID`/`PREMIUM_USER_SKU_ID`
no `.env` do VPS; o `entitlementSync` já os consome).

---

## 3.ª auditoria — 2026-07-14 (STT + varredura pós-Vaga 5)

Nova auditoria @ commit `965b15b` (4 áreas em paralelo: correctness,
security, perf+debt+deps, tests+DX+docs+direction → 22 achados vetados à mão). Foco extra
no código do **STT** (`/transcribe`) shipado a 2026-07-13. Estes são **planos**, não execução
direta — para execução futura sem contexto desta sessão. Baseline de verificação:
`npm run build` exit 0; `npx vitest run` → **1714 testes verdes**.

| Plan | Título | Prio | Effort | Risk | Depende de | Status |
| ---- | ------ | ---- | ------ | ---- | ---------- | ------ |
| 019  | Lifecycle do `/transcribe`: teardown ao sair da call · corrida no start · selfMute · nomes de tmp · guard de exit dos sidecars | P1 | M | LOW | — | **DONE** (`7569c78`) |
| 020  | AudioCache: índice LRU em memória (elimina o readdir+stat de ~500 ficheiros em cada miss) | P2 | S | LOW | — | **DONE** (`852e98c`+`ff321a8`) |
| 021  | Endurecer o claim Ko-fi por email → **Opção A** (só código do recibo; email já não é prova de posse) | P1 | M | MED | — | **DONE** (`844cce0`+`32a3aef`) |
| 022  | Doc-sync (comando de revoke errado na PRIVACY · README `npm start` · ARCHITECTURE stale) + script `check` | P2 | S | LOW | — | **DONE** (`81deb66`) |

**Execução (2026-07-14):** os 4 planos foram executados em worktrees
isolados e revistos como tech-lead (re-corri done-criteria, âmbito, li
os diffs + testes). 019: 5 testes de caracterização novos (invariante de privacidade: rejoin
selfDeaf:true + speaking.off + dispose no stop; corrida do start fechada por Set+finally).
020: LRU em memória, API pública intacta, 3 testes defensivos obsoletos reescritos. 021: via
tx-id intocada byte-a-byte, ramo email → `use_receipt_code` sem tocar na BD, copy nos 10
idiomas. 022: docs corrigidos + script `check`. **Suite final na main: 1719 testes verdes.**
Achado colateral: `tests/wordChain.test.ts` é flaky sob carga de CPU (passa na main/CI, falha
em worktrees sob contenção) — task à parte, não bloqueia.

**Ordem sugerida**: 019 primeiro (P1, código mais novo, leak em produção 24/7). 022 é trivial e
independente (pode ir em paralelo). 020 independente. 021 é P1 mas tem Step 0 de decisão do
maintainer (STOP antes de mudar comportamento do dinheiro) — arrancar mas não fechar sem OK.
Nenhum depende de outro (ficheiros disjuntos).

### Achados NÃO planeados nesta ronda (registados p/ não re-auditar)

- **[DEBT-01] Dedup do lifecycle dos 3 sidecars** (clone/kokoro/whisper ~150 linhas em triplicado):
  real e HIGH-confidence, mas MED-risk (caminho crítico da fiabilidade "cai sempre na voz normal")
  e effort M sem ganho funcional — refactor puro. Vale mais **depois** do 019 (que já toca os 3 no
  guard de exit). Candidato a plano próprio quando houver apetite; não agora.
- **[PERF-02] STT: `writeFileSync` ~1MB + ffmpeg spawn por utterance** — real (event loop nos 2 vCPU),
  effort M, mas MED-risk (downsample à mão muda o áudio p/ o Whisper — precisa de spot-check de
  precisão). Adiado: o filtro anti-alucinação e o `--lang` já estabilizaram a qualidade; medir o
  custo real de CPU sob carga antes de reescrever. Folded-in candidate do 019 se sobrar tempo.
- **[DEBT-02] Dedup do RMS/voiced por-frame** (recorder vs utteranceCollector, `rmsOf` idêntico):
  effort S, mas baixo ganho; boa "boy-scout" a fazer quando alguém tocar nesses ficheiros.
- **[TESTS-02] `start-prod.mjs` lock/sinais não testados**: real mas genuinamente território de
  orquestração (EADDRINUSE, spawn real); a policy pura já está testada. Not-now defensável — o
  próprio auditor deu MED e sugeriu "cobertura por ops".
- **[TESTS-03] extrair `readTokenFromHash`/`randState` do site p/ teste** — LOW-MED prioridade; a
  verificação por browser (by-design) cobre o resto. Micro.
- **[SECURITY-02] Autz do dashboard em cache 60s por token** — janela curta, escopo limitado
  (config TTS, não dados sensíveis), provável tradeoff de perf intencional. Vale **documentar** o
  TTL como decisão (ou invalidar no `GuildDelete`), não um plano só por si. Registar e seguir.
- **[DEPS-01] franc 5→6** — ESM-only contra build CommonJS; migração L p/ dependência que funciona.
  Verdict: **não vale agora** — revisitar se/quando o projeto migrar p/ ESM, ou se franc 5 tiver CVE.
- **discord.js/@discordjs/voice "major lag"**: falso — estão na versão corrente do major atual.

### Achados de DIREÇÃO (decisões do maintainer — não planeados como bugs)

- **[DIRECTION-01] Dashboard "Fase 3b": escrever canal-TTS + voz-default** (`dashboardApi.ts`
  `DASHBOARD_FIELDS` tem 9 toggles + maxChars/rate/locale mas NÃO `tts_channel_id`/`default_voice`).
  O `PLAN-VAGA5-FEATURES.md` marca a Fase 3 "✅ COMPLETA" mas o critério de sucesso ("mudar a voz
  default pelo dashboard") está por cumprir. É a maior alavanca da superfície web e a arquitetura
  já a suporta (`setGuildConfig` trata os campos, autz/whitelist/cache provados). **Efeito M**
  (spike da UX do picker de voz + validação). — Foi a frente que o Diogo tinha em aberto ("seletores
  de canal/voz") antes do STT. Se disser sim, vira plano/spec próprio.
- **[DIRECTION-02] STT: apagar transcrições postadas ao revogar consentimento** — decisão
  conscientemente adiada (`PLAN-VAGA5-FEATURES.md:104` deixou "apagar OU documentar"; escolheu-se
  documentar). Enhancement de uma decisão, não um defeito: "apaga as minhas transcrições" é
  expectativa natural e diferenciador. Custo M + tabela nova (rot-guard/PRIVACY). Opção, não bug.

## Auditoria de segurança DEEP — 2026-07-14 (commit `f1a1ac1`)

Auditoria profunda de segurança a pedido do Diogo ("research intensa na proteção do bot"), **planeamento
only**. 8 áreas read-only em paralelo (superfície HTTP · segredos/logs ·
injeção SQL/shell/path · abuso/DoS · dados/privacidade · Discord ToS/conta · ops/deploy ·
dependências) → ~26 achados vetados → **10 planos (023-032)**. Baseline: 1731 testes verdes.

> **EXECUTADO 2026-07-14** (o Diogo pediu "resolve isso tudo sem exceção"): os **10 planos
> foram implementados** (TDD, cada um verificado). Além disso, ao endurecer o deploy (027) com
> gate `npx vitest run`, descobriu-se que a "flaky" `wordChain.test.ts` era afinal um **bug de
> produção CRLF** no `dict.ts` (`.split('\n')` → `.split(/\r?\n/)`) — corrigido. Suite final:
> **174 ficheiros / 1788 testes, `npm run check` verde**. Follow-ups: (a) `/game stop` ficou
> só-ManageGuild — falta `starterId` no Session para o iniciador também poder parar (metade do
> ABUSE-04); (b) hashes dos sidecars (DEP-03); (c) opcional `.gitattributes *.txt eol=lf`.

**Resultado macro:** a **injeção está LIMPA** (SQL parametrizado; sidecars com `spawn` array-args +
stdin, sem `shell:true`; paths por hash/allowlist/`isSafeModelName`) e a **superfície HTTP está bem
endurecida** (authz do dashboard sem IDOR/mass-assignment, rota `/webhook/topgg` na ordem certa,
claim sem oráculo, CSRF N/A, health sem leak). O peso está em **compliance/privacidade, config
fail-safe, pipeline de deploy e exaustão de recursos**.

| Plan | Título | Prio | Esf | Depende | Estado |
| ---- | ------ | ---- | --- | ------- | ------ |
| 023  | Default global `allowedMentions:{parse:[]}` no Client (mass-mention/ban-risk, DISCORD-01) | P1 | S | — | DONE |
| 024  | Guards de config fail-safe (segredo presente-mas-vazio · CLONE_KEY · listener redundante — SECRET-01/02) | P1 | S | — | DONE |
| 025  | Completude do data-lifecycle: alargar rot-guard + apagar/disclosar `kofi_supporter` & `gcloud_usage` (DATA-01/02/03) | P1 | S-M | — | DONE |
| 026  | Reconciliar `PRIVACY.md` §1 (schema real) + §2.4 (áudio STT) (DATA-04/05) | P2 | M | 025 (coord. `gcloud_usage`) | DONE |
| 027  | Endurecer o pipeline de deploy: gate de testes + `set -e` + triggers `scripts/**`/`tools/**` (OPS-01/02/03) | P1 | S | — | DONE |
| 028  | Rotação de logs do supervisor a meio-do-run (evitar disco cheio → outage) (OPS-04) | P1 | S | — | DONE |
| 029  | Cap global de concorrência STT + teardown de erro do `/transcribe start` (ABUSE-01, DISCORD-02) | P1 | S-M | — | DONE |
| 030  | Fechar lacunas de rate-limit (`/voice preview` · throttle do feedback · gate `/game`) (ABUSE-03/02/04) | P2 | S | — | DONE |
| 031  | Encolher superfície de install-scripts + pinar `faster-whisper` (DEP-01/02/03) | P2 | S-M | 027 (mesmo `deploy-bot.yml`) | DONE |
| 032  | Bundle de hardening: scrubber · aborted-guard · sweep de `.wav` órfão · `.env.example` · decisão da intent (SECRET-03, HTTP-01, DATA-06, SECRET-04, DISCORD-03) | P3 | S (C=M) | — | DONE |

**Ordem sugerida:** os P1 primeiro e são quase todos independentes — 023, 024, 027, 028 são
isolados e de verificação limpa (bons para paralelo). 025 antes de 026 (coordenam o `gcloud_usage`).
031 depois/junto de 027 (ambos editam `deploy-bot.yml`). 029 é o mais delicado (contador simétrico +
invariante de re-ensurdecer). 032 são 5 itens independentes; o item C (sweep biométrico) é MED-risco
(testar contra `sample_path`, não heurística de nome).

### Áreas LIMPAS (negativos bem sustentados — não são planos)

- **Injeção** (SQL/shell/path/eval): sem vulnerabilidades. `escapeRegExp`, allowlists `as const`,
  `spawn` array-only, stdin-isolation, hash SHA-1 nos paths, `isSafeModelName`, guard `/^\d{5,25}$/`.
- **HTTP**: authz do dashboard (MANAGE_GUILD server-side + whitelist de patch), `/api/me/premium`
  por token, claim sem oráculo, rate-limit/body-caps/timeouts nos 3 servidores.
- **`npm audit`**: 0 CVEs (os `overrides` cobrem undici/trim/tar; opus DoS aceite).
- **DMs não solicitadas**: nenhuma. Token nunca logado. Idempotência Ko-fi + XFF-last + timingSafeEqual OK.

### Considerados e rejeitados / não-agora

- **franc/trim ReDoS**: validado como NÃO-problema — o `override trim@0.0.3` chega, franc está off
  por defeito (`MULTILINGUAL_SEGMENTS`) e, quando on, só vê input com cap (≤2000). Override
  load-bearing e suficiente.
- **`vote_reward` cresce sem limite**: upsert 1 linha/votante, apagável por `/privacy erase` —
  negligível a qualquer escala real.
- **Encriptação em repouso (SQLCipher)**: decisão já adiada (COMPL·5); o plano 024 só AVISA quando
  `CLONE_KEY` falta, não muda o comportamento.

### Achado de DIREÇÃO (maintainer — não planeado)

- **[OPS-05] Sharding inerte + launcher não-supervisionado**: `BOT_SHARDS` é no-op no caminho
  supervisionado; o único launcher sharded (`shard.js`) ignora o single-instance lock, o backoff e a
  rotação de logs. Não fazer agora (single-process aguenta a escala atual). **Pré-escala** (~2500
  guilds, quando o Discord força sharding): passar o `shard.js` pelo supervisor OU portar o lock/
  backoff/rotação para o launcher sharded. Efeito L.

---

## 4.ª auditoria — 2026-07-16 (review completo) — PLANO ÚNICO

Nova auditoria @ commit `407503c` + refactor Components V2 por commitar
(verificado verde: `npm run check` exit 0 na árvore suja). 4 auditores paralelos
(correção · segurança · performance · dívida/testes/docs) → findings vetados à mão
contra o código citado. **Segurança: LIMPA (zero HIGH/MED).**

**Plano consolidado: [`033-full-review-fixes-and-upgrades.md`](033-full-review-fixes-and-upgrades.md)** — Status: **~90% DONE** (reconciliado na 5.ª auditoria, ver secção abaixo)

| Secção | Conteúdo | Prio |
| --- | --- | --- |
| P0 | Aterrar refactor V2 · deploy · Ko-fi Send Test/anual [Diogo] | P0 |
| P1 (B1-B8) | clone↔transcribe exclusão mútua · consentTimeout · botão Stop público · catch do painel · ENGINE_LABELS · deploy gate=check · pragma synchronous=NORMAL · evict oldest-first no cache | P1 |
| P2 | Opus fast-path (ffmpeg por playback) · TTL premium/gcloud · thresholds de cobertura honestos · política cards/embeds · bundle de higiene · topSpeakers SQL | P2 |
| P3 | splits voice.ts/kofiWebhook.ts · isPremiumContext · ARCHITECTURE sync · regra English-only | P3 |
| F | localização de slash-commands (catalog→Discord) · dashboard 3b (canal+voz) · i18n painel×33 + dash.* do site · STT apagar transcrições no revoke | dir. |

Não-planeados registados no próprio plano (SEC-01/02/04 by-design/LOW, PERF-06 por
verificar, PERF-07/TEST-03 dobrados na vaga de refactor).

---

## 5.ª auditoria — 2026-07-18

Nova auditoria a pedido do Diogo, com **3 áreas** em paralelo
(consola de admin · reconciliar 033 + código da sessão · varredura ampla),
cada achado **vetado contra a fonte** e depois implementado com TDD. Baseline:
`npm run check` verde, 2004 testes → **2009+** no fim.

**Reconciliação do plano 033** (estava marcado "TODO", mas ~90% executado em sessões anteriores):
P0.1-P0.3 DONE (`05f3ab4`/`73badd5`), P0.4 externo (Diogo/Ko-fi), **B1/B2/B4/B5/B6/B8 DONE**
(`b683744`/`73badd5`), **B7 DONE-por-caracterização** (WAL já dá `synchronous=NORMAL`, provado em
`tests/storeDb.test.ts` — o pragma explícito é redundante; um auditor reportou-o como aberto, **rejeitado**
na vetação), P2.3/P2.4/P2.5 DONE (`1669816`), P2.1/P2.2 REJECTED (medidos in-plan). **B3 agora DONE**
(nesta ronda). Abertos e registados abaixo (D1/D2/D3 splits, P2.6 SQL, D4/D5 docs, F1/F2/F4 direção).
Planos **034-037 DONE** (claim copy, no-auto-activation, claim-help modal, consola de admin) — o índice
não os tinha em linha; ficam registados aqui.

### Executados nesta ronda (TDD, vetados, verde)

| # | Achado | Cat | Commit |
| --- | --- | --- | --- |
| BUG-01 | Rotas admin sem try/catch → um erro de BD (disco cheio/IO) escapava a `uncaughtException` → `exit(1)` e derrubava TODAS as sessões de voz. Envolvido → 500 limpo. | correção | `15ff017` |
| SEC-01 | `revoke()` saltava a validação de snowflake do `grant()` e logava o id cru (log-forging). Reusa `validId`. | segurança | `15ff017` |
| SEC-02 | Sem guarda de força no `ADMIN_SESSION_SECRET`; avisa no arranque se < 32 chars (precedente do plano 024). | segurança | `15ff017` |
| DX-01 | `src/tts/cache.ts` tinha bytes NUL literais → o ripgrep tratava o ficheiro como binário e ignorava-o nas pesquisas. Escape ` ` (valor idêntico). | dx | `15ff017` |
| I18N-01 | As 33 traduções de `join.joinedAutoread` perdiam o `{readChannel}` que en/pt têm → utilizadores não-en/pt sem ponteiro para o canal. Menção clicável + teste de paridade. | i18n | `15ff017` |
| B3 | Botão "Stop" da gravação de clone estava no efémero do invocador → o alvo (quem é gravado) não o via. Movido para um cartão PÚBLICO, apagado no `finally`. Invariante de re-ensurdecer intacto. | correção/consent | `a9ca723` |
| DOCS-01 | Este índice estava desatualizado (033 "TODO", 034-037 sem linha) → reconciliado. | docs | (esta secção) |

### Deferidos como PLANOS (refactors puros — para um passe focado, não à pressa no fim desta ronda)

- **[DEBT-03] `BoundedMap` partilhado → [`038-boundedmap-utility.md`](038-boundedmap-utility.md)**: o idioma de mapa-limitado
  está escrito à mão ~14× em 2 sabores; o sabor "wipe" regride sozinho (B8 corrigiu 1 sítio, `claimHelp.ts` reintroduziu-o
  no dia seguinte). Efeito: seguro de convergência (não perf). Migração mecânica com testes por sítio.
- **[DEBT-04] Split do `kofiWebhook.ts` (1235 linhas) → [`039-split-kofiwebhook.md`](039-split-kofiwebhook.md)**: cresceu 61%
  em 48h e é hoje o único ficheiro que junta o caminho do dinheiro E o wiring de auth do owner. Revisita o D2 diferido (o
  ganho dobrou). **MED-risk (money path)** — merece o seu próprio passe com gate + review, não o fim de uma ronda grande.

### Áreas verificadas e LIMPAS (não são planos)

Sessão auth/HMAC/CORS/rate-limit da consola (fortes, pinados), caminho quente de mensagens (tudo em `cached()`),
`talkStats` (P2.6 defer mantém-se), deps (sem lag com custo real), injeção (limpa). Direção F1 (localização dos
nomes dos slash-commands), F2 (dashboard 3b canal+voz), F4 (apagar transcrições no revoke) e DIRECTION-03 (pedidos
de claim-help na consola) continuam decisões do maintainer.
