# Plan 017 — Anti-spam de leitura + cooldown da saudação

> Planeado em 2026-07-08 (pedido do Diogo). Baseline: suite
> 1360 verde, commit `0370f4b`. Executor: ler o plano inteiro antes de começar;
> protocolo habitual (build → teste do plano → suite completa → commit só dos
> ficheiros em escopo → restart).

## Objetivo

Duas melhorias de UX de voz independentes:

1. **Anti-spam (toggle por guild)**: quando ligado, o Vozen não lê mensagens
   spamadas — repetição massiva da mesma palavra/frase (ex. "POKEBOLAS" ×39) e
   mensagens grandes idênticas repetidas pela mesma pessoa em janela curta.
2. **Cooldown da saudação (5 min, sempre ativo)**: quem spama entrar/sair da call
   só é saudado ("Olá {nome}" / parabéns) uma vez a cada 5 minutos por guild.

## Scope

### In

- Detetor puro de spam intra-mensagem (repetição de tokens) + tracker de
  duplicados inter-mensagem (em memória, por guild+autor, janela temporal).
- Coluna `antispam` no `guild_config` (via descriptor `GUILD_CONFIG_COLUMNS`) +
  subcomando `/config antispam on|off`. **Default OFF** (opt-in, pedido do Diogo).
- Gate no `messageHandler` (leitura automática, menções, replies, text-in-voice).
- Cooldown de 5 min no `greetOnJoin` (guild+utilizador, em memória, relógio
  injetável). Cobre a saudação normal E os parabéns. **Não configurável** — constante.
- Testes unitários dos núcleos puros + integração no messageHandler; i18n das
  respostas do `/config antispam` (seguir o padrão do `/config xsaid`).

### Out

- Flood de caracteres ("kkkkkkk", "hahahaha") — risco alto de falso positivo em
  riso PT-BR/EN; fica para iteração futura se o Diogo pedir.
- Anti-spam no `/tts` explícito e nos jogos — o comando é ação deliberada; os
  palpites de jogo já não são lidos.
- Moderação real (apagar/avisar) — o Vozen só *não lê*; não toca na mensagem.
- Cooldown configurável da saudação (`/config greet-cooldown`) — YAGNI; 5 min fixo.
- Persistência do estado anti-spam/cooldown em SQLite — memória chega (reset no
  restart é aceitável e até desejável).

## Fases

### Fase 1 — Cooldown da saudação (independente, ganho imediato)

Deliverable: `greetOnJoin` não repete a saudação à mesma pessoa em < 5 min.

- [ ] `src/voice/greetCooldown.ts`: classe pura `GreetCooldown` — mapa
      `guildId:userId -> lastGreetMs`, `shouldGreet(guildId, userId, nowMs)`
      (regista e devolve true se passaram ≥ `GREET_COOLDOWN_MS = 300_000`),
      poda de entradas velhas ao tocar (cap de memória, padrão do langMemory).
- [ ] Instância em `BotDeps` (como `lastSpeaker`); consulta no início de
      `greetOnJoin` (client.ts) ANTES de construir o req — aplica-se a saudação
      normal E a parabéns (entrar/sair não repete "feliz aniversário").
- [ ] `tests/greetCooldown.test.ts`: 1ª entrada sauda; reentrada aos 2 min não;
      aos 6 min volta a saudar; guilds/utilizadores independentes; poda.
- Done: teste novo verde + entrar/sair na call de teste só produz 1 saudação.

### Fase 2 — Núcleo puro anti-spam

Deliverable: `src/moderation/antispam.ts` com detetores puros e testados.

- [ ] `isRepetitionSpam(text)`: tokeniza (whitespace, minúsculas, sem pontuação);
      spam se `tokens ≥ 10` E `únicos/total ≤ 0.35`. Pina os dois limiares como
      constantes exportadas. ("POKEBOLAS"×39 → ratio 0.026 → spam; frase normal
      de 12 palavras → ~0.9 → ok; "eu gosto de ti"×3 → 0.33 → spam.)
- [ ] `DuplicateTracker` (relógio injetável): `isDuplicateSpam(guildId, authorId,
      normalized, nowMs)` — spam se a MESMA pessoa repete mensagem normalizada
      idêntica com `≥ 40 chars` dentro de `60s` (a 1ª lê-se; da 2ª em diante não).
      Memória capada com poda (mesmo padrão da Fase 1).
- [ ] `tests/antispam.test.ts`: casos acima + fronteiras (9 tokens não; 0.36 não;
      39 chars não; 61s não; autores/guilds diferentes não interferem).
- Done: todos os casos-fronteira verdes; funções PURAS (sem I/O).

### Fase 3 — Config + comando (depende da F2 só para o nome)

Deliverable: `/config antispam on|off` persistido por guild.

- [ ] Entrada `antispam` em `GUILD_CONFIG_COLUMNS` (`INTEGER NOT NULL DEFAULT 0`,
      `asBool`) — a migração/UPSERT vem de graça do descriptor (plano 014).
- [ ] Subcomando `antispam` no builder do `/config` (commands/index.ts) + handler
      em `handlers/config.ts`, espelhando o `/config xsaid` (toggle + resposta).
- [ ] Chaves i18n `config.antispam.*` no catálogo — EN + PT reais, restantes
      locales pelo fallback estrutural existente (verificar o teste de
      integridade do catálogo; seguir exatamente o que o xsaid fez).
- [ ] Testes: persistência (set/get), resposta do comando, default OFF.
- Done: `/config antispam on` persiste e responde localizado; suite verde.

### Fase 4 — Wiring no messageHandler + integração

Deliverable: com antispam ON, mensagens spam não chegam ao TTS.

- [ ] Gate no `messageHandler` logo após o guard de vazio (linha ~189): se
      `cfg.antispam` e (`isRepetitionSpam(cleaned)` OU duplicado do tracker) →
      `return` silencioso (com `log.info('[antispam] …')` para observabilidade).
      NOTA: antes do `lastSpeaker`/`bumpTalk` (mensagem saltada não conta).
- [ ] `DuplicateTracker` em `BotDeps` (uma instância, partilhada).
- [ ] Testes de integração (padrão do messageHandlerLangDetect): POKEBOLAS×39
      com ON → `player.say` não é chamado; com OFF → é; mensagem normal com ON →
      é; 2ª mensagem grande idêntica em <60s → não.
- Done: os 4 cenários de integração verdes.

### Fase 5 — Fecho

- [ ] Suite completa + `npm run build` + `npm run typecheck` + lint/format.
- [ ] Doc-sync: `docs/ARCHITECTURE.md` (secção do pipeline de leitura + saudação),
      `/help` (mencionar `/config antispam`), CONTRIBUTING.md se necessário.
- [ ] Atualizar `plans/README.md` (linha 017) + commit(s) por fase + restart do bot.
- Done: bot em produção com as duas features; log de arranque limpo.

## Riscos

- **Falsos positivos do detetor** — letras de música/contagens legítimas repetem
  palavras. Mitigação: limiares conservadores (10 tokens, 0.35), toggle OFF por
  defeito, e log de cada skip para auditar. Os limiares são constantes num só
  sítio para afinar barato.
- **"kkkkk"/"hahaha" não são apanhados** (fora de escopo de propósito). Se o
  Diogo os quiser, é uma extensão do detetor — não muda a arquitetura.
- **maxChars=300 já trunca** mensagens grandes — o anti-spam intra-mensagem atua
  sobre o texto JÁ truncado (300 chars de POKEBOLAS ≈ 30 tokens → apanhado na
  mesma). O detetor de duplicados usa o texto normalizado pós-clean; documentar.
- **Memória**: dois mapas em memória novos (cooldown + duplicados). Ambos com
  poda/cap — sem crescimento sem limite (lição do langMemory).
- **i18n**: o catálogo tem teste de integridade estrutural; adicionar chaves só
  a EN/PT pode falhar esse teste — verificar ANTES como o xsaid resolveu isto
  (é o desconhecido mais barato de resolver na Fase 3, não deixar para a 5).

## MVP

Fim da **Fase 1**: o cooldown da saudação já é útil sozinho e vai para produção
de imediato. O anti-spam completo fecha no fim da **Fase 4**.

Próxima ação concreta: implementar `src/voice/greetCooldown.ts` + wiring no `greetOnJoin` (Fase 1).
