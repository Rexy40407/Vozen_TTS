# Arquitetura — Vozen

> Vozen — *type it, hear it.*

Este documento descreve a arquitetura real do Vozen tal como está no código (`src/`).
Para a spec de design original ver `docs/design-history/specs/2026-06-30-tts-bot-design.md`;
quando este documento e a spec divergem, **este reflete o código** (a spec é histórica).

## Visão geral

O Vozen é um bot de TTS (text-to-speech) para Discord. Lê em voz alta o que os
utilizadores escrevem num canal de texto, num único processo Node.js + TypeScript.

O wedge (o cruzamento que os bots dominantes não servem bem) é:

- **Voz neural grátis** — síntese com Piper self-hosted (modelos `.onnx`), custo €0
  por caráter, sem paywall nas boas vozes.
- **Fiabilidade** — auto-reconexão à voz com backoff, síntese com timeout, handlers
  globais de erro, cap na fila e graceful shutdown. O bot não cai do canal nem crasha
  num erro de síntese.
- **Auto-leitura** — lê automaticamente um canal de texto configurado (além de `/tts`
  e menções/replies ao bot).
- **Deteção de língua por mensagem** — a língua da mensagem decide a voz: a voz preferida
  (guardada do utilizador > default da guild > .env) é honrada quando já está na língua
  detetada, senão escolhe-se uma voz correta dessa língua (evita ler texto com o sotaque
  errado).

Estado por servidor (guild): cada guild tem a sua sessão de voz (ligação + player +
fila FIFO) e a sua configuração persistida.

## Módulos

Cada pasta de `src/` e a sua responsabilidade (o que está realmente no código):

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `config/index.ts` | Carrega e valida env (`DISCORD_TOKEN`, `CLIENT_ID`, caminhos do Piper, `DB_PATH`, defaults e limites, `TTS_ENGINE`, `OPENAI_API_KEY`, `MULTILINGUAL_SEGMENTS`). `loadConfig()` → `AppConfig`. | `dotenv`, `logging` |
| `store/db.ts` | Abre SQLite (`better-sqlite3`, modo WAL), cria tabelas via `CREATE TABLE IF NOT EXISTS` e aplica migrações de coluna idempotentes via `PRAGMA table_info`. | `better-sqlite3` |
| `store/userVoice.ts` | Voz por-utilizador (modelo + velocidade + motor `google`/`piper`/`kokoro`/`gcloud`): get/set/reset. | `db` |
| `store/gcloudUsage.ts` | Contadores MENSAIS de chars do Google HD (tabela `gcloud_usage(scope,key,month,chars)`), persistentes: `getGcloudMonthlyChars`/`addGcloudMonthlyChars` (UPSERT atómico) + `monthKeyUTC` (mês 'YYYY-MM' UTC). Pools por `scope` = `user`/`pass`/`guild`/`global`. | `db` |
| `store/guildConfig.ts` | Config por-guild (canal TTS, autoread, default_voice, max_chars, rate, enabled, role): get/set/reset com defaults. | `db` |
| `store/blocklist.ts` | Blocklist de palavras por-guild: add/remove/get. | `db` |
| `store/pronunciation.ts` | Dois dicionários: **PESSOAL** (`/pronunciation`, `pronunciation_user`) — global por-user, só as mensagens do próprio, cap 3 Free / 50 com Plus pessoal ou Premium da guild; e **SERVIDOR** (`/server-pronunciation`, `pronunciation`, admin) — toda a guild, cap 3 Free / 50 com Premium da guild. No pipeline aplica-se pessoal→servidor (o termo do user ganha). `addUser/ServerPronunciation` impõem o cap recebido pelo handler. | `db` |
| `store/optout.ts` | Opt-out de auto-leitura por-utilizador: is/set/clear. | `db` |
| `store/userAbbrev.ts` | Abreviaturas pessoais por-utilizador, **GLOBAIS** (chave = só `user_id`, seguem o utilizador entre servidores): get/add/remove, cap de **10** por utilizador (`USER_ABBREV_CAP`), tabela `user_abbreviation`. | `db` |
| `store/guildConfig.ts` (locale) | Além dos campos acima, `guild_config.locale` (idioma da **interface**; default `'en'`). | `db`, `i18n` |
| `store/premium.ts` | Premium/Plus por EXPIRY (`premium_guild`/`premium_user`, source `kofi`/`discord`/`manual`). **Passe** por-utilizador (`premium_pass` = N licenças + fim absoluto; `premium_pass_activation` = servidores ativados): `grantGuildPass`/`activateSeat`/`deactivateSeat` — o relógio corre no passe, `isGuildPremium` vale por linha direta **ou** por ativação de passe não-expirado. `syncDiscordEntitlements` reconcilia os entitlements nativos. | `db` |
| `premium/kofi.ts` + `kofiWebhook.ts` | Webhook Ko-fi + servidor HTTP das APIs Premium. O webhook verifica o token, resolve memberships/shop map e regista compras idempotentemente. `POST /api/activate` exige Bearer Discord, consentimento literal/versionado, body limitado, CORS e rate bucket próprio; aplica todas as pendentes do HMAC do email verificado e devolve só itens + confirmação. `/api/link` por recibo mantém o contrato legado. Inerte sem a configuração Ko-fi/API. | `store/premium`, `premium/statusApi`, `premium/claim` |
| `premium/statusApi.ts` | Identidade do Painel Premium. O caminho normal de `GET /api/me/premium` usa `/users/@me` com cache curto. A ativação usa um caminho separado e **sem cache**: valida `/oauth2/@me` (audience = `CLIENT_ID`, scopes `identify email`) e o mesmo user ID em `/users/@me`, exigindo email verificado. O email só existe durante o pedido, nunca é persistido ou registado. | `store/premium`, Discord OAuth2 API |
| `premium/claim.ts` | Claim por recibo e ativação por HMAC de email. `activateByEmailHash` aplica **todas** as pendentes não reclamadas numa única transação, reutiliza `markPendingClaimed`/`applyPending`, cria um confirmation ID comum e só grava o binding de renovação se uma subscrição tiver sido efetivamente aplicada. | `store/kofiPending`, `store/premium`, `store/kofiActivationConsent` |
| `store/kofiActivationConsent.ts` | Evidência mínima e versionada da ativação imediata: uma linha por transação com confirmation ID, Discord ID, timestamp, versão dos termos e método; nunca contém email ou email hash. A escrita participa na mesma transação SQLite do grant. | `db` |
| `i18n/index.ts` | `t(key, locale, params)` — tradução pura da UI com fallback (`locale` pedido → `en` → própria `key`) e interpolação de `{param}`. `DEFAULT_LOCALE='en'`, `SUPPORTED_LOCALES` (35 locales de UI, ver `i18n/index.ts` + `i18n/locales/*.ts`), `LOCALE_DISPLAY_NAMES` (endónimos das choices de `/config language`). | `i18n/catalog` |
| `i18n/catalog.ts` | Catálogo de strings da UI por chave, com `en` (base) e `pt`. | — |
| `textCleaning/clean.ts` | Funções puras de limpeza: URL→"link", menções `@id`/`#id`→nome, remover code blocks, colapsar repetições, truncar a `maxChars`. **Strip de emoji alargado**: pictograma base + componentes zero-width (ZWJ `U+200D`, VS16 `U+FE0F`, keycap `U+20E3`) + regional indicators (bandeiras). Nomes resolvidos via callbacks. | — |
| `textCleaning/abbreviations.ts` | `expandAbbreviations(text)`: expande gírias/abreviaturas de chat **só inglesas** (ex. `btw`→"by the way") para o TTS soar natural. Dicionário **EN-only, auditado anti-colisão** (cada chave re-vetada contra palavras comuns das línguas latinas suportadas), aplicado em **QUALQUER** língua (um "brb" é "brb" em qualquer chat — sem argumento de língua). Match por fronteira de palavra `\p{L}\p{N}`. `isAllEnglishAbbrev(text)`: true se todos os tokens (ignorando pontuação envolvente) forem chaves do dict — usado para `forceLang='eng'`. | — |
| `textCleaning/userAbbrev.ts` | `applyUserAbbrev(text, entries)`: aplica as abreviaturas **pessoais** do utilizador (termo → substituição). **Passagem única** (uma alternação sobre todos os termos, um só `replace` com replacer-função): corta cascata/re-expansão (anti billion-laughs DoS) e insere o replacement **literalmente** (sem interpretar `$&`/`$$`). Teto de saída (`MAX_ABBREV_OUTPUT`). | `store/userAbbrev` |
| `textCleaning/pronunciation.ts` | `applyPronunciation(texto, dict)`: aplica o dicionário de pronúncia da guild ao texto limpo. | — |
| `language/detect.ts` | `detectLang(texto)` → código ISO 639-3 ou `''`. Consulta primeiro o **léxico de saudações** (`greetings.ts`) e só depois o `franc`. `detectLangDetailed` devolve `{lang, confident}` (léxico=certo; franc=confiante se a margem topo–2.º ≥ 0.10) — usado pela memória de língua. | `franc`, `greetings` |
| `language/greetings.ts` | `lookupShortLang(texto)`: léxico curado de saudações/palavras curtas → ISO 639-3 (o franc falha em texto curto: "ola"→und). Baseado no TEXTO (serve `/tts` e canal). Tokens ambíguos deliberadamente fora. | — |
| `language/voiceMap.ts` | `pickVoiceForLang(lang, available, preferred)`: honra a voz **preferida** se já estiver na língua, senão escolhe um modelo dessa língua por prefixo de locale (fallback à preferida). `pickVoice(lang, available, fallback)`: variante que mapeia a língua ao modelo por prefixo, senão devolve o fallback. `LANG_TO_PREFIX` cobre todos os modelos Piper. `modelDisplayName`/`LOCALE_NAMES`: nome amigável (endónimo) por locale de modelo, para os dropdowns. `syntheticGttsModels(piperModels, neural)`: para cada locale de `LOCALE_NAMES` sem modelo Piper no disco injeta uma voz `{locale}-google-medium` no catálogo — as línguas aparecem (e falam via Google) mesmo com `./models` vazio. | — |
| `tts/engine.ts` | Interface `TTSEngine { synth(req): Promise<audioPath> }` e tipo `SynthRequest` (inclui `emphasisSource` — o texto do UTILIZADOR de onde se calcula a ênfase, isolado do que o bot injeta como o prefixo xsaid, para não haver falso-grito). | — |
| `tts/factory.ts` | `createEngine(config, cache)` seleciona o motor (Piper default; Neural atrás de flag). `selectEngine(base, config, models, cache)` (puro) embrulha o base num `MultiSegmentEngine` **só** se a flag `multilingualSegments` estiver ON; senão devolve o `base` por identidade (`===`). | `config`, `cache`, `piper`, `neural`, `multiSegment` |
| `tts/circuitBreaker.ts` | `CircuitBreakerEngine` protects the legacy **gTTS** path when the operator explicitly selects `TTS_ENGINE=gtts` or `router`. After the configured consecutive-failure threshold it serves local Piper directly for the cooldown period, then probes gTTS once. | `engine`, `logging` |
| `tts/piper.ts` | `PiperEngine`: sintetiza via Piper → WAV, timeout + erro/EPIPE, cache-first. **Pool persistente ON por defeito (T2.1):** reutiliza processos piper quentes (~4× no caso quente, curto 408→99 ms, áudio idêntico); falha → fallback one-shot; desliga com `PIPER_PERSISTENT=0`. Spawns limitados por **semáforo global** (`PIPER_MAX_CONCURRENCY`, default `núcleos-1`). | `cache`, `piperPool`, `semaphore`, `node:child_process` |
| `tts/piperPool.ts` | `PiperProcess` (1 processo piper longo; JSON no stdin → path no stdout em FIFO) + `PiperPool` (LRU keyed por `model\|length_scale`, `PIPER_WARM_VOICES` default 3, idle-timeout, evict/shutdown). | `logging` |
| `tts/semaphore.ts` | `Semaphore` FIFO assíncrono (`tryAcquire` síncrono / `acquire` espera): limita concorrência de spawns do Piper (T1.3). | — |
| `tts/neural.ts` | `NeuralEngine` (OpenAI tts-1) atrás de flag; síntese real é verificação ao vivo pendente. | `cache` |
| `tts/kokoroEngine.ts` | `KokoroEngine` is an opt-in local ONNX/CPU sidecar with warm-up, FIFO work, and timeouts. Unsupported languages or sidecar failures use the configured default engine (normally local Piper). | `cache`, `router`, `spokenPhrases`, `node:child_process` |
| `tts/gcloud.ts` | `GCloudEngine` is the official Google Cloud TTS Premium route. It counts real cache-miss characters, enforces per-request/month/day budgets before spending, and falls back to the configured default. Without `GOOGLE_TTS_API_KEY`, the route is not constructed. | `cache`, `gcloudUsage`, `metrics`, `deCaps`, `wavConcat` |
| `tts/resolveEngine.ts` | `resolveUserEngine` centralizes the Kokoro/Google HD Premium gate and Google budget descriptor across every speech call site. A paid-engine choice without active Plus or server Premium is downgraded to the configured default (historical database value `google`; Piper under the safe default configuration). | `store/premium`, `store/userVoice` |
| `tts/segments.ts` | `detectSegments(text)` (puro): parte o texto em segmentos de língua por **run de script** (Latin/Cyrillic/CJK/Arabic — fronteira fiável), deteta a língua de cada pedaço (só ≥ `MIN_DETECT_CHARS`), herda vizinhos e funde consecutivos. | `language/detect` |
| `tts/wavConcat.ts` | `concatWavs(wavs)` (puro): faz parse/valida WAVs PCM Piper (22050 Hz / mono / 16-bit), concatena com silêncio anti-clique entre segmentos e reconstrói o header RIFF. Exporta também `parseWav`/`buildWav`. | — |
| `tts/deCaps.ts` | `lowerAllCapsRuns(text)` (puro): baixa corridas de 2+ MAIÚSCULAS para o motor **não SOLETRAR o "grito"** (lê a palavra). Usado pelo gTTS (`deCapsForGoogle`) e aplicado também no Kokoro/Neural; o Piper é no-op (lê maiúsculas como palavra). O ganho de volume do grito é à parte (`emphasis.ts`, no player). | — |
| `tts/emphasis.ts` | `emphasisStrength`/`expressiveEmphasisStrength` (puros) classificam `!`/MAIÚSCULAS; `emphasisGain` converte a mesma classificação em volume no player. Só uma exclamação terminal ou uma frase totalmente em maiúsculas recebe também contorno de pitch, evitando enfatizar a palavra errada em `wow! okay`. Calculado do `emphasisSource`, não do texto decorado. | `prosody`, `player` |
| `tts/prosody.ts` | `ProsodyEngine` (decorator): **entoação de pontuação independente do idioma** — perguntas sobem o tom final; exclamações/uma frase toda em maiúsculas recebem uma queda curta e continuam a usar o ganho de volume do player. Reconhece também `؟`, `？`, `՞`, `፧`, `！` e `՜`; usa `emphasisSource` para ignorar prefixos/sufixos injetados pelo bot. Áudio fora de 22050/mono/16 (ex. Kokoro 24 kHz) é normalizado primeiro. Cache própria `q`; qualquer erro → voz limpa (**nunca lança**). Fica entre `selectEngine` e `EffectEngine`. | `emphasis`, `effects`, `wavConcat`, `cache` |
| `tts/multiSegment.ts` | `MultiSegmentEngine` (decorator de `TTSEngine`, **experimental**): para texto multi-língua, sintetiza cada segmento com a voz da sua língua e concatena os WAVs (namespace de cache `multiseg`). 0–1 segmento → delega no base intacto; qualquer erro → fallback single-voice. | `segments`, `wavConcat`, `voiceMap`, `cache` |
| `tts/cache.ts` | `AudioCache`: chave `sha1(texto+modelo+velocidade)`, namespaces por motor, eviction por mtime. Conta hits/misses em `metrics`. | `metrics`, `node:fs` |
| `voice/queue.ts` | `PlayQueue`: duas filas FIFO com cap partilhado; prioridade de acessibilidade em bursts limitados, para não impedir a fila normal. | — |
| `voice/player.ts` | `GuildVoicePlayer` per guild: `VoiceConnection` + `AudioPlayer` + two-lane FIFO queue + `say()` (boolean), `isActive()`, and `skip()` with `pendingSkip`. It waits for `entersState(Ready)` before playback. Call departure is owned by the presence/alone watcher, not a duplicate inactivity timer. | `@discordjs/voice`, `queue`, `metrics`, `logging` |
| `voice/aloneWatcher.ts` + `voice/rejoin.ts` + `store/voicePresence.ts` | **Presença de voz e retoma controlada.** O `AloneWatcher` só expulsa quando o canal fica SÓ com bots; o dep `isPremium` faz servidores Premium ficarem na call **mesmo sozinhos**. A presença (canal) é persistida em `voice_presence` ao entrar e apagada em saídas normais, mas não no shutdown. No `ClientReady`, `planRejoin` (puro) restaura apenas Premium com 24/7 ou todas as calls após um deploy marcado, uma única vez; crashes e restarts manuais não restauram calls gratuitas. | `store/premium`, `@discordjs/voice` |
| `voice/greeting.ts` | Saudação de voz ao ENTRAR na call: `isJoinIntoChannel(old,new,bot)` (puro — deteta entrada no canal do bot), `buildGreeting({locale,name,…})` → `SynthRequest` ("Olá {nome}" na língua escolhida + voz dessa língua; fallback inglês), `GREETINGS`/`GREET_LANGUAGE_CHOICES`/`GREET_LOCALES`. O gatilho vive no `VoiceStateUpdate` (client.ts `greetOnJoin`): humano entra → `player.say`. Config: `greet_on_join` (default ON), `greet_locale` (default 'en'). | `engine` |
| `voice/greetCooldown.ts` | `GreetCooldown.shouldGreet(guild,user)`: cooldown de 5 min (`GREET_COOLDOWN_MS`) por (guild,user) da saudação — spam de entrar/sair da call não repete o "Olá {nome}"/parabéns. Janela fixa (pedido suprimido não a estende), memória capada, relógio injetável. Consultado no `greetOnJoin`. | — |
| `health/ffmpeg.ts` | `checkFfmpeg(getInfo?)`: health-check do binário ffmpeg no boot (via `prism-media`), com veredicto `{ok,version}`/`{ok:false,error}` e mensagem acionável (comando de correção no Windows). Injetável para testes. | `prism-media` |
| `moderation/filter.ts` | `isBlocked(texto, blocklist)`: verifica a blocklist (pré-síntese). | — |
| `moderation/rateLimiter.ts` | `RateLimiter` (token bucket) por-utilizador; poda preguiçosa de buckets cheios+inativos acima de `MAX_BUCKETS` (5000). | — |
| `moderation/antispam.ts` | Anti-spam de leitura (opt-in por guild, `guild_config.antispam`, default OFF): `isRepetitionSpam(texto)` (puro — muitos tokens + baixa diversidade, ex. "POKEBOLAS ×39") e `DuplicateTracker.isDuplicateSpam(guild,autor,texto,now)` (mesma pessoa a repetir a mesma msg grande em <60s, janela fixa, memória capada). Gate no `messageHandler` antes do `lastSpeaker`/`bumpTalk`. | — |
| `moderation/countGate.ts` | Anti-spam da CONTAGEM do `/top-speakers` (NÃO da leitura): `CountGate.shouldCount(guild,user,texto,now)` decide se uma mensagem lida conta para o ranking. SEMPRE ativo (sem config): cooldown 5s + dedup do conteúdo anterior + cap 10/min por-(guild,user); memória capada. Uma msg barrada é falada na mesma, só não conta nem dispara o 🔥. Envolve o `bumpTalk` no `messageHandler`. | `moderation/antispam` (normalize) |
| `commands/voiceConfigPanel.ts` | Lógica PURA do painel `/voice config` (dropdowns + botão Guardar; nada é gravado até Guardar, evita o Enter acidental de um comando com opções). `seedPanelState` (semeia do estado atual), `localesOf`/`voicesForLocale`/`needsVoiceRow` (agrupamento por língua), `paginateLocales` (24 línguas/página + sentinela "Mais" — o select do Discord só aceita 25), `SPEED_PRESETS` (velocidades válidas por construção), `validateSave` (gate gcloud→Premium). A cola discord.js (`handleVoiceConfig`) vive em `handlers/voice.ts` e é verificada ao vivo. | `voiceMap` (`modelDisplayName`) |
| `commands/index.ts` | Definições dos slash commands (`commandDefs`) e `handleInteraction` (join, leave, tts, skip, **laugh**, **joke**, voice, config, stats, **help**, **setup**). Toda a UI passa por `t()`/`localeFor(deps, guildId)`. | tudo acima |
| `commands/messageHandler.ts` | `handleMessage`: pipeline de auto-leitura/menção/reply em `messageCreate`. | store, textCleaning, moderation, prepareSpeech |
| `commands/prepareSpeech.ts` | `prepareSpeech` (partilhado por `/tts` e leitura de canal): texto→`SynthRequest`. A voz escolhida é fixa por defeito; a deteção automática está default OFF; opt-in via `/voice detection on`. Quando ligada, deteta a língua-base da mensagem e separa gíria inglesa conhecida para a voz inglesa. Aplica gírias embutidas + `/pronunciation` + restauro de acentos. Decora com o xsaid (prefixo "{nome} disse") e o sufixo de media, localizados na língua da voz. | `voiceMap`, `abbreviations`, `pronunciation`, `accents`, `spokenPhrases` |
| `content/jokes.ts` | Catálogo de piadas curtas multilingue (35 línguas) + `JOKE_LANGUAGES` (autocomplete `idioma`), `jokeLangByKey`, `pickJoke(langKey, seed)` (puro/seeded). Usado pelo `/joke`. | — |
| `content/pickupLines.ts` | Banco de pick-up lines (frases de engate) multilingue — REUTILIZA `JOKE_LANGUAGES` (35 línguas) + `pickLine(key, seed)` (puro/seeded, fallback EN). Usado pelo `/rizz`. | `content/jokes` |
| `leaderboard/randomPost.ts` | `LeaderboardPoster` (F2): decide por ATIVIDADE (mensagens lidas + limiar + cooldown + sorteio; relógio/aleatoriedade injetáveis) quando postar o top de tagarelas no canal do `/setup`. `renderLeaderboard(rows, locale)` (puro) monta o texto (menções suprimidas). Estado em memória por-guild; instância no `BotDeps`. | `store/talkStats`, `i18n` |
| `votePromo.ts` | Rotação promocional opt-in por servidor: depois de atividade suficiente, reserva de forma persistente um único slot por 24h e alterna Top.gg → suporte → Top.gg. Assim cada cartão fica pelo menos 48h afastado do mesmo tipo e nunca há dois no mesmo dia, mesmo após restart. | `store/db`, `i18n`, `ui/messages` |
| `store/talkStats.ts` | "Tagarelas" (`/top-speakers`): `bumpTalk` (conta +1 e atualiza o streak Duolingo) e `getTopSpeakers` — ranking por **nº de mensagens** (`spoken_count`) desc, desempate pelo streak VIVO (`effectiveStreak`). O streak é decoração (🔥) + tiebreak, não a chave. A contagem é filtrada a montante pelo `moderation/countGate`. | `db` |
| `content/laughter.ts` | `laughterFor(prefix)`: riso localizado pela língua da voz (ex. cirílico para `ru_`), com fallback "hahaha". Usado pelo `/laugh` e pelo `/joke` (opção `risos`). | — |
| `games/manager.ts` | `GameManager`: **1 jogo ativo por guild** (lock; há 1 só ligação de voz por guild). `handleMessage` encaminha as mensagens do **canal do jogo** para a partida e devolve `true` (consumida → o `handleMessage` do TTS salta essa mensagem). Possui os timers da sessão (cancelados **sempre** no fim); persiste pontos no fim **normal** (`end`), descarta no fim **forçado** (`stop`/`endGuild`). Desacoplado de discord.js/SQLite via `GameEnv`. | `games/types` |
| `games/types.ts` | `Clock` (relógio + timers **injetáveis**, `systemClock`; testes deterministas), `GameContext` (`say`/`send`/`t`/`after`/`award`/`end` + `seed`/`locale`/`defaultVoice`), `Game`, `GameDefinition`, `GameEnv`. | — |
| `games/quizGame.ts` | Base `QuizGame` dos 7 jogos "voz → 1º a acertar" (loop de N rondas, timeout com **guarda de ronda**, placar local, resumo final `game.finish.*`). Cada jogo concreto só implementa `prepare`/`makeRound`/`emptyMessage`. | `games/types` |
| `games/finish.ts` | `bump`/`sendStandings`: placar partilhado pelos jogos que **não** assentam no `QuizGame` (Reflexos, Vozen Diz). | `games/types` |
| `games/*.ts` | Os 16 jogos: `guessLanguage`, `math`, `skipCount`, `spelling`, `spellOut`, `fastSpeech`, `accentSwap` (voz, sobre `QuizGame`); `reflexes`, `vozenSays`, `roulette` (timing/one-shot); `hangman`, `wordle`, `tictactoe`, `chess` (tabuleiro, texto — `chess` é 💎 Premium, `GameDefinition.premium`, tabuleiro em **application emojis** cburnett via `games/boardEmojis.ts` carregados no `ClientReady` para `GameEnv.boardEmojis`, com fallback ASCII; assets em `assets/chess/`, upload one-off via `tools/upload-app-emojis.mjs`; `wordle` desenha a grelha em tiles-emoji A–Z coloridos com fallback ANSI). Conteúdo *seeded* em `games/content/*`. | `games/*`, `content` |
| `games/index.ts` | Registo `GAME_DEFS` (16 jogos, incl. Heads or Tails) + `gameById`/`filterGameChoices` (autocomplete com nomes na língua do utilizador). Adicionar um jogo = criar o ficheiro e listá-lo aqui. `/game play` SEM jogo mostra um select menu (beginner-friendly). | todos os jogos |
| `commands/handlers/personal.ts` | Ferramentas pessoais: `/pronunciation add\|remove\|list` (dicionário individual, `add` vazio abre um MODAL) e `/randomizer` (sorteio falado: `amount` 2–5 → modal, `options` csv, ou select do nº quando corrido vazio; fala via `speakRawText`). | `store/pronunciation`, `store/premium`, `handlers/core` |
| `store/gameScore.ts` | Leaderboard SQLite (tabela `game_score`): `addPoints`/`addWin`/`persistGameScores` (transação: soma pontos + `+1 vitória` a quem mais pontuou), `getLeaderboard`/`getUserScore`/`getUserRank`. | `db` |
| `bot/welcome.ts` | `pickWelcomeChannel(guild)` + `buildWelcomeEmbed(locale)` (puros): escolha do canal e embed de boas-vindas no `guildCreate` (onboarding). | `i18n`, `discord.js` |
| `bot/client.ts` | `createClient` (intents + partials) e `bindEvents` (eventos do gateway + handlers globais `unhandledRejection`/`uncaughtException`; `guildCreate`→welcome; `guildDelete`→`handleGuildDelete`). | `discord.js`, `commands`, `welcome` |
| `bot/deps.ts` | Tipo `BotDeps` (injeção de dependências) e helpers `getPlayer`/`removePlayer`/`getLimiter`/`handleGuildDelete` (liberta limiter **e** player ao sair de uma guild). | — |
| `bot/registerCommands.ts` | Regista os slash commands na API REST do Discord. | `discord.js`, `commands` |
| `bot/shutdown.ts` | `shutdown` (destrói players + fecha DB, idempotente) e `installSignalHandlers` (SIGINT/SIGTERM). | `logging` |
| `logging/logger.ts` | Logger estruturado com níveis e timestamps (`LOG_LEVEL`). | — |
| `metrics.ts` | Singleton de contadores em memória (`messagesSpoken`, `cacheHits`, `cacheMisses`, `synthErrors`, `voiceDrops`, `voiceReconnects`, `votes`) + **latência de síntese** (`recordSynthMs` → janela deslizante; `synthCount`/`synthP50Ms`/`synthP95Ms` no snapshot, mostrados em `/stats`). | — |
| `index.ts` | Entry point: `loadConfig` → `initDb` → `AudioCache` → `createEngine` → descobre modelos → cria cliente + `BotDeps` → `bindEvents` + `installSignalHandlers` → regista comandos → login. | tudo acima |

### Comandos

`/help` (embed agrupado — Geral / Voz / Admin — derivado de `commandDefs`),
`/setup` (onboarding guiado, admin; auto-join via `joinUserVoice`),
`/join`, `/leave`, `/tts <texto>`, `/skip`,
`/laugh` (o Vozen ri na voz atual do utilizador; `content/laughter.ts`),
`/joke <idioma> <risos>` (piada curta na língua escolhida — `idioma` por autocomplete
sobre 35 línguas; `risos` acrescenta o riso da língua no fim; `content/jokes.ts`),
`/rizz <language> <sound>` (pick-up line na língua escolhida — mesmo autocomplete do
`/joke`; `sound` toca o efeito sonoro `assets/sfx/rizz.wav` no fim via `SynthRequest.assetPath`,
que o player reproduz DIRETO, sem motor/cache; `content/pickupLines.ts`),
`/voice set|list|reset|optout|optin|preview`,
`/voice abbrev add|remove|list` (abreviaturas **pessoais** por-utilizador, **globais**,
cap 10; `store/userAbbrev.ts` + `textCleaning/userAbbrev.ts`, tabela `user_abbreviation`),
`/config` (admin: tts-channel, autoread, max-chars, rate-limit, role, enabled,
default-voice, **language**, show, reset, + subgrupos `blockword` e `pronunciation`),
`/game play|stop|list|leaderboard|stats` (minijogos — ver abaixo),
`/stats` (admin).

### Minijogos (`/game`)

**16 jogos** de grupo, geridos pelo `GameManager` (`src/games/`): **1 jogo ativo por
guild** de cada vez. O comando `/game play <jogo>` arranca (autocomplete com os nomes
na língua de quem invoca; jogos de **voz** exigem o bot numa call — `needsVoice`),
`/game stop` pára, `/game list` lista, `/game leaderboard` mostra o top do servidor e
`/game stats` as estatísticas do próprio (pontos, vitórias, posição). O leaderboard
persiste em `game_score` (`store/gameScore.ts`).

Cada partida corre numa **thread descartável** criada a partir do canal do `/game play`
(`games/thread.ts`): os palpites ficam contidos na thread (não afogam o canal em
servidores grandes), o `channelId` da sessão passa a ser o da thread e o `parentChannelId`
guarda o canal original. No fim, o **vencedor** (por pontos) é anunciado no **canal-pai**
(sobrevive) e a thread é apagada `THREAD_DELETE_DELAY_MS` depois. **Fallback**: canais sem
threads (voz/DM) ou sem permissões → joga no próprio canal, como antes. Os jogadores
respondem na thread (ou no canal, no fallback); o `GameManager.handleMessage` consome essas
mensagens (não são lidas em voz alta). Os timers usam um `Clock` injetável e são cancelados
no fim (o timer do apagar-thread é independente da sessão, um one-shot no clock). Uma saída de **voz** (`removePlayer` → `onVoiceLeft`) só termina
jogos que **precisam de voz** (um jogo de tabuleiro sobrevive a uma saída de voz não
relacionada); a guild ser **removida** (`handleGuildDelete` → `endGuild`) termina qualquer
jogo (sem leak). Famílias:
- **Voz → 1º a acertar** (base `QuizGame`): Adivinha a Língua, Matemática Falada,
  Contagem Sabotada, Ditado, Soletrado ao Contrário, Velocidade Estúpida, Sotaque Trocado.
- **Timing / one-shot**: Reflexos, Vozen Diz, Roleta (Verdade ou Consequência).
- **Tabuleiro (texto, jogadas por letra/palavra/número)**: Forca, Termo/Wordle, Galo —
  `needsVoice=false`, com timeout de inatividade (3 min).

Todo o texto passa por `t()` (chaves `game.*`; `en` fonte + `pt`); o conteúdo *seeded*
(bancos de palavras/frases/desafios) vive em `games/content/*`. No **fim** de cada
partida com vencedor, o Vozen anuncia-o **em voz alta** (`announceWinner`, chave
`game.finish.winnerVoice`) — on-brand; é no-op se o bot não estiver numa call (jogos
de tabuleiro sem voz).

A **interface está em inglês por defeito** (`guild_config.locale='en'`); cada guild
pode trocar com `/config language` (35 locales de UI). Todo o texto de resposta passa por
`t(key, locale, params)` com `locale = localeFor(deps, guildId)` (default `'en'`,
inclusive em DMs).

## Fluxo mensagem → fala

Pipeline de auto-leitura em `commands/messageHandler.ts` (`handleMessage`), pela
**ordem real** do código:

1. **Ignorar**: mensagem de bot, sem guild, ou sem `content` → sai.
1b. **Minijogo ativo** (`deps.games?.handleMessage`): se houver um jogo `/game` a decorrer
   **no canal desta mensagem**, ela é entregue à partida (um potencial palpite) e o
   pipeline sai **sem** a ler em voz alta — as respostas dos jogadores não são TTS. Vem
   **antes** do rate-limit/auto-leitura (um palpite não gasta rate-limit nem exige canal
   configurado). As próprias mensagens do bot já foram filtradas no passo 1.
2. **Kill-switch da guild**: se `guild_config.enabled` for falso → sai.
3. **Trigger**: continua só se for canal de auto-leitura (`autoread` + canal igual a
   `tts_channel_id`), **ou** menção ao bot, **ou** reply ao bot. Senão → sai.
4. **Gating por role**: se a guild definiu `tts_role_id`, o autor tem de ter esse role
   (membro ausente → ignora). Aplica-se a canal **e** menção **e** reply.
5. **Opt-out por utilizador**: só silencia a leitura **passiva** do canal de
   auto-leitura. Uma menção/reply é ação explícita do utilizador e **não** é
   bloqueada pelo opt-out.
6. **Player ativo**: tem de existir um `GuildVoicePlayer` nesta guild (criado por
   `/join`). Senão → sai.
7. **Rate-limit por utilizador**: token bucket por guild (`ratePerMin`); se exceder → sai.
8. **Limpeza** (`cleanText`, inclui o strip de emoji alargado e truncar a `maxChars`).
9. **Guard de legibilidade**: exige pelo menos **uma letra ou número** (`/[\p{L}\p{N}]/u`).
   Cobre o vazio `''` e também texto que ficou só com pontuação, símbolos ou resíduo
   zero-width do strip de emoji (rede de segurança) → nesse caso descarta.
9b. **Anti-spam** (só se `guild_config.antispam` ON, default OFF): `isRepetitionSpam(cleaned)`
   OU `DuplicateTracker.isDuplicateSpam(...)` → descarta em silêncio (com log). **Antes** do
   `lastSpeaker`/`bumpTalk` — uma mensagem saltada não conta. Ver `moderation/antispam.ts`.
10. **Abreviaturas pessoais + gírias EN**: primeiro `applyUserAbbrev(cleaned, …)`
    (abreviaturas **pessoais** do utilizador, globais — precedência pessoal > embutido),
    depois `expandAbbreviations(personal)` — gírias **só inglesas**, aplicadas em qualquer
    língua (**sem** argumento de língua). Sobre o texto já com as abreviaturas pessoais
    calcula-se `forceLang = isAllEnglishAbbrev(personal) ? 'eng' : undefined`, que força a
    voz inglesa quando a mensagem é só gírias EN. Aplicado **depois** do `cleanText` e
    **antes** da pronúncia.
11. **Pronúncia** (`applyPronunciation`): aplicada **depois** das gírias e **antes** da
    blocklist, para que o texto realmente falado seja o que é verificado e guardado (a
    pronúncia opera sobre a palavra já expandida).
12. **Blocklist** (`isBlocked`) → se bater, bloqueia (sem falar).
13. **Resolver voz** (`prepareSpeech`): ver "Precedência de voz" abaixo.
14. **`player.say(req)`** → enfileira na lane FIFO apropriada e devolve **boolean** (ver invariantes); a
    síntese acontece no worker (`playNext`), não no `say`, para preservar a ordem de chegada.
    Depois do `say`, e SÓ se a fala foi enfileirada: **streak 🔥** (F1 — `bumpTalk` devolve
    `firstOfDay`/`streak`; na 1.ª mensagem do dia, do Dia 2 em diante, com `streakAnnounce`
    ON, anuncia "🔥 Dia N" no canal) e o **leaderboard automático** (F2 — `LeaderboardPoster`
    posta o top no canal do `/setup` de vez em quando). Ambos best-effort — um envio falhado
    NUNCA parte a fala.
15. **Worker (`playNext`)**: sintetiza → espera `entersState(Ready)` da ligação **antes**
    de `play()` (a 1.ª fala numa ligação lenta não vai para o vazio) → toca em sequência;
    `/skip` corta a atual (ou descarta o item na janela de síntese via `pendingSkip`).
16. **Call departure**: `AloneWatcher` leaves when no human remains in the voice channel.
    Premium 24/7 mode suppresses that departure; there is no duplicate inactivity timer.

`/tts` reutiliza o mesmo sub-pipeline (rate-limit → cleanText → guard L/N →
abreviaturas pessoais + gírias EN → pronúncia → blocklist → prepareSpeech →
`say`), **mas não** está sujeito a gating por role nem a opt-out: é ação explícita do
utilizador (escreve o comando), não leitura passiva. O `/voice preview` toca **uma voz
específica** (demo) e por isso constrói o `SynthRequest` diretamente. `/tts` e
`/voice preview` **usam** o boolean de `say()` para responder
com verdade — `tts.queued` se entrou na fila, `tts.busy` se a fila estava cheia; a
auto-leitura ignora o valor.

`/laugh` e `/joke` também têm rate-limit por-utilizador (mesmo limiter do `/tts`) e
constroem o `SynthRequest` diretamente (a língua é conhecida — a voz atual do user no
`/laugh`, a língua escolhida no `/joke` — não detetada).

### Precedência de voz (`prepareSpeech` + `pickVoiceForLang`)

A deteção automática está **desligada por defeito**. Nesse estado, `prepareSpeech` usa a
voz preferida, `singleVoice`, sem olhar para a língua do texto:

1. **Voz preferida** — por precedência: voz guardada do utilizador (`user_voice`) →
   `guild default_voice` (se não-vazio) → `.env DEFAULT_VOICE` → `'en_US-amy-medium'`.
2. Essa voz lê **tudo**, em qualquer língua (a pessoa soa sempre igual). O restauro de
   acentos usa a língua **da voz** (`accentLangOfModel`), não a do texto.

Com `/voice detection on`, o estado persistido por utilizador+guild faz `prepareSpeech`
detetar a língua-base e escolher uma voz dessa língua; gíria inglesa conhecida pode formar
segmentos ingleses separados. `pickVoiceForLang` e o `MultiSegmentEngine` executam esse
caminho opt-in. A **velocidade** vem
da voz guardada do utilizador, senão é **sempre** `defaultSpeed` (`DEFAULT_SPEED`); o
`default_voice` da guild define apenas o modelo, nunca a velocidade.

## Decisões de arquitetura

- **(a) TypeScript CommonJS.** `package.json` **não** tem `"type": "module"`; os imports
  internos são **sem `.js`**; o `tsconfig.json` usa `module: NodeNext` /
  `moduleResolution: NodeNext` com `target ES2022`. Corre em Node no Windows e
  Dockeriza-se depois sem reescrever ESM.

- **(b) Engine factory.** `createEngine(config, cache)` escolhe o motor. **Piper é o
  default** (self-host, sem API key). O `NeuralEngine` (OpenAI tts-1) está atrás da flag
  `TTS_ENGINE=neural` **e** exige `OPENAI_API_KEY` — sem a key, `createEngine` falha
  rápido com mensagem clara. Um `TTS_ENGINE` inválido degrada para `piper` com aviso
  (o default seguro), em vez de crashar o arranque por um typo. Toda a app fala com a
  interface abstrata `TTSEngine`, por isso trocar de motor não toca no resto.

- **(c) A voz é fixa por defeito; deteção é opt-in.** `prepareSpeech` usa a voz
  **preferida** (user-voice > `guild default_voice` > `.env DEFAULT_VOICE` >
  `'en_US-amy-medium'`) em `singleVoice` enquanto a deteção estiver OFF. O utilizador pode
  ativar deteção por mensagem com `/voice detection on`; a opção persiste por guild+user e
  pode trocar para a voz da língua detetada. Ver "Precedência de voz" acima.

- **(d) Gating por canal e por role como checks standalone.** O trigger (canal de
  auto-leitura, menção, reply) e o gating por role são verificações separadas **após** o
  trigger, para que o gating se aplique a canal **+** menção **+** reply de forma
  uniforme. `/tts` e `/voice preview`, por serem ações explícitas, ficam fora do gating
  por role e do opt-out.

- **(e) Cache de áudio por namespace de motor + eviction por mtime.** A chave é
  `sha1(texto + modelo + velocidade)`. `AudioCache.withNamespace('piper'|'neural')`
  isola fisicamente as caches por motor (`<dir>/<namespace>/`), evitando que um motor
  sirva áudio produzido pelo outro. Ao exceder o número máximo de ficheiros (500),
  removem-se os mais antigos por `mtime` (LRU aproximado), excluindo sempre o recém-escrito.

- **(f) SQLite via `better-sqlite3` (WAL).** Zero setup, ideal para correr no PC. As
  tabelas novas são criadas com `CREATE TABLE IF NOT EXISTS` (não destrutivo) e as
  migrações de coluna são idempotentes: lê `PRAGMA table_info(...)` e só faz
  `ALTER TABLE ... ADD COLUMN` quando a coluna falta (no-op em DBs novas). O `initDb`
  envolve abrir + schema num try/catch que fecha o handle e dá mensagem clara em caso
  de ficheiro inválido/sem permissões.

- **(g) i18n com inglês por defeito e fallback que nunca crasha.** A interface é
  traduzida por `t(key, locale, params)`; `en` é a base e o default (`guild_config.locale`
  arranca em `'en'`). A cadeia de resolução é `locale pedido → en → própria key`, e os
  `{param}` ausentes ficam intactos — nenhuma chave em falta rebenta a resposta. Hoje
  `SUPPORTED_LOCALES` (35 locales de UI); adicionar um locale a esse array **sem** o mapear
  em `LOCALE_DISPLAY_NAMES` é erro de compilação (mapas nunca dessincronizam em silêncio).
  Nota: o idioma da **voz/TTS** é independente da língua da **interface** e não passa
  pelo i18n (`LOCALE_NAMES`/`modelDisplayName` em `voiceMap.ts` são um mapa distinto).

- **(h) Multi-segmento multi-língua atrás de flag (default ON — `MULTILINGUAL_SEGMENTS`).** `selectEngine` é uma
  função **pura** que, só com `multilingualSegments` ON, embrulha o motor base num
  `MultiSegmentEngine`; com a flag OFF devolve o base por identidade (`===`), pelo que o
  caminho de síntese fica byte-a-byte o de hoje (voz única para a frase). O
  `MultiSegmentEngine` guarda o WAV combinado num namespace de cache separado (`multiseg`)
  e cai em single-voice perante qualquer erro — o player recebe sempre um WAV.

- **(i) Invariantes do player como contrato.** `say()` devolve boolean (só o sinal
  **síncrono** de fila-cheia/destruído); o worker espera `entersState(Ready)` antes de
  tocar; o handler `'error'` do `AudioPlayer` **não** drena a fila (evita double-fire com
  o `Idle`); `handleDisconnect` tem guard `destroyed` + `onIdle` identity-aware. Ver
  **Fiabilidade**.

## Fiabilidade

A robustez é requisito do wedge, não um extra:

- **Health-check do ffmpeg no arranque.** `checkFfmpeg()` faz `FFmpeg.getInfo()` (via
  `prism-media`) no boot e, se o binário faltar ou for da plataforma errada, dá um erro
  **acionável** logo no arranque (com o comando de correção no Windows) em vez de rebentar
  tarde na 1.ª reprodução com um `unhandledRejection` cru.
- **Esperar `Ready` antes de tocar.** No worker, `entersState(connection, Ready, 10s)`
  corre **depois** da síntese e **antes** de `play()`: numa ligação lenta / 1.ª fala a
  conexão pode ainda estar em `signalling`/`connecting` e tocar aí mandaria o áudio para
  o vazio (sem som, sem erro). Fica depois da síntese de propósito — a ligação estabelece
  **em paralelo** com a síntese (≈ `max(ready, synth)`, não a soma). Se não ficar Ready a
  tempo, o item é saltado (não toca para o vazio) e a fila continua.
- **Auto-reconexão à voz com backoff.** Ao entrar em
  `VoiceConnectionStatus.Disconnected`, o player espera a renegociação soft do gateway
  (`Signalling`/`Connecting` → `Ready`); se não recuperar, tenta `rejoin()` manual até
  3 vezes com espera crescente. Só destrói a ligação e sai se nada disto recuperar. Conta
  `voiceDrops` uma vez por episódio e `voiceReconnects` no sucesso (soft ou rejoin), nunca
  a dobrar (guard `destroyed || reconnecting`).
- **Piper com timeout.** Cada síntese tem timeout de 15s; ao exceder, mata o processo
  (`SIGKILL`) e rejeita. Erros de spawn, código de saída ≠ 0 e EPIPE no stdin são
  tratados sem crashar; o `EPIPE` (child morreu) é engolido pois o evento `close` trata.
- **Item de síntese saltado, nunca crasha.** Se `synth` falha, o `playNext` regista,
  incrementa `synthErrors` e avança para o próximo item da fila (sem crescimento de stack).
- **Handlers globais.** `bot/client.ts` (`bindEvents`) regista `unhandledRejection` e
  `uncaughtException` que registam e mantêm o processo vivo, além de `Events.Error` do
  gateway.
- **Cap na fila.** A `PlayQueue` tem cap (default 20); uma rajada de spam não enche a
  memória — ao exceder, descarta com aviso suave.
- **Permissões em falta.** `/join` verifica `Connect`/`Speak` **antes** de tocar num
  player existente e responde com mensagem clara em vez de falhar em silêncio.
- **Graceful shutdown.** `installSignalHandlers` liga SIGINT/SIGTERM a `shutdown`, que
  destrói todos os players (sai dos canais de voz), limpa o mapa e fecha a DB — tudo
  idempotente — antes de `process.exit(0)`.

### Invariantes do player (pós-review)

Estes cinco pontos são requisitos de correção do `GuildVoicePlayer`, não otimizações:

- **`say()` devolve boolean.** Reflete só o resultado **síncrono** de enfileirar: `true`
  se entrou na fila, `false` se foi descartado (player destruído **ou** fila no cap).
  `/tts` e `/voice preview` usam-no para não mentir "queued" quando nada entrou. O
  synth-skip e a ligação-não-Ready acontecem **depois** no worker e, por design, não se
  refletem aqui.
- **`/skip` na janela de síntese (`pendingSkip`).** Se o `/skip` chega enquanto o item
  está a ser sintetizado / a aguardar `Ready` (o `AudioPlayer` real ainda está `Idle`,
  logo `stop()` é no-op), marca-se `pendingSkip` para o worker **descartar** o item
  in-flight antes de tocar. A flag é reposta no início de cada iteração (anti-leak: um
  `/skip` só afeta o item atual).
- **Handler `'error'` não drena a fila.** No `@discordjs/voice` um erro do recurso a
  tocar emite `'error'` **e depois** transita para `Idle` (síncrono, mesmo recurso). Ter
  `playNext()` no `'error'` **e** no `Idle` drenava a fila 2× (double-fire), colapsando a
  flag `playing` e podendo disparar `onIdle` a meio da fala. O `Idle` faz o único drain.
- **Player morto não derruba o substituto.** `handleDisconnect` tem guard `destroyed`
  **antes** de `destroy()/onIdle()`: se um `/join`/`/leave` substituiu este player no slot
  da guild durante a janela de rejoin, o player velho sai em silêncio — o `onIdle` é keyed
  por guild e derrubaria o substituto acabado de criar (identity-aware).
- **`isActive()`** é um predicado leve (a tocar **ou** fila não-vazia) que o `/skip` lê
  **antes** de `skip()` para distinguir "nada a tocar" de "saltei", sem alterar estado.

### Gestão de memória

- **Sair de uma guild liberta tudo.** `handleGuildDelete` (ligado a `guildDelete`) apaga a
  entrada de `limiters` (e os buckets do `RateLimiter` dentro) **e** destrói/remove o
  player — evita crescimento de memória num uptime longo.
- **Poda de buckets do `RateLimiter`.** Acima de `MAX_BUCKETS` (5000), `allow()` faz uma
  poda preguiçosa de buckets cheios+inativos, protegendo contra crescimento por muitos
  utilizadores distintos.

## Observabilidade

- **Logger estruturado** (`logging/logger.ts`): níveis `debug < info < warn < error`,
  com timestamp ISO e nível por linha; o nível mínimo lê-se de `LOG_LEVEL` (default
  `info`). `warn`/`error` vão para `stderr`, o resto para `stdout`.
- **Métricas** (`metrics.ts`): singleton de contadores em memória — `messagesSpoken`,
  `cacheHits`, `cacheMisses`, `synthErrors`, `voiceDrops`, `voiceReconnects`, `votes`.
  O comando **`/stats`** (admin) expõe os contadores relevantes (incluindo quedas e
  reconexões de voz) junto com players ativos, nº de servidores e uptime do processo.

## Onboarding

- **Welcome no `guildCreate`.** Ao entrar num servidor novo, `bindEvents` liga
  `pickWelcomeChannel` (systemChannel se o bot puder escrever lá, senão o 1.º canal de
  texto enviável, senão nada — nunca crasha) + `buildWelcomeEmbed` (em `en`, pois uma
  guild nova não tem config) e envia **uma** vez um embed que aponta para `/setup` e
  `/help` e explica claramente que Piper é grátis e Kokoro/Google HD pertencem ao Plus/Premium.
- **`/setup` guiado** (admin): valida o canal de texto (`ViewChannel`+`SendMessages`,
  cada perm com o seu estado na checklist), faz auto-join do canal de voz do invocador
  (`joinUserVoice`) e explica os próximos passos.

## Developer experience (DX)

- **CI (GitHub Actions).** Corre `build` + `typecheck` + `lint` + `format:check` +
  `vitest` em Node 22 e 24 a cada push/PR; badge no README.
- **Smoke test de boot.** Monta as `BotDeps` reais (config, DB, cache, engine, cliente)
  sem ligar ao Discord — apanha regressões de arranque sem precisar de token.
- **Health-check do ffmpeg no boot** (ver Fiabilidade): falha cedo e com mensagem
  acionável se o binário faltar.

## Limitações conhecidas

- **Self-host não é beginner-friendly.** A instância pública tem um caminho
  invite-and-go, mas operar uma instância própria exige Node, dependências nativas, o
  binário do Piper e os modelos.
- **Síntese real Piper/Neural depende de verificação ao vivo.** Os testes cobrem a
  seleção de motor e o pipeline; a geração real de WAV pelo Piper e a síntese do
  `NeuralEngine` (OpenAI) precisam de verificação ao vivo com o binário/credenciais.
- **`cacheKey` partilhado entre motores, mitigado por namespace.** A chave
  `sha1(texto+modelo+velocidade)` não inclui o motor; se um motor e outro produzissem a
  mesma chave, poderiam servir áudio errado. Isto está mitigado por
  `withNamespace('piper'|'neural')`, que separa fisicamente as caches.
- **A deteção opt-in continua imperfeita.** Por defeito, `prepareSpeech` usa a voz preferida
  do membro (ou o `default_voice` da guild), `singleVoice`, sem detetar a língua. Com
  `/voice detection on`, a língua-base é detetada, mas texto curto ou ambíguo pode manter a
  voz preferida e a mistura dentro da frase só separa gíria inglesa conhecida.
- **Multi-segmento só separa com confiança texto multi-script.** `detectSegments` parte
  por run de script (Latin/Cyrillic/CJK/Arabic). Duas línguas do **mesmo script** na
  mesma frase (ex. inglês + francês, ambos Latin) não são separadas de forma fiável — o
  texto tende a ficar num só segmento com a língua dominante. Além disso a feature está
  atrás da flag `MULTILINGUAL_SEGMENTS` (default ON) e a síntese real depende de
  verificação ao vivo.
- **`cym`/`isl`/`ltz` dormentes na deteção.** `LANG_TO_PREFIX` mapeia galês, islandês e
  luxemburguês, mas o **franc v5** não os emite (sem modelo de trigramas), pelo que hoje
  não são detetados por mensagem. As entradas ficam (corretas e forward-compatible):
  `pickVoiceForLang` é independente do franc, por isso funcionam se a fonte de deteção mudar.
- **Gírias só inglesas.** `expandAbbreviations` usa um dicionário **EN-only** (auditado
  anti-colisão), aplicado em qualquer língua. Gírias não-inglesas (pt/es/fr/…) **não** são
  expandidas de propósito: uma expansão errada é pior que nenhuma, e cada chave EN foi
  re-vetada contra palavras comuns das línguas latinas suportadas para não disparar por
  engano. Abreviaturas específicas de outra língua ficam a cargo do utilizador via
  `/voice abbrev` (pessoais) ou do admin via `/server-pronunciation` (por-guild).
- **Mobile.** Limitação estrutural da plataforma Discord (clientes móveis não tocam o
  áudio de bots de voz de forma fiável); fora de âmbito.
