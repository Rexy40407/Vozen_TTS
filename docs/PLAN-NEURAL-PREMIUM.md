# Plano — Motor Google Cloud TTS (Standard) como perk Premium (upgrade #2)

Escrito a 2026-07-11. **Decisão do Diogo (2026-07-11): o motor pago é o
Google Cloud TTS tier STANDARD** — substitui a ideia original OpenAI (este ficheiro
foi reescrito; o `NeuralEngine` OpenAI existente fica como está, dormente).
Execução após "executa" do Diogo.

## Objetivo

Adicionar um **4º motor por-utilizador** (`/voice set engine`) que usa a API oficial
Google Cloud Text-to-Speech com vozes **Standard** (Male/Female), **exclusivo de quem
tem Vozen Plus ou Premium do servidor**, com fallback para o gTTS e salvaguardas de
custo. O valor premium vs o gTTS grátis: API oficial estável (sem bloqueios/429 do
endpoint não-oficial), escolha de género de voz, e latência/fiabilidade consistentes.

**Economia:** $4/1M chars, com **free tier de 4M chars/mês (permanente)**. Allowances
FINAIS decididos pelo Diogo (2026-07-11): **Plus 100k chars/MÊS por pessoa; Premium
400k chars/MÊS por passe de 3 servidores; 1M chars/MÊS por passe de 8 servidores** —
o pool do passe é partilhado entre os servidores dele (gastar no servidor A desconta
ao B). Pior caso absoluto (allowance esgotado, free tier já consumido): Plus $0.40 vs
€1.99 (margem ≥81%); passe 3s $1.60 vs €3.99 (≥63%); passe 8s $4.00 vs €7.99 (≥54%).
**Margem garantida por construção em todos os planos**; com o free tier, custo real €0
até ~10 passes esgotados/mês.

**Assunções:** (1) endpoint `texttospeech.googleapis.com/v1/text:synthesize` com API key
(header `X-Goog-Api-Key`); (2) seleção de voz por `languageCode` + `ssmlGender` (sem nome
de voz — a Google escolhe a Standard default da língua; cobre ~40 línguas); (3) o Diogo
cria o projeto GCP + ativa a API + cria a key (restrita à API TTS) quando quiser ligar;
sem `GOOGLE_TTS_API_KEY` no `.env`, o motor degrada para gTTS (padrão Kokoro-sem-sidecar).

## Scope

### In
- `'gcloud'` como valor de `UserEngine` (store), `SynthRequest.engine` e choice do
  `/voice set` (label `💎 Google HD`; nome final a confirmar com o Diogo na execução).
- Novo `GCloudEngine` (src/tts/gcloud.ts): POST synthesize, `audioEncoding: 'LINEAR16'`
  (WAV, alinha com o pipeline/AudioCache), timeout, de-caps, cache namespace `gcloud`,
  `engine` na cacheKey.
- Opção de género por-user: reutilizar o mapeamento de línguas do gTTS → `languageCode`
  BCP-47; género default FEMALE, escolha via voz/UX mínima (decidir na execução: v1 pode
  ser só FEMALE para não mexer no /voice set além do engine).
- Gate Premium duplo: no `/voice set` (locked + upsell, padrão dos efeitos) E em runtime
  na síntese (Premium expirado → gTTS em silêncio, sem tocar na escolha guardada).
- **Onde vive a aplicação (decidido na execução, 2026-07-12, após ler o código):** o
  ponto "runtime" NÃO é o `session.ts` (isso é só a ligação de voz) — é onde a escolha
  de motor do user vira pedido, em **~6 call sites** que copiam `userVoice.engine` para o
  `SynthRequest`: `messageHandler.ts:286`, `core.ts:160`, `fun.ts` (×4: /joke, /laugh, e
  dois mais), `voice.ts` (/voice preview). Um gate só no messageHandler seria um BURACO de
  custo (o /joke, /laugh, /voice preview passariam ao lado). Por isso:
  - **Resolver partilhado** `resolveUserEngine(db, guild, user, storedEngine, now)` ligado
    aos ~6 sites: despromove `gcloud→google` sem Premium (gate runtime) e resolve o
    descritor de orçamento, que viaja no pedido (`req.gcloudBudget`, como o `cloneRef`/
    `effect` já viajam).
  - **Contagem no CHOKEPOINT** (o `GCloudEngine`, funil universal): conta os chars SÓ em
    cache-miss (= chamada real à Google). Cobertura completa por construção. Um pedido
    `gcloud` SEM `gcloudBudget` → fail-SAFE (throw → gTTS), nunca fail-open (custo não
    contado). Nota honesta: a contagem é conservadora (nunca sub-conta o custo real).
- Fallback por falha: gcloud → gTTS via `RouterEngine` (throw em qualquer route cai na
  seguinte — confirmado em router.ts) — ninguém fica sem voz.
- Salvaguardas de custo (decisão FINAL do Diogo, 2026-07-11):
  - `GCLOUD_MAX_CHARS` (default 500): pedido maior → gTTS direto
  - **Plus (pessoal)**: `GCLOUD_PLUS_MONTHLY_CHARS`, default **100 000 chars/MÊS/pessoa**
    (~2 000 mensagens; custo máx $0.40)
  - **Premium (POR PASSE, não por servidor)**: pool mensal PARTILHADO entre os
    servidores do passe, escalado pelos seats:
    - passe de 3 servidores → `GCLOUD_PASS3_MONTHLY_CHARS`, default **400 000** (máx $1.60)
    - passe de 8 servidores → `GCLOUD_PASS8_MONTHLY_CHARS`, default **1 000 000** (máx $4.00)
    - (seats intermédios/grandfathered ex. 10: usar o tier mais próximo ≥ seats, i.e. 1M)
    Gastar no servidor A desconta ao pool do passe todo. O contador é keyed pelo DONO
    do passe (owner user id), resolvido a partir da guild ativa → passe que a ativou.
  - Precedência (SEM spill, decidido 2026-07-12): tem Plus → gasta SÓ do pool pessoal
    (esgotado → gTTS, NÃO passa para o pool do passe — evita um Plus drenar o dono do
    passe); NÃO tem Plus → gasta do pool do passe/servidor que cobre o servidor
  - Servidor Premium DIRETO (redeem/discord/manual, sem passe): pool com scope `guild`
    keyed por guildId, limite = tier de 3 servidores (400k) por defeito (fecha o buraco
    de um premium sem dono de passe)
  - Tie-break do dono do passe: `premium_pass_activation` não tem UNIQUE em guild_id, por
    isso dois donos PODERIAM ativar a mesma guild — escolhe-se determinística o de
    `activated_at` mais antigo
  - Contadores MENSAIS PERSISTENTES em SQLite (`gcloud_usage(scope, key, month, chars)`,
    scope 'user'|'pass'|'guild'|'global', mês YYYY-MM UTC) — em memória um restart daria reset
  - Backstop GLOBAL/dia (`GCLOUD_DAILY_CHAR_BUDGET`, default 300 000, em memória):
    disjuntor contra bugs/abuso; 0 = desligado
- Métricas: `gcloud_synths`, `gcloud_chars`, `gcloud_fallbacks` no /stats interno.
- i18n das mensagens novas (catálogo do bot, ~35 locales), `.env.example`, ARCHITECTURE.md.
- TDD em tudo (vitest).

### Out (deliberado)
- OpenAI/tier WaveNet/Neural2 da Google ($16/1M) — upgrade futuro se o Standard pegar;
  o desenho (gate, allowances, contadores) fica igual, muda o `voice.name`.
- Tradução DeepL — feature separada, decidir depois.
- Ponto na matriz de preços do site (i18n ×10) — DEPOIS de validar a qualidade ao vivo.
- Escolha de voz específica por nome (ex. en-US-Standard-D) — v2.

## Fases

### Fase 1 — Núcleo: GCloudEngine + 4º motor por-user (TDD)
Deliverable: `PerUserEngineRouter` despacha `engine:'gcloud'` para gcloud→gTTS;
sem `GOOGLE_TTS_API_KEY`, o caminho gcloud É o gTTS.
- [ ] `UserEngine` e `SynthRequest.engine`: `+ 'gcloud'` (userVoice.ts, engine.ts)
- [ ] cacheKey: `'gcloud'` junta-se aos engines que entram na chave (cache.ts)
- [ ] `GCloudEngine` novo (fetch com mock nos testes; LINEAR16; erro HTTP → throw p/ fallback)
- [ ] Mapeamento langKey → languageCode BCP-47 (reutilizar/estender o do gTTS)
- [ ] factory: caminho `gcloud` = `RouterEngine([{gcloud, langs:null}, {google, langs:null}])`
      com key; sem key = `google`
- [ ] `PerUserEngineRouter`: 4º ramo + testes (despacho, fallback, sem-key)
- Done: `npx vitest run` verde; teste prova que sem key `gcloud === google` (identidade)

### Fase 2 — Gate Premium + /voice set
Deliverable: só Premium/Plus consegue definir e usar o motor gcloud.
- [ ] definitions.ts: choice `💎 Google HD` no `engine` do `/voice set`
- [ ] voice.ts: definir `engine:'gcloud'` sem Premium → locked + upsell
      (isUserPremium ∥ isGuildPremium, padrão voice.effect.locked)
- [ ] session.ts (runtime): revalidar Premium ao construir o SynthRequest; expirado →
      `engine:'google'` só para este pedido
- [ ] i18n: 2 chaves novas (locked/set) × ~35 locales
- Done: testes do gate no set E do downgrade em runtime; suite verde

### Fase 3 — Allowances mensais por passe + observabilidade (TDD)
Deliverable: custo limitado; fallback silencioso ao esgotar; pool partilhado por passe.
- [ ] Tabela `gcloud_usage` + store (get/add por scope user|pass|global, mês UTC)
- [ ] Resolver guild → passe ativo (dono) no store de premium (a ativação de guild já
      referencia o passe/owner — reutilizar; se uma guild for premium por mais de um
      caminho, escolher o passe que a ativou)
- [ ] Enforcement na síntese: max-chars → allowance (Plus 1M do próprio primeiro; senão
      pool de 8M do passe) → backstop global; qualquer limite excedido → gTTS
- [ ] Métricas + 1 log warn/dia quando um limite atua
- Done: testes dos limites (user, pass partilhado entre 2 guilds do mesmo passe, global)
      + persistência (reabrir DB mantém o consumo do mês); suite verde

### Fase 4 — Fecho e ativação
Deliverable: deploy em produção, inerte até haver key.
- [ ] `.env.example`: `GOOGLE_TTS_API_KEY`, `GCLOUD_MAX_CHARS`, `GCLOUD_PLUS_MONTHLY_CHARS`,
      `GCLOUD_PASS3_MONTHLY_CHARS`, `GCLOUD_PASS8_MONTHLY_CHARS`, `GCLOUD_DAILY_CHAR_BUDGET`
      (+ nota de custo/free tier)
- [ ] ARCHITECTURE.md: secção do motor gcloud por-user
- [ ] Suite completa + typecheck + build + commit + push (deploy-bot.yml)
- [ ] **[needs Diogo]** criar projeto GCP → ativar Cloud Text-to-Speech API → API key
      restrita à API + quota/billing alert; colar `GOOGLE_TTS_API_KEY` no `.env` do VPS;
      restart; testar ao vivo `/voice set engine:Google HD` num servidor Premium
- Done: fala gcloud ouvida ao vivo; sem key, bot comporta-se exatamente como hoje

## Riscos

- **Semelhança audível com o gTTS grátis**: as vozes Standard são da mesma família do
  gTTS — o salto pode soar pequeno. Mitigação: o pitch premium é fiabilidade oficial +
  género de voz + latência estável, não "voz melhor"; e o upgrade para WaveNet/Neural2
  ($16/1M, 1M grátis/mês) fica a UMA constante de distância (`voice.name`) se o Diogo
  quiser subir a qualidade depois de ouvir.
- **Custo variável real** — mas com os allowances finais (100k/400k/1M) o pior caso é
  sempre lucrativo: margem mínima ≥81% no Plus, ≥63% no passe de 3, ≥54% no de 8, mesmo
  com o free tier todo gasto. Mitigação extra: gate duplo + contadores persistentes +
  backstop global diário + QUOTA na consola GCP (Fase 4) + `.env` ajustável sem deploy.
- **API key num bot self-host open-source**: a key vive só no `.env` do VPS (nunca no
  repo); restringir a key à API TTS na consola. Regra existente: nunca ler/commitar `.env`.
- **Formato/campos da API**: primeira síntese real é na Fase 4; se a resposta divergir
  (base64 `audioContent`), ajusta-se aí — o fallback cobre os users entretanto.

## MVP

Fases 1+2: motor gcloud selecionável, gated, com fallback — testável num servidor
Premium assim que houver key. Fase 3 antes de anunciar.

Próxima ação concreta: Fase 1 — teste RED em `tests/perUserRouter.test.ts` para o despacho de `engine:'gcloud'`.
