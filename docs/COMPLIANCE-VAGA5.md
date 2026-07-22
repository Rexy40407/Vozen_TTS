# Checklist de Compliance — Vaga 5 (Fase 0)

> Deliverable da Fase 0 do `PLAN-VAGA5-FEATURES.md`. Mapeia cada feature nova aos
> requisitos do Discord (Developer Policy + ToS) e às hard-rules do repo, com o
> **portão** que tem de estar satisfeito ANTES do código de cada feature.
> Ancorado em `docs/COMPLIANCE-DISCORD.md` (estado atual) e `CONTRIBUTING.md`.
>
> Numeração dos artigos como em `COMPLIANCE-DISCORD.md`: 1–3 (consentimento/opt-out),
> 5–7 (sem DMs/contacto não solicitado), 15/20/21 (dados só para a função declarada,
> sem treino de IA), 16–19 (sem perfil/venda/partilha). ToS §5 (tratamento/retenção/
> breach). Requisitos de Monetização (price parity nos Premium Apps).

## Invariantes transversais (valem para as 4 features)

- [ ] **Tabela nova com `user_id`/`guild_id` → `store/dataLifecycle.ts`.** Qualquer
  tabela nova entra nas listas de erase/purge, senão o rot-guard
  `tests/dataLifecycle.test.ts` FALHA. Cobre ToS §5(b) (retenção) e o direito ao
  esquecimento (`/privacy erase`).
- [ ] **Dado novo user-facing → `PRIVACY.md`.** Toda a categoria de dado guardada é
  disclosed, com o seu caminho de eliminação. (Art. 15/20/21.)
- [ ] **Perk pago → entitlements + price parity.** Nenhum canal de pagamento novo; segue
  o modelo Ko-fi/`syncDiscordEntitlements` atual; SKU (quando existir) ≤ preço externo
  (`docs/MONETIZATION.md`). (Requisitos de Monetização.)
- [ ] **Gravar/agir sobre um utilizador → consentimento prévio e explícito.** (Art. 1–3.)
- [ ] **Sem DMs, sem treino de IA, sem venda/partilha de dados.** (Art. 5–7, 15–21.)

## C · Soundboard

| Item | Estado do portão |
|---|---|
| Que dados? | MVP **curado**: nomes de clip + assets no repo. **Zero dado de utilizador novo.** |
| Art. 4/8/10–13 (conteúdo) | Clips curados livres de direitos; `assets/sfx/LICENSES.md` regista fonte+licença (preferir CC0). |
| Reprodução | Toca na call onde o bot já está (função declarada de áudio). |
| Nitro / Soundboard nativo | **Verificado 2026-07-13: não é circunvenção.** A Developer Policy proíbe contornar features de *privacy/safety/security*, limites da API, e comercializar serviços do Discord — **não** proíbe bots de oferecerem funcionalidade semelhante a perks Nitro. O `/sound` toca áudio pela ligação de voz (o mesmo mecanismo do TTS e de qualquer music bot); **não** usa os endpoints do Soundboard nativo, não injeta sons nos slots do servidor nem desbloqueia nada do cliente. Precedente: Blerp (soundboard com 1M+ sons) opera publicamente há anos. Vermelho apenas se algum dia: usarmos a API do Soundboard nativo para contornar limites de slots/boosts, ou vendermos acesso a serviços do Discord. |
| UGC (upload) | **Fora de âmbito nesta vaga.** Se um dia houver: TERMS responsabiliza o uploader + moderação + limites. |

- [ ] Portão fechado: sem tabela nova, sem PII, clips com proveniência registada.

## D · Stats de servidor (Premium)

| Item | Estado do portão |
|---|---|
| Que dados? | **Só agregados de dados já guardados** (`talk_stats`, `game_score`). Sem NOVA recolha. |
| "Top-tagarelas" | Dado por-utilizador **já** disclosed e **já** coberto por `/privacy erase`. |
| Art. 16–19 | Agregação para o próprio servidor; sem perfil vendido/partilhado. |
| Perk pago | Gate `isGuildPremium`; funil = matriz do site + `MONETIZATION.md` (parity). |

- [ ] Portão fechado: confirmar que nenhum campo mostrado exige recolha nova; disclosure já cobre.

## B · Dashboard web

| Item | Estado do portão |
|---|---|
| OAuth | Scopes **mínimos**: `identify` + `guilds`. O `guilds` é **dado novo** → disclosed em `PRIVACY.md`. Muda o fluxo do `account.html` (hoje só `identify`) → re-consent dos utilizadores. |
| Autorização | Só quem tem **Manage Guild** edita; verificar via permissões do Discord (não confiar no cliente). |
| Que escreve? | Só config **já** guardada via slash (canal, voz, blocklist, pronúncias). Sem PII nova. |
| Sessão/token | Se guardado server-side → tabela nova com `user_id` → rot-guard + `PRIVACY.md` + eliminação. Decisão Bearer vs cookie no spec. |
| Hardening | Não enfraquecer `timingSafeEqual` / bind loopback / CORS restrito da API só-leitura. |

- [ ] Portão fechado: scope `guilds` disclosed; sessões tratadas como dado pessoal; auth decidido.

## A · STT (voz→texto)

| Item | Estado do portão |
|---|---|
| Consentimento | **Explícito e prévio por-locutor** (padrão consent-first: botão que só o próprio carrega, `consent_at`). (Art. 1–3.) |
| Transparência | Anúncio no canal ao **arrancar/parar** + auto-stop quando não resta consentido; o des-deafen do bot é parte do indicador. |
| Áudio | **Nunca persistido** (memória). Whisper **local** = sem partilha com terceiros, sem treino de IA. (Art. 15/20/21.) |
| Transcrições | **FICAM persistidas como mensagens do Discord** (fora do `/privacy erase`) → disclosure honesta em `PRIVACY.md` + política de revogação definida no spec. |
| Consentimento guardado | Tabela nova (`stt_consent` ou afim) → rot-guard + `PRIVACY.md`. |

- [x] **Portão fechado (2026-07-13, F4.4):** consent-first por-locutor via **botão inline** no anúncio de arranque (só o próprio carrega → `grantSttConsent`; `hasSttConsent` é o gate — quem não consente nunca é captado); transparência ativa — anúncio no canal ao **arrancar** (com o botão) e ao **parar** + o bot des-ensurdece só durante a sessão (`selfDeaf:false`→`true`) + **auto-stop** quando não resta consentido na call; áudio **nunca persistido** (WAV efémero apagado após transcrever); transcrições disclosed como mensagens permanentes na `PRIVACY.md` §2.4 (fora do `/privacy erase`, com `/transcribe revoke` para parar futuras); Whisper **local** (faster-whisper), sem terceiros nem treino de IA. **Premium-gated + Manage-Guild** para arrancar.

---

**Veredito Fase 0 (compliance):** nenhuma das 4 features viola a Policy no desenho, DESDE
que os portões acima sejam fechados na respetiva fase. O único ponto que exige honestidade
explícita (não é violação, é transparência) são as transcrições do STT como mensagens
persistentes — tratado no portão da Fase 4.
