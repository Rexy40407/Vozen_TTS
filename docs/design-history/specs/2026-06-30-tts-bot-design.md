Nome do produto: **Vozen** — *type it, hear it.*

# Design — TTS Bot (v0 "núcleo competitivo")

Data: 2026-06-30
Estado: spec aprovada para passar a plano de implementação

## 1. Objetivo e wedge

Construir um bot de TTS para Discord **mais bem que todos os atuais** num eixo claro:
**voz neural grátis + fiabilidade**. Os bots dominantes (líder: TTS Bot, ~1,48M servidores)
entregam voz robótica (gTTS/eSpeak) no tier grátis, escondem as boas vozes atrás de paywall,
e têm fama de instabilidade (desconexões). O cruzamento vazio que ninguém serve bem é:
**voz decente grátis + leitura automática + limpeza de texto inteligente + nunca cair do canal de voz.**

Critério de sucesso do v0: um utilizador instala, o bot entra no canal de voz, lê o que ele
escreve com voz claramente melhor que o gTTS, sem ler lixo (emojis/URLs), com a sua própria
voz por-utilizador, sem crashar nem desconectar, e sem custo por caráter.

## 2. Âmbito

### Dentro do v0
- Entrar/sair de um canal de voz (`/join`, `/leave`)
- Falar texto: `/tts <texto>`, **auto-ler** um canal de texto configurado, e ler menções/replies ao bot
- Voz **Piper** self-hosted (custo €0), com vários modelos de língua
- **Limpeza de texto** por defeito: URLs→"link", emojis→saltar, `@menção`→nome, `#canal`→nome,
  remover code blocks, colapsar caracteres repetidos, limite de caracteres
- **Deteção de língua por-mensagem** → escolha automática de voz (a voz guardada do user tem prioridade)
- **Voz por-utilizador** persistente (modelo + velocidade)
- **Moderação**: blocklist de palavras (antes de sintetizar), rate-limit por-user, limite de chars, gating por role/canal
- **Fiabilidade**: auto-reconexão à voz, fila FIFO com `/skip`, auto-saída por inatividade, não crashar em erros de síntese
- **Cache** de áudio por hash(texto+voz)

### Fora do v0 (roadmap posterior, NÃO construir agora)
- Motor neural pago premium (OpenAI tts-1 / Polly) atrás de flag/subscrição
- Streaming de baixa latência (sub-100ms)
- Dicionário de pronúncia personalizado
- Controlo de leitura ultra-granular para além do gating básico
- Monetização (Premium Apps / Patreon)
- Dockerização para VPS e verificação aos 100 servidores
- Mobile (limitação estrutural da plataforma)

## 3. Stack

- **Runtime:** Node.js + **TypeScript** (Node já disponível; corre em Windows; Dockeriza-se depois sem reescrever)
- **Discord:** `discord.js` v14 + `@discordjs/voice`
- **Voz (pipeline):** `@discordjs/opus` (encode Opus), `sodium-native` (encriptação), `ffmpeg-static` (WAV→PCM/Opus)
- **TTS grátis:** **Piper** — binário externo (`piper.exe` no Windows) + modelos `.onnx` (+ `.onnx.json`)
- **Base de dados:** **SQLite** via `better-sqlite3` (zero setup, ideal para correr no PC)
- **Deteção de língua:** `franc` (+ `franc-min`)
- **Testes:** `vitest`
- **Dev:** `tsx` para correr TS em dev; `tsc` para build

Piper e os modelos de voz são descarregados separadamente (não vêm via npm); o README do projeto
documentará o passo de download e a variável `PIPER_PATH` / `PIPER_MODELS_DIR`.

## 4. Arquitetura

Um único processo Node/TS. Liga ao Gateway do Discord e mantém, **por servidor (guild)**, uma
sessão de voz (ligação + player + fila). Cada mensagem/comando atravessa um **pipeline**.
Tudo modular, com um `TTSEngine` abstrato para se poder acrescentar um motor neural depois
sem tocar no resto.

### Intents do Gateway
- `Guilds`, `GuildVoiceStates` (sempre)
- `GuildMessages` + `MessageContent` (para auto-ler um canal) — **abaixo de 10k users ativa-se
  self-serve no Dev Portal, sem review**. `/tts` e menções funcionam sem `MessageContent`.
- `GuildMembers` (resolver display names de menções)

## 5. Módulos

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `config/` | Carrega env (token, client id, caminhos do Piper, db path, defaults/limites) | — |
| `store/` | Acesso SQLite: prefs de voz por-user, config por-guild, blocklist; migrações | `better-sqlite3` |
| `textCleaning/` | **Funções puras**: URL→"link", emoji→saltar, `@id`→nome, `#id`→nome, remover code blocks, colapsar repetições, limite de chars | (nomes resolvidos passados como args) |
| `language/` | Deteta língua de uma string → mapeia para um modelo Piper disponível; fallback default | `franc` |
| `tts/` | Interface `TTSEngine { synth(text, voice): Promise<audioPath> }`; `PiperEngine` (spawn do Piper → WAV); **cache** hash(texto+voz)→ficheiro | `config`, fs |
| `voice/` | `GuildVoicePlayer` por guild: `VoiceConnection` + `AudioPlayer` + fila FIFO + `skip()` + auto-saída por inatividade + **auto-reconexão** com backoff | `@discordjs/voice`, `tts` |
| `moderation/` | Blocklist (pré-síntese), rate-limit por-user (token bucket), limite de chars, gating por role/canal | `store` |
| `commands/` | Slash commands (abaixo) + handler de `messageCreate` para auto-read/menções | tudo acima |
| `bot/` | Cliente Discord, intents, registo de comandos, ligação de eventos, handlers globais de erro | `discord.js` |

### Comandos
- `/join` — bot entra no teu canal de voz atual
- `/leave` — bot sai
- `/tts <texto>` — fala o texto (funciona sem `MessageContent` intent)
- `/voice set <modelo> [velocidade]` · `/voice list` · `/voice reset` — voz por-utilizador
- `/config` (admin) — definir canal TTS, auto-read on/off, max-chars, rate-limit, adicionar/remover palavra da blocklist
- `/skip` — salta a fala atual

## 6. Modelo de dados (SQLite)

```
user_voice(guild_id TEXT, user_id TEXT, voice_model TEXT, speed REAL,
           PRIMARY KEY (guild_id, user_id))

guild_config(guild_id TEXT PRIMARY KEY, tts_channel_id TEXT, autoread INTEGER,
             default_voice TEXT, max_chars INTEGER, rate_per_min INTEGER, enabled INTEGER)

blocklist(guild_id TEXT, word TEXT, PRIMARY KEY (guild_id, word))
```
Cache de áudio em ficheiro (`cache/<hash>.wav`); a chave é hash(texto_limpo + modelo + velocidade).

## 7. Fluxo de dados (mensagem → fala)

1. Origem: `messageCreate` num canal TTS configurado (autoread) **ou** interação `/tts` **ou** menção/reply ao bot.
2. Ignorar: mensagens de bots ou vazias.
3. Verificar: rate-limit do utilizador e gating por role/canal.
4. **Limpar texto** (inclui truncar a `max_chars`) → se ficar vazio depois de limpar, descartar.
5. **Blocklist** → se bater, bloquear (sem falar).
6. **Detetar língua** → escolher voz (a voz guardada do user sobrepõe-se).
7. **Cache**: hit devolve o ficheiro; miss → Piper sintetiza → guarda no cache.
8. **Fila** do servidor → toca em sequência; `/skip` corta a atual.
9. Inatividade (sem fila durante 60s, configurável) → sai do canal de voz.

## 8. Erros e fiabilidade (o wedge — robustez é requisito, não extra)

- **Auto-reconexão à voz:** ao entrar em `VoiceConnectionStatus.Disconnected`, tentar `rejoin()`
  com backoff (algumas tentativas) antes de destruir a ligação — mata a queixa "desconecta durante horas".
- **Piper com timeout:** se o processo falha ou excede o tempo, saltar essa mensagem e registar; **nunca crashar**.
- **Handlers globais:** `unhandledRejection` / `uncaughtException` registam e mantêm o processo vivo;
  restart automático (pm2 em dev / Docker `restart` depois) para crashes duros.
- **Cap na fila:** uma rajada de spam não enche a memória; ao exceder o cap, descartar com aviso suave.
- **Permissões em falta** (Connect/Speak): responder com mensagem clara, não falhar em silêncio.

## 9. Testes

- **Unitários (Vitest), corro eu no Windows sem token:**
  - `textCleaning` — casos: URLs, emojis, `@menção`/`#canal`, code blocks, "aaaaaa"/"WWWW", limite de chars, string que fica vazia
  - `language` — mapeamento língua→modelo + fallback
  - `moderation` — rate-limiter (token bucket), blocklist, limite de chars
  - `tts` — chave de cache estável; hit/miss
  - `voice` — lógica da fila/skip com um player falso (sem Discord real)
- **Integração de voz:** Piper gera um WAV não-vazio (só se o Piper estiver instalado).
- **Discord ao vivo** (entrar no VC e falar): precisa do token + servidor → **checklist de teste manual** para o utilizador.

## 10. Localização do projeto

Código em `bots-discord/tts-bot/` (separado das notas do Obsidian). Esta spec vive em
`bots-discord/tts-bot/docs/design-history/specs/`.

## 11. Divisão de responsabilidades

- **Implementação:** código, testes unitários, scripts de registo de comandos, instruções de
  download do Piper/modelos, README de setup. Corro os testes unitários aqui (em background/escondido,
  sem abrir terminais no main).
- **Tu:** criar a app no Discord Developer Portal + token + ativar intents; instalar Node + dependências
  nativas (guio-te); descarregar o binário Piper + modelos (guio-te); correr e **testar ao vivo**; deploy depois.

## 12. Roadmap pós-v0 (direção, fora de âmbito agora)

Motor neural premium atrás de flag → streaming de baixa latência → dicionário de pronúncia →
controlo granular → Dockerizar para VPS → monetização (Premium Apps, UE/Portugal elegível) →
verificação aos 100 servidores.
