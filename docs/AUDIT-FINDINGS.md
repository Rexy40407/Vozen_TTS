# Vozen — Auditoria profunda (findings vetados)

> Fase 2 do `PLAN-MEGA-AUDIT.md`. 6 agentes read-only (correção TTS/voz · correção
> comandos/jogos · segurança · performance/leaks · cobertura/arquitetura · inglês/docs/
> ficheiros). Cada finding abaixo foi **vetado por leitura do código citado**. Baseline:
> build/typecheck/lint 0, 1805 testes verdes, `npm audit` 0 CVEs.

## Veredicto global

Código **sólido e bem defendido**: **0 P1**, segurança endurecida (0 findings de segurança
acionáveis em código), maps com eviction, timers `unref`'d, processos reapados. O trabalho
real concentra-se em: **2 bugs P2**, alguns **P3**, **tech-debt de refactor**, e — o item
dominante em volume — **~349/364 ficheiros com prosa PT** (o pedido "tudo em inglês").

## Bugs a corrigir (correção)

| ID | Sev | Ficheiro | Problema | Fix |
|---|---|---|---|---|
| BUG-1 | **P2** | `src/tts/gcloud.ts:195-206` | Race check-then-act no budget: débito depois do `await fetchSpeech`, sem reserva → 2 syntheses concorrentes do mesmo pass (partilhado entre guilds) excedem o teto. **$ real.** | Debitar/reservar ANTES do fetch; refund em falha. |
| BUG-6 | **P2** | `src/store/cache.ts:110-116` | `invalidateUser` omite `pronunciation_user` (que está em `USER_ERASE_TABLES`) → após `/privacy erase` pronúncias continuam em cache. **RGPD.** | Adicionar `pronunciation_user` ao `USER_KEYED` (+ opcional TTL). |
| BUG-3 | P3 | `src/voice/recorder.ts:195-204`, `transcriptionSession.ts:154-164` | Erro do decoder resolve a ronda sem `opus.destroy()` → leak de subscription. | Destruir opus no `finish`. |
| BUG-7 | P3 | `src/commands/index.ts:168-173` | Autocomplete de `language` do `/transcribe start` serve lista de piadas (TTS) em vez de Whisper (STT); `resolveTranscribeLang` sem whitelist. | Branch STT + whitelist de códigos Whisper. |
| BUG-8 | P3 | `src/games/wordChain.ts:148-172` | Estado do turno muda após `await ctx.send` → double-accept/skip/timer-race (leaderboard Premium). | Mutar `idx`/`announceTurn` ANTES do await. |
| BUG-5 | P3 | `src/voice/aloneWatcher.ts:89-94` | Re-check do timer omite `stayInCall` (inerte no default leaveMs=0). | Re-checar `stayInCall` no callback. |
| BUG-2 | P3 | `src/tts/circuitBreaker.ts:54-84` | Falhas contadas após `await` → não trava stampede inicial (só gtts/router opt-in). | Contar in-flight ou abrir cedo. Baixa prioridade. |

## Tech-debt / arquitetura

| ID | Sev | Ficheiro | Problema | Fix |
|---|---|---|---|---|
| DEBT-2 | P2 | `kofiWebhook.ts` (×4) + `vote.ts` | Coleta de body HTTP duplicada 5× com o guard de segurança HTTP-01 copy-pasted → drift security-relevant. | Helper único `collectBody(req,res,max)`. |
| DEBT-1 | P2 | `src/premium/kofiWebhook.ts` (757 l) | God-file: 5 superfícies HTTP (status/claim/dashboard/topgg/kofi) sob nome enganador. | Separar router por concern. |
| DEBT-3 | P3 | `commands/index.ts:36` ↔ `handlers/meta.ts:34` | Dep circular via barrel (`commandDefs`). | Importar de `./definitions` direto. |
| DEBT-5 | P3 | `src/commands/handlers/meta.ts` (613 l) | Grab-bag growth + money handlers (causa do DEBT-3). | Extrair `premiumAdmin`. |
| DEBT-4 | P3 | `piper.ts:90`, `whisperTranscriber.ts:37`, +7 | Config sprawl: 9 knobs via `process.env.*` fora do `AppConfig` (2 são resource-safety caps → deviam falhar rápido). | Centralizar em `AppConfig`. |
| PERF-1 | P3 | `src/tts/piper.ts:99-102` | Comentário "só o SPAWN é limitado" falso (permit cobre warm-pool). | Corrigir comentário / desacoplar. |
| PERF-2/3/4 | P3 | piper/cache/talkStats | Thrash de pool se working-set>maxWarm=3; I/O FS síncrono no hot-path; write SQLite por msg. | Tuning/config (não bugs). |

## Cobertura

- **COV-1** (P3): loop de rejoin 24/7 no boot (`src/index.ts:486-508`) não testado (fn pura
  `planRejoin` é testada, o loop imperativo não). Feature paga. Fix: extrair policy testável.
- Restante das paths money/security/voice: cobertura forte e verificada.

## Inglês (o item dominante) — ~349/364 ficheiros com PT

- tests/ 171 · src/games 29 · tts 23 · store 23 · commands 16 · voice 13 · premium 7 · bot 7 ·
  language 6 · textCleaning 4 · moderation 3 · scripts 3 · tools 24 · docs/ 43 de 45 .md.
- Densidade top: `messageHandler.ts`(97), `voice.ts`(75), `index.ts`(74), `gtts.ts`(72),
  `kofiWebhook.ts`(68), `config/index.ts`(68).
- **CAVEAT (crítico):** traduzir SÓ comentários/logs/descrições de teste. NÃO tocar em dados
  PT user-facing (`src/content/**`, `src/games/content/**`, `language/greetings+spokenPhrases`),
  nem em strings de INPUT dos testes (`'João'`, `'olá'`), nem em `src/i18n/**` (multilingue de
  propósito). 18 ficheiros já limpos (skip).

## Remoções (destrutivo — precisa de OK do dono)

- **RM-1** (a única real): `tools/register-guild.ts` é duplicado de `tools/register-guild.cjs`
  (o `.cjs` é canónico: EN, referido no eslint/clear-guild). → remover o `.ts`.
- **RM-2**: tabela `user_abbreviation` half-orphaned (created+read+delete mas sem write path
  nem handler) — liga-se ao comando fantasma `/voice abbrev`. Reconciliar (não apagar às cegas).
- A árvore está **limpa** — não há build output committado, orfãos, nem assets velhos.

## Docs desatualizados

- DOC-1: README cita logs PT obsoletos (código diz EN).
- DOC-2: README usa nomes de opção PT que não existem (`canal`→`channel`, `ativo`→`active`,
  `palavra`→`word`).
- DOC-3: `/voice abbrev` documentado (PRIVACY.md:22, ARCHITECTURE.md:121/441, i18n:726) mas
  **não existe** → feature unreachable. Decidir: implementar ou remover das docs+i18n+schema.
- DOC-4: ARCHITECTURE.md:441 cita `/config pronunciation` (removido → `/server-pronunciation`).

## Operacional (segurança — não é código)

- Ko-fi claim brute-force depende da entropia do tx-id (confirmar com Ko-fi).
- XFF rate-limit assume topologia single-proxy loopback (manter no deploy).
- `TOPGG_WEBHOOK_ALLOW_INSECURE=true` é footgun — nunca em produção.
