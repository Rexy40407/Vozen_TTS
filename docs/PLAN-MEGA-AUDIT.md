# Plano — Mega-auditoria e melhoria total do Vozen (bot TTS)

> Planeado em 2026-07-15. O bot está EM PRODUÇÃO.
>
> **FASE 0 CONCLUÍDA (2026-07-15).** A árvore suja (146 mod + 22 untracked) era trabalho
> anterior COERENTE por commitar (tradução PT→EN, kofi, entitlements, voice, testes),
> não lixo — provado pelos 4 gates verdes ANTES do commit. Verificado que todos os dados
> de runtime (`data.db`/`tts.db`/`audio-cache`/`voice-clones`/`logs`/`.env`) estão
> gitignored e que `docs/speech-data/` + `docs/eval/` são só dados linguísticos/templates
> (sem PII). Commitado como 1 snapshot honesto (`diogoshk3`, sem trailer). NÃO empurrado
> (o repo tem remote; push é decisão do dono).
>
> **BASELINE (commit deste snapshot):** `npm run build` = 0 · `npm run typecheck` = 0 ·
> `npx vitest run` = **1805 testes / 176 ficheiros, todos verdes** · `npm run lint` = 0.
> `git status` limpo.

## Objetivo

Elevar o Vozen ao nível "impecável": zero bugs conhecidos, zero falhas de segurança
conhecidas, 100% do código/comentários/docs de dev em inglês, repo sem lixo, features
polidas, e conformidade verificada (Discord, UE/RGPD, EUA, Ko-fi) — fechado por um
loop de verificação que só termina quando uma ronda completa não encontra problemas.

## Scope

### In
- Estabilização da working tree (triage + commits dos 167 ficheiros).
- Reconciliação do ciclo de auditoria anterior (`plans/`).
- Auditoria profunda multi-agente (deep): correção, segurança, performance, testes,
  tech debt, dependências, DX, docs.
- Tradução PT→EN de comentários/logs/docs de dev nos ~106 ficheiros em falta.
- Remoção de ficheiros repetidos/inúteis (lista aprovada primeiro; ver Riscos).
- Execução das correções e melhorias encontradas (TDD).
- Re-auditoria de compliance: Discord Dev Policy, RGPD/UE, EUA (COPPA/CCPA na medida
  aplicável), Ko-fi ToS — com PRIVACY.md/TERMS.md sincronizados com o código REAL.
- Loop final de verificação com agentes frescos até ronda limpa.

### Out
- Features novas (isto é polish/hardening, não roadmap).
- Reescritas arquiteturais grandes (só se um finding P1 o exigir).
- O painel/site do Vozen-helper (projeto irmão — já tratado noutra sessão).
- Tradução dos catálogos i18n virados ao utilizador (`src/i18n/locales` fica
  multilingue de propósito).
- Apagar dados de runtime: `data.db`, `tts.db`, `audio-cache/`, `voice-clones/`,
  `logs/` — INTOCÁVEIS.
- Deploy em produção (passo manual do dono no fim).

## Fases

### Fase 0 — Estabilizar a base
Deliverable: working tree limpa + baseline verde registada. Dep.: nenhuma.
- [ ] Rever o diff dos 167 ficheiros (o ciclo anterior fechou os planos 023–032 mas
  não commitou): separar trabalho legítimo / lixo acidental / artefactos gerados.
- [ ] Commitar em lotes lógicos com mensagens honestas; reverter o que não presta.
- [ ] Gates: `npm run build` + `npm run typecheck` + `npx vitest run` + `npm run lint`
  todos verdes; registar contagens como baseline.
- **Done:** `git status` limpo; 4 gates verdes; baseline anotada no topo deste plano.

### Fase 1 — Reconciliar o ciclo anterior
Deliverable: `plans/README.md` com o estado REAL. Dep.: Fase 0.
- [ ] Verificar cada plano DONE por amostragem (o código diz o que o plano diz?).
- [ ] Marcar stale/obsoletos; extrair o que ficou por fazer para a Fase 4.
- **Done:** tabela de `plans/README.md` bate certo com o código; zero planos "DONE"
  falsos.

### Fase 2 — Auditoria profunda (deep, multi-agente)
Deliverable: tabela de findings VETADOS com evidência (`file:line`), impacto,
esforço, risco. Dep.: Fase 0 (auditar árvore suja é inútil).
- [ ] Fan-out de agentes read-only por categoria (≤8): correctness, security,
  performance, test coverage, tech debt, dependências/migrações, DX, docs.
- [ ] Atenção especial: voice-clones (consentimento/dados), webhooks (vote/Ko-fi),
  premium/entitlements, sharding, supervisor, cache de áudio, jogos.
- [ ] Vetar CADA finding contra o código real; rejeitados ficam
  registados para não reaparecerem.
- **Done:** tabela final vetada, ordenada por leverage; zero findings sem evidência.

### Fase 3 — Inglês a 100% + limpeza de ficheiros
Deliverable: código todo em EN + repo sem lixo. Dep.: Fase 2 (a lista de "inúteis"
sai da auditoria; traduzir antes das correções evita churn duplo).
- [ ] Traduzir comentários/strings de dev/logs dos ~106 ficheiros PT→EN (NUNCA tocar
  em `src/i18n/locales` nem em texto virado ao utilizador).
- [ ] Compilar lista de candidatos a remoção (ex.: `coverage/` commitado?, `site-dist/`,
  `scratchpad/`, `commands-state.json`, benchmarks duplicados) → **apresentar a lista
  ao dono e só apagar após aprovação**; atualizar `.gitignore`.
- [ ] Gates verdes após cada lote.
- **Done:** grep de padrões PT em `src/`+`tests/`+docs de dev = 0 ocorrências (fora
  das exceções i18n); lista de remoções aprovada e aplicada; gates verdes.

### Fase 4 — Correções e melhorias
Deliverable: todos os findings aceites implementados. Dep.: Fases 2 e 3.
- [ ] Executar por prioridade (P1 segurança/correção → P2 → P3), com TDD: teste RED
  primeiro para cada bug.
- [ ] Melhorias de features (polish) tratadas como findings normais — nada entra sem
  critério de done verificável.
- [ ] Gates verdes após cada plano; commits pequenos e temáticos.
- **Done:** zero findings P1/P2 abertos; suite cresceu (novos testes); gates verdes.

### Fase 5 — Compliance (Discord · UE · EUA · Ko-fi)
Deliverable: matriz política → requisito → evidência no repo. Dep.: Fase 4 (auditar
compliance do código final, não do intermédio).
- [ ] Discord Developer ToS/Policy: recheck contra as hard rules do CONTRIBUTING.md
  (dados só para a função declarada, consent-first, sem DMs não solicitadas,
  price parity, gate das 100 guilds).
- [ ] RGPD/UE: voice-clones (consentimento explícito + revogação + retenção),
  caminhos de apagamento por comando, PRIVACY.md fiel ao código real.
- [ ] EUA: termos de idade mínima (13+/COPPA via Discord ToS), CCPA na medida
  aplicável (divulgação e apagamento já cobrem).
- [ ] Ko-fi ToS: o que o premium promete vs. o que a Ko-fi permite (recompensas
  digitais, reembolsos, descrição honesta); webhook de pagamento seguro.
- [ ] Atualizar PRIVACY.md/TERMS.md/site se a matriz revelar desvios.
- **Done:** matriz completa em `docs/COMPLIANCE-MATRIX.md`; cada linha tem evidência
  (ficheiro/commit) ou um fix aplicado.

### Fase 6 — Loop de verificação (o "double-check em loop")
Deliverable: certificado de ronda limpa. Dep.: Fases 4 e 5.
- [ ] Ronda: agentes FRESCOS (sem contexto das correções) re-auditam correção +
  segurança + compliance; tudo o que encontrarem volta à Fase 4.
- [ ] Critério de paragem: **uma ronda completa sem findings P1/P2 novos** e gates
  verdes → fim. (Findings P3 cosméticos ficam registados, não bloqueiam.)
- [ ] Máximo 4 rondas; se à 4.ª ainda houver P1/P2 novos, parar e reportar ao dono
  (sinal de problema estrutural, não de polish).
- **Done:** relatório final: rondas corridas, findings por ronda, estado dos gates,
  e a declaração explícita "ronda N encontrou 0 problemas acionáveis".

## Riscos

- **Os 167 ficheiros sujos são a maior incógnita.** Podem conter trabalho a meio
  (quebrado) do ciclo anterior. Resolver na Fase 0 é barato; ignorar contaminaria
  toda a auditoria. Não commitar às cegas — rever primeiro.
- **Apagar ficheiros é destrutivo.** Nenhuma remoção sem lista aprovada pelo dono
  (Fase 3). Dados de runtime estão explicitamente fora de alcance.
- **"Zero bugs" é assíntota, não destino.** O critério honesto é "uma ronda fresca
  sem P1/P2 novos", com teto de 4 rondas — senão o loop nunca fecha.
- **Tradução em massa pode partir strings.** Só comentários/logs/docs de dev; testes
  que asserem mensagens de log têm de ser atualizados em conjunto; nunca tocar nos
  locales.
- **O bot está em produção.** Nada aqui faz deploy; alterações de risco (supervisor,
  voice) precisam de testes extra antes do deploy manual do dono.
- **Compliance jurídica a sério não sai de um repo.** A matriz dá diligência técnica
  honesta; não substitui aconselhamento jurídico — e o plano di-lo sem fingir o
  contrário.

## MVP

Fim da **Fase 2**: árvore limpa, baseline verde e tabela de findings vetada — a partir
daí o dono já vê exatamente o que existe para corrigir e pode repriorizar. Tudo o que
se segue é execução com critérios fechados.

**Próxima ação concreta: Fase 0 — `git diff --stat` dos 167 ficheiros e
triage em lotes lógicos para commit/revert.**
