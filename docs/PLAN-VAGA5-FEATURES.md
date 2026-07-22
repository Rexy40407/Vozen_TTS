# Plano — Vaga 5 de Features (Vozen)

> Planeamento only. Quatro features escolhidas pelo Diogo, com um **portão de
> compliance por feature** (requisito transversal). Cada feature será depois
> destrinçada no seu próprio spec/plano (brainstorming → writing-plans) antes de
> código; este documento é o plano **da vaga**: âmbito, ordem, portões e MVP.
> Compliance ancorada em `docs/COMPLIANCE-DISCORD.md` + `CONTRIBUTING.md` (§"Discord
> compliance is mandatory").
>
> Segunda revisão técnica concluída a 2026-07-13: 12 correções aplicadas —
> as maiores: rescopar as Stats ao que o store realmente tem; tratar as mensagens
> de transcrição do STT como dado persistido; o STT reutiliza as *peças* do
> recorder, não o `recordUserSample` inteiro; spike com limiares numéricos.

## Estado da execução (2026-07-13)

- **Fase 0 — ✅ metade local feita:** checklist de compliance em `docs/COMPLIANCE-VAGA5.md`. Spike STT (VPS) só bloqueia a Fase 4.
- **Fase 1 — Soundboard: ✅ DEPLOYED** (deploy VPS success; inclui o toggle admin `/config soundboard`). **MVP alcançado e no ar.**
- **Fase 2 — Stats de servidor: ✅ code-complete + verde** (`/server-stats`: gate Premium OU Plus + teaser free top-3; agrega talk_stats + game_score, sem recolha nova). Falta: funil no site (matriz de preços i18n×10) — marketing, não-crítico.
- **Fase 3 — Dashboard web: ✅ COMPLETA** (a fazer deploy do site).
  - Backend: `dashboardApi.ts` (autz MANAGE_GUILD/ADMIN + bot-presente; escrita whitelisted via setter) + rotas `/api/dashboard/*` (CORS+rate-limit+Bearer); 18 testes. **Deployed.**
  - Frontend: `site/dashboard.html` + `dashboard-v1.js` (login OAuth `identify guilds` via **redirect /account reutilizado** — sem passo no portal; bounce `returnTo` no `main.js`→v27), seletor de servidor, form de 11 campos (9 toggles + maxChars + ratePerMin), guardar. Verificado no browser (en+pt, sem erros de CSP).
  - PRIVACY: secção 1.1 disclosa o login do site (scopes `identify`/`guilds`, transitório, não guardado).
  - *MVP:* i18n do corpo é en+pt inline (resto cai no en); locale/canal/voz/blocklist/pronúncias ficam para 3b.
- **Fase 4 (STT): spike ✅ VIÁVEL** (`docs/SPIKE-STT.md`) + **F4.1 infra ✅** (`UtteranceCollector` — segmentação por silêncio, 7 testes; `resolveWhisperCmd` + `tools/whisper_sidecar.py` + `tools/setup-whisper.sh` — sidecar persistente faster-whisper, 5 testes; código INERTE até ao wiring). **Falta F4.2 (consentimento por-locutor — o crítico), F4.3 (wiring: subscrever consentidos → sidecar → routing p/ canal, zero persistência de áudio), F4.4 (i18n + PRIVACY + deploy + setup no VPS).**

## Objetivo / Goal

Entregar a próxima vaga do Vozen — **Soundboard**, **Stats de servidor**,
**Dashboard web de configuração** e **STT (voz→texto)** — cada uma conforme com o
ToS + Developer Policy do Discord por construção (consentimento, uso de dados só
para a função declarada, transparência na Privacidade, caminho de eliminação,
paridade de preços nos perks pagos).

## Scope

### In
- **C · Soundboard** — `/sound <nome>` toca clips curtos na call (MVP: biblioteca curada).
- **D · Stats de servidor** — relatório por-guild (perk Premium) sobre dados já guardados.
- **B · Dashboard web** — configurar a guild pelo browser (estende o site + OAuth existentes).
- **A · STT** — transcrição voz→texto de locutores **consentidos** para um canal de texto.
- **Portão de compliance por feature** — checklist ToS/Policy validada ANTES do código de cada uma.

### Out (deliberadamente fora desta vaga)
- Soundboard com **upload** de utilizadores (UGC: moderação/copyright/storage) — decisão à parte, pós-MVP.
- STT via **API de nuvem** (enviar áudio a terceiros) — só Whisper **local** (sem partilha de dados).
- Persistir **transcrições** ou **áudio** do STT — processamento em memória; nada guardado.
- **Novo** canal de pagamento — os perks pagos seguem o modelo Ko-fi/entitlements atual (sem tocar em monetização).
- Dashboard como **billing/checkout** — só configuração; pagamentos continuam no site/Ko-fi atuais.
- Mobile TTS (limitação estrutural do Discord, já documentada).

## Fases / Phases

### Fase 0 — Baseline de compliance + spike de STT
Deliverable: (1) uma checklist de compliance por-feature (mapeada aos artigos da Policy) e
(2) um relatório de spike de STT com veredito contra limiares NUMÉRICOS. Deps: nenhuma.
**As Fases 1–3 dependem só da checklist respetiva; APENAS a Fase 4 depende do spike** —
um spike empancado não bloqueia o Soundboard.
Done: checklist escrita; o spike responde sim/não com números contra os limiares abaixo.
- [ ] Reafirmar as regras transversais: **qualquer tabela nova** com `user_id`/`guild_id` entra nas listas de `store/dataLifecycle.ts` (senão o rot-guard `tests/dataLifecycle.test.ts` FALHA) **e** é disclosed em `PRIVACY.md`; **qualquer perk pago** segue entitlements + price-parity; **qualquer gravação** é consent-first.
- [ ] Spike STT com **limiares de aceitação**: p95 de transcrição ≤ **5s** por utterance de ≤10s; p95 do TTS **não degrada > 25%** com STT ativo em simultâneo (medir com o pool Piper QUENTE + 2 locutores concorrentes — não one-shot). Especificar o modelo (tiny/base/small) e o formato de entrada: whisper.cpp quer **16kHz mono** (o `pcmToWavFile` atual produz 24kHz — ajustar a conversão no sidecar, não no clone).
- [ ] Sidecar Whisper local (padrão `setup-clone.ps1`/`setup-kokoro.ps1`), medido NO VPS (já corre Piper pool + clone/Kokoro → contenção de CPU é o risco real).
- [ ] Registar veredito do spike em `docs/` (viável / gated-a-Premium / defer).

### Fase 1 — Soundboard (C)  ·  *primeira vitória, self-contained*
Deliverable: `/sound <nome>` toca um clip da biblioteca curada na call; `/sound list`. Deps: checklist da Fase 0 (não o spike).
Done: `/sound <nome>` reproduz áudio numa call real; teste cobre o registo + o caminho de reprodução + o rate-limit; se houver tabela nova, está nas listas do `dataLifecycle` e o rot-guard passa.
**Portão de compliance:** MVP **curado** (sem upload) → sem UGC, sem moderação, sem copyright de terceiros. Reproduz áudio na call onde o bot já está (função declarada). Se mais tarde houver upload → TERMS coloca a responsabilidade no uploader + limites de tamanho/duração + moderação.
- [ ] TDD: registo de clips (nome→asset) puro + testes.
- [ ] Reutilizar `SynthRequest.assetPath` (o `/rizz sound` já toca WAV cru DIRETO, sem motor/cache) para tocar o clip.
- [ ] **Anti-spam sonoro**: o mesmo `RateLimiter` por-utilizador do `/tts` (padrão do `/laugh`/`/joke`), respeitar kill-switch + role-gating da guild, e toggle admin `/config` para desligar o soundboard.
- [ ] `/sound` + `/sound list` + autocomplete; i18n (`en` base + `pt`).
- [ ] Curar clips iniciais em `assets/sfx/` com **proveniência registada** (`assets/sfx/LICENSES.md`: fonte + licença por clip; preferir CC0 — CC-BY exige atribuição e o repo é AGPL público).

### Fase 2 — Stats de servidor (D)  ·  *perk Premium barato*
Deliverable: `/server-stats` (Premium) com **o que o store realmente tem**: mensagens lidas
+ streaks (`talkStats`), top-tagarelas (`getTopSpeakers`), pontos/vitórias dos jogos
(`game_score`). **Nada de "minutos falados" nem "línguas"** — o `talkStats` guarda contagens
de mensagens (não durações) e a deteção de língua foi removida (2026-07); prometer isso
exigiria NOVA recolha, que o portão proíbe. Deps: checklist da Fase 0.
Done: renderiza para uma guild Premium; fora de Premium mostra o **teaser free** (top-3 +
upsell "vê o resto com Premium" — senão ninguém descobre o perk); testes; `PRIVACY.md`
confirmado.
**Portão de compliance:** agregados de dados **já** guardados (`talkStats`, `game_score`) — sem NOVA recolha. "Top-tagarelas" é dado por-utilizador já disclosed e já coberto por `/privacy erase`. Perk pago → mesmo caminho entitlements/Ko-fi + price-parity (sem canal de pagamento novo).
- [ ] TDD: função pura de agregação (rows → relatório) + testes.
- [ ] Gate Premium via `isGuildPremium` + teaser free (top-3) com upsell.
- [ ] Comando + embed + i18n; confirmar disclosure na Privacidade.
- [ ] **Funil do perk** (padrão PRICE·×): ponto na matriz de preços do site (i18n ×10) + `MONETIZATION.md` (price parity do SKU).

### Fase 3 — Dashboard web (B)  ·  *maior superfície nova*
Deliverable: página autenticada para editar a config de UMA guild (canal TTS, voz default, blocklist, pronúncias). Deps: checklist da Fase 0. (Independente de 1/2, mas depois por ser a maior.)
Done: um **admin** da guild faz login, muda a voz default, e o bot reflete-o **sem restart**; um **não-admin** é recusado; testes da API de escrita + autorização + invalidação da cache.
**Portão de compliance:** OAuth com scopes **mínimos** (`identify` + `guilds` — o scope `guilds` é DADO NOVO: disclosed em `PRIVACY.md`; hoje o `account.html` só pede `identify`, o fluxo muda e força re-consent); só quem tem **Manage Guild** edita (verificar via permissões do Discord, não confiar no cliente); a escrita toca só config **já** guardada via slash (sem PII nova); qualquer sessão/token guardado server-side é tabela nova com `user_id` → rot-guard + `PRIVACY.md` + caminho de eliminação. Não enfraquecer o hardening já existente da API só-leitura (`timingSafeEqual`, bind loopback, CORS restrito).
- [ ] **Decisão de auth no spec** (não misturar vocabulários): manter o padrão **Bearer** do `account.html` (sem cookies → CSRF não-aplicável; o risco passa a ser o storage do token no browser) OU migrar para cookie+sessão (aí sim CSRF). Default recomendado: Bearer, coerente com o que existe.
- [ ] TDD: endpoints de **escrita** no servidor HTTP existente (hoje `statusApi` é só-leitura) + testes.
- [ ] **Escritas SÓ via setters do store** (`setGuildConfig`, blocklist, pronunciation) — NUNCA SQL direto: os setters invalidam a cache write-through (Exec 010, "REGRA DE OURO" de `store/cache.ts`; SQL direto = bot serve config stale até restart) e já impõem os caps (pronúncia 3/50) de graça.
- [ ] Autorização por-guild: resolver os guilds do utilizador via OAuth e exigir `MANAGE_GUILD`.
- [ ] UI (ver **UI Blueprint**), reutilizando o design system do site + o padrão OAuth do `account.html`.
- [ ] i18n (10 línguas do site), cache-bust por rename, `build:site`, deploy, verificação live no browser.

### Fase 4 — STT voz→texto (A)  ·  *a grande aposta, gated pelo spike*
Deliverable: o bot transcreve a fala de locutores **consentidos** para um canal de texto. Deps: **spike da Fase 0 aprovado** (limiar numérico).
Done: um utilizador que **consentiu** fala → aparece texto; um que **não** consentiu não é transcrito; nenhum áudio nem transcrição persistido **internamente**; anúncio de início/fim no canal; auto-stop quando não resta consentido na call; testes do gate de consentimento + do routing.
**Portão de compliance (o mais pesado):** consentimento **explícito e prévio por-locutor** (reutilizar o padrão consent-first do clone: botão que só o próprio carrega, `consent_at`); transparência ativa — anúncio no canal ao **arrancar/parar** a transcrição (quem entra a meio não viu o início; o des-deafen do bot é ele próprio parte do indicador) + auto-stop quando não resta nenhum consentido; áudio **nunca** persistido; **as transcrições FICAM persistidas como mensagens do Discord** (visíveis, pesquisáveis, fora do `/privacy erase`) — disclosure honesta em `PRIVACY.md` + política de revogação definida no spec (apagar as mensagens do bot ao revogar, ou documentar explicitamente que não apaga); Whisper **local** = sem partilha com terceiros e sem treino de IA; opt-out honrado.
- [ ] TDD: gate de consentimento (só locutores consentidos entram no receiver) + routing puro (segmento → mensagem de canal).
- [ ] Sidecar Whisper local (padrão dos sidecars clone/Kokoro; auto-detetado), entrada **16kHz mono**.
- [ ] **Reutilizar as PEÇAS do recorder, não o `recordUserSample`** (que é one-shot de 15s e o `VoicedCollector` descarta silêncio — mau para fronteiras de palavras): novo `UtteranceCollector` por-utterance sobre subscribe por-SSRC + decoder Opus→PCM + RMS gate, com o `AfterSilence 800ms` a delimitar utterances e emissão incremental de segmentos.
- [ ] Comando de consentimento + anúncio início/fim + auto-stop + i18n; disclosure na Privacidade (incl. transcrições-como-mensagens).

## UI Blueprint (só a Fase 3 — Dashboard)

O Dashboard **reutiliza o design system do vozen.org já existente** (não se inventa nada novo);
o desenho detalhado fica para o spec próprio da Fase 3. Ao nível da vaga:

- **a) Direção visual:** herdada do site — escuro, glass, aqua-accent, calmo/técnico (os mesmos `grain`/`orbs` das páginas atuais).
- **b) Tokens:** os do site já em produção (`site/css/main-vNN.css`) — `--bg-0`, `--panel-2`, `--line-2`, `--aqua` (botão), tipografia e espaçamento existentes. **Zero tokens novos** salvo necessidade provada.
- **c) Componentes:** reutilizar o cartão/painel e o fluxo OAuth do `account.html`; novos: um **form de config da guild** (select de voz, toggle autoread, inputs de blocklist/pronúncia) com estados `default/hover/disabled/loading/erro/guardado`; um **seletor de guild** (as guilds onde o user é admin) com estado `vazio` ("não és admin de nenhum servidor com o Vozen").
- **d) Layout/responsivo:** desktop-first (config faz-se no PC), mas responsivo até 375–430px reutilizando os breakpoints do site.
- **e) Fluxos:** (1) login OAuth → escolher guild → editar config → guardar (feedback de sucesso/erro); (2) não-admin → estado vazio explicativo.
- **f) Acessibilidade:** contraste WCAG AA (herdado dos tokens do site), foco visível, alvos ≥44px.
- **g) Ordem de implementação:** tokens (já existem) → primitives/compositos reutilizados → página → polish.

## Riscos / Risks

- **STT — CPU/latência no VPS.** Já corre Piper pool + sidecars; Whisper local pode saturar. → resolvido barato no **spike da Fase 0** (com limiares numéricos e carga concorrente TTS+STT, não one-shot); se inviável, gated-a-Premium ou defer (a ordem protege a vaga).
- **STT — as transcrições são persistentes por natureza.** Postar num canal = mensagens do Discord para sempre, fora do `/privacy erase`. Não é evitável — é para **disclosar com honestidade** e definir a política de revogação no spec (ver portão da Fase 4).
- **Dashboard — nova superfície de escrita autenticada** = o maior risco de segurança novo. A API era só-leitura e endurecida; escrita precisa de autz por-guild sem enfraquecer o existente. A decisão Bearer vs cookie+sessão define se CSRF sequer se aplica (ver Fase 3).
- **Dashboard — config stale.** O store tem cache write-through (Exec 010); escrever fora dos setters = bot a servir config velha até restart. Mitigado por regra explícita na Fase 3 (só setters).
- **STT — atrito do consentimento.** Consent-first por-locutor é obrigatório (não negociável) e cria fricção de UX; desenhar o fluxo com cuidado (reutilizar o do clone).
- **Soundboard — pressão para aceitar upload.** UGC traz moderação/copyright; o MVP é curado de propósito. Upload é decisão à parte com o seu próprio portão.
- **Rot-guard / Privacidade.** Qualquer tabela nova por-utilizador/guild TEM de entrar em `dataLifecycle` + `PRIVACY.md` (o teste falha senão) — é rede de segurança, não risco, mas é passo obrigatório em cada feature.
- **Âmbito da vaga (4 features).** Risco de ficar a meio. Mitigação: cada fase é **independentemente shippável** (ship feature-a-feature, não big-bang).

## MVP

**Fim da Fase 1 (Soundboard).** É a primeira coisa nova, visível e divertida que se pode
usar numa call, com risco de compliance mínimo (curado). Cada fase seguinte acrescenta
uma feature já shippável por si.

**Próxima ação concreta:** correr o spike da Fase 0 — alimentar o WAV de `recordUserSample` a um Whisper local e medir latência + CPU no VPS, para saber se o STT é viável antes de comprometer a vaga.
