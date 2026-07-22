# Research: TTS Bot vs Voxi — o caminho para o nº 1 (2026-07-04)

Research completa sobre o concorrente dominante **TTS Bot** (Discord-TTS/Bot, Rust,
~1,5M servidores) feita em 3 frentes: dissecação do código-fonte dele (932 commits),
inventário completo do Voxi, e presença pública (GitHub issues, top.gg, Patreon).

---

## 1. O adversário em números

| Métrica          | TTS Bot                                                                | Voxi                              |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Servidores       | **~1.488.000**                                                         | (arranque)                        |
| Rating top.gg    | **3,37/5** (46 reviews) — mediano                                      | —                                 |
| Votos top.gg     | 124 (baixíssimo para a escala)                                         | —                                 |
| Receita          | ~€1.870/mês Patreon (552 pagantes)                                     | €0                                |
| Stack            | Rust (Serenity/Songbird/Poise) + PostgreSQL + microserviço tts-service | TypeScript + SQLite + Piper local |
| Voz grátis       | gTTS (Google Translate) / eSpeak (robótico)                            | **Piper neural**                  |
| Voz paga         | gCloud (900+ vozes) / Polly (300+) + tradução DeepL                    | — (tudo grátis)                   |
| Última atividade | 2026-06-23 (ativo)                                                     | diária                            |

**Leitura estratégica:** o TTS Bot ganhou por distribuição e antiguidade (2020), não por
qualidade — o rating 3,37/5, a vaga de queixas de lentidão em mar-abr 2026 e o backlog
de pedidos básicos por resolver há 1-2 anos são a abertura. A conversão premium deles é
fraquíssima (552 pagantes em 1,5M servidores), o que confirma: **neste nicho ganha quem
dá qualidade de graça** — e a nossa voz grátis (Piper neural) já é melhor que a voz
grátis deles (gTTS/eSpeak).

---

## 2. O que ELES têm que NÓS não temos

### 2.1 Alto impacto (paridade obrigatória)

| Feature | O que é | Nota |
|---|---|---|
| **xsaid** | Anuncia "Fulano disse" antes de cada mensagem | A feature nº 1 de um TTS bot multi-utilizador — sem isto não se sabe quem falou. Eles até suprimem o nome em mensagens consecutivas do mesmo autor (issue #111 resolvida). |
| **Anúncio de anexos por tipo** | "an image file", "a video file", "an audio file", "a compressed file", "multiple files"… | Nós só temos "a gif"/"a link" (feito ontem). Generalizar é pequeno e dá polimento enorme. |
| **Spoilers/code falados** | `\|\|spoiler\|\|` → "spoiler avoided"; ``` → "code block" | Nós removemos em silêncio — o utilizador não sabe que havia conteúdo. |
| **autojoin** | Bot entra sozinho no VC do autor quando chega mensagem no canal TTS | Remove fricção do "/join" a cada sessão. |
| **Context menu "Speak"** | Botão direito numa mensagem → falar | UX de acessibilidade; "speak as" fala com a voz do autor. |
| **nickname** | Apelido fonético para o anúncio de nome | Complementa o xsaid (nomes com emoji/símbolos são ilegíveis). |

### 2.2 Médio impacto

| Feature | O que é |
|---|---|
| **botignore configurável** | Eles PODEM ler bots/webhooks (toggle); nós ignoramos sempre — casos de uso: bridges, webhooks de notificação |
| **required_prefix** | Só lê mensagens que começam com um prefixo (modo opt-in por mensagem) |
| **msg_length em segundos** | Cap por DURAÇÃO de áudio, não só por caracteres |
| **Stage channels + audience_ignore** | Suporte a palcos; ignora a audiência |
| **text-in-voice** | Ler o chat de texto embutido nos canais de voz |
| **/uptime, /ping, /bot-stats públicos** | Transparência/confiança (o nosso /stats é admin-only) |
| **Tradução (DeepL)** | Traduz antes de falar — é a feature premium deles |
| **Mensagens encaminhadas** | Deteta forward e anuncia "forwarded a message" |

### 2.3 Infra/negócio

- **Premium** (Patreon + Discord Store) com ativação por servidor e tiers
- **Analytics** de uso por motor + **bot list updater** (posta server count no top.gg/discord.bots.gg automaticamente) + web updater
- **Error webhooks** com dedup por hash de traceback
- **Escala**: multiplexing de conexões de voz num websocket, load balancing por hash de guild entre instâncias tts-service
- **Ban de utilizadores** ao nível do bot (`bot_banned`)

---

## 3. O que NÓS temos que ELES não têm (as nossas armas)

| Feature Voxi | Porque importa |
|---|---|
| **Voz neural GRÁTIS (Piper)** | A voz grátis deles é robótica; a de qualidade é paga. **A nossa oferta grátis ≈ o premium deles.** É o pitch de aquisição inteiro. |
| **Deteção automática de língua** + memória por-utilizador + síntese multi-língua por segmento | Eles enviam a mensagem inteira numa língua fixa. Comunidades multilíngues (PT/BR + EN, latinos, europeus) são o nosso território natural. |
| **UI em 34 línguas** | Eles são English-only. O Discord é global. |
| **Dicionário de pronúncia por guild** | Nomes de jogos, gíria da comunidade — pedido clássico. |
| **Blocklist de palavras** | Moderação de TTS que eles não têm. |
| **/joke + /laugh multilíngues** | Personalidade — nenhum concorrente tem. |
| **Opt-out por utilizador** | Privacidade granular. |
| **/voice preview** | Ouvir antes de escolher — eles não têm preview. |
| **Cache de áudio** (<0,3ms em repetição) | Latência imbatível em mensagens repetidas. |
| **Rate-limit por utilizador** | Anti-spam embutido. |
| **Restauro de acentos** ("nao"→"não") | Qualidade de pronúncia em PT/ES/FR. |

---

## 4. As fraquezas deles exploráveis (do backlog público)

Pedidos dos utilizadores DELES, por resolver há 1-2 anos — podemos entregar primeiro:

1. **Ignorar mensagens `@silent`** (#127, jan 2026) — pequeno, fazível já
2. **Ignorar utilizadores por role** (#126) — nós temos o inverso (role permitido); adicionar role de exclusão
3. **Texto do "X said" configurável** (#93, aberto desde 2024!)
4. **Ler display names** (#113) — nós já usamos displayName nas menções
5. **Ler nomes de stickers** (#116)
6. **Bugs de fiabilidade**: vozes que desaparecem, tracks presas, race conditions no xsaid — a nossa suite de 884 testes é a vantagem estrutural aqui

E as queixas de abril 2026 (lentidão, não entra na call, offline) confirmam que **fiabilidade + latência** são o campo de batalha da satisfação.

---

## 5. Plano para o nº 1 — 3 vagas

### Vaga 1 — Paridade de polimento (dias, tudo pequeno)
1. **xsaid**: "Fulano disse" com toggle por guild + supressão em mensagens consecutivas + **texto configurável** (a issue #93 deles, por resolver há 2 anos) + localizado nas 34 línguas (o deles é EN fixo)
2. **Anexos por tipo**: generalizar o "a gif" para imagem/vídeo/áudio/ficheiro/múltiplos — localizado
3. **Spoiler/code falados**: "spoiler" / "código" em vez de remoção silenciosa
4. **@silent ignoradas** (flag SuppressNotifications) — antes deles
5. **Stickers**: ler o nome do sticker
6. **nickname fonético** (/voice nickname)

### Vaga 2 — Diferenciação funcional (semanas)
7. **autojoin** por guild
8. **Context menu "Speak"** (+ "Speak as")
9. **botignore toggle** (ler webhooks/bots)
10. **/bot-stats + /uptime públicos** (transparência)
11. **Motor híbrido Kokoro+Piper** (qualidade grátis ainda mais acima do premium deles nas 8 línguas Kokoro)
12. **Tradução grátis** (a feature premium DELES, de graça — avaliar endpoint/custo)
13. **Stage channels** + text-in-voice

### Vaga 3 — Distribuição e escala (contínuo)
14. **Bot list updater** (top.gg auto-post) + campanha de votos (/vote já existe)
15. **Pitch de acessibilidade** no top.gg: "vozes neurais grátis + 34 línguas" — ataca diretamente o free tier robótico deles
16. **Verificação Discord** ao aproximar de 76 servidores (cap de 100 sem verificação)
17. **Error webhook + analytics** para operar em escala
18. Premium só DEPOIS de tração — a conversão fraca deles avisa que o nicho não paga facilmente; a monetização não pode ser o motor de crescimento

---

## 6. Conclusão

O TTS Bot é grande mas está **parado no essencial**: voz grátis má, English-only,
backlog básico por resolver, rating mediano, incidente de capacidade recente. O Voxi
já ganha em qualidade de voz grátis, multilíngua e testes. O que falta é (a) o
polimento de paridade da Vaga 1 — pequeno e rápido — e (b) distribuição. Nenhuma
feature da Vaga 1 demora mais que um dia de trabalho; juntas fecham praticamente
todos os motivos para um servidor escolher o TTS Bot em vez do Voxi.
