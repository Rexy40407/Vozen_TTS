# Análise de Concorrentes — Bots de TTS para Discord

Data: 2026-06-30
Objetivo: a partir das **reviews reais** dos principais bots de TTS, encontrar (a) as queixas **comuns** a todos e (b) o **espaço branco** que nenhum bot ocupa — para posicionar o nosso `tts-bot`.

> Método: leitura das páginas e reviews no top.gg + buscas no Reddit/listicles. Ratings são snapshot de 2026-06-30. Atenção ao tamanho da amostra (ratings altos com poucas reviews valem menos).

## 1. O bot do link (513423712582762502) — **TTS Bot** (o líder)
- **1.477.911 servidores · 3,37/5 (46 reviews)** — 20×5★ mas 12×1★.
- Motor: **Google TTS (gTTS)** → voz **robótica** no grátis.
- Queixas reais:
  - "consistently giving tons of errors and **disconnecting for hours**" (fiabilidade)
  - não conseguiu **reverter** a voz depois de a mudar (UX/settings)
  - "**no one responded**" a pedidos de ajuda (suporte)
  - "a bit slow" (latência)

## 2. Os outros bots (amostra)
| Bot | Servidores | Rating | Motor/Vozes | Fraquezas reais nas reviews |
|---|---|---|---|---|
| **TTS Bot** | 1,48M | 3,37 (46) | gTTS (robótico) | desconecta horas, sem reverter voz, suporte ausente, lento |
| **Scriptly** | 92,9K | 3,88 (8) | STT + TTS; **300+ vozes só premium** | transcrição imprecisa, faltam línguas (RU, ES), devs não respondem a reviews |
| **Interaction Bot** | 55,8K | 4,0 | tradução+TTS+STT | (multiusos, TTS não é o foco) |
| **HornBot** | 51K | **5,0 (só 10)** | "centenas de vozes", **só EN/CN**, motor não revelado (provável proxy StreamElements/Polly/TikTok) | amostra minúscula; sem PT/europeu; dependência de API terceira frágil |
| **Orator** | 34,4K | 4,75 (40) | vozes "human/celebrity"; freemium | "**locked everything behind a vote/paywall**", "**premium is a mood killer**", "**always requires prefix**", "doesn't automatically [detect language] in voices", "way worse than regular discord tts" |
| **Wamellow** | 42,3K | 5,0 | AI+TTS+translate (multiusos) | TTS é feature secundária |
| **ST Manager** | 28,8K | 4,3 | "most complete", base **VOICEVOX (japonês)** | foco JP |
| **MEE6** | — | — | TTS **atrás de paywall (~$11,95/mês)** | qualidade paga |
| **VOICEVOX bots** (SimpliesBot, Vocalis, zundacord) | vários | — | **neural + grátis** MAS **só japonês** | inglês/loanwords saem mal |

## 3. O padrão comum — o que **todos** falham
1. **Trade-off forçado na voz:** ou é **grátis-mas-robótica** (gTTS/eSpeak — o líder), ou **natural-mas-paga** (Orator, MEE6, Scriptly premium). Ninguém dá natural **e** grátis no Ocidente.
2. **Paywall na qualidade** = a queixa mais repetida e mais emocional ("locked everything behind a paywall", "premium is a mood killer", MEE6 $11,95/mês, Scriptly 300+ vozes só premium). Mais universal que "robótica" — até bots com boa voz falham aqui.
3. **Fiabilidade:** o líder cai do canal de voz "durante horas". Nenhum bot é conhecido por ser à prova de bala.
4. **Fricção de uso:** prefixo obrigatório, sem auto-leitura, sem deteção automática de língua → voz (Orator perde explicitamente nisto).
5. **Suporte ausente/lento** (TTS Bot, Scriptly).
6. **Setup/permissões confusos** — "I tried everything—set up all permissions, kicked the bot out…".
7. **Línguas em falta** — sobretudo europeias/PT; pedidos de RU, ES, VI sem resposta.

## 4. O espaço branco — o que **nenhum bot tem** (para EN/PT/europeu)
> **Voz genuinamente natural (neural) + 100% grátis (qualidade nunca atrás de paywall) + nunca cair do canal de voz + auto-leitura sem prefixo + deteção automática de língua por mensagem — tudo junto, em línguas ocidentais.**

Cada concorrente falha pelo menos um destes. O modelo "neural grátis" **só está provado no japonês (VOICEVOX)** — o que **valida a viabilidade** e ao mesmo tempo **avisa** que alguém o pode portar para o Ocidente. O **Piper** é exatamente isso: "o VOICEVOX do Ocidente".

## 5. Como o `tts-bot` v0 já ataca isto (e o que falta)
**Já coberto pela spec/plano:**
- Piper neural **grátis**, multi-língua (PT/EN/europeu) → mata "robótica" + "paywall na qualidade".
- Auto-reconexão à voz + nunca crashar → mata "desconecta horas".
- Auto-leitura sem prefixo + menções/replies → mata a fricção do prefixo.
- **Deteção de língua por mensagem → voz** → exatamente a lacuna do Orator.
- Voz por-utilizador, cache, moderação, fila/skip.

**Cuidados / o que ainda não ganhamos:**
- ⚠️ **Self-host vs. beginner-friendly:** a queixa "settings não beginner-friendly" é sobre **convidar e configurar um bot já alojado**. O nosso v0 é **self-host** (descarregar Piper, modelos, .env, intents, correr no PC) → **pior** nesse eixo para o dono de servidor médio. Só ganhamos "fácil de usar" quando for **hosted/invite-and-go** (está no roadmap: Dockerizar → VPS → verificação). Não prometer "mais fácil" antes disso.
- O trunfo de marketing mais forte é **"qualidade de voz NUNCA atrás de paywall"** + **"não cai do canal"** — usar estes dois como headline, não só "neural".

## 6. Posicionamento sugerido (1 linha)
**"Voz natural, grátis e que não te abandona a meio — sem paywall, sem prefixos, lê sozinho na tua língua."**

## Fontes
- TTS Bot — https://top.gg/bot/513423712582762502
- Orator — https://top.gg/bot/948637316145102868
- HornBot — https://top.gg/bot/1131890979100700712 · https://discord.bots.gg/bots/1131890979100700712
- Scriptly — https://top.gg/bot/830626887779876884
- Tag TTS — https://top.gg/tag/text-to-speech
- VOICEVOX (JP, neural, grátis) — https://discord-media.com/en/news/what-is-a-voicevox-bot-the-zundamon-tts-guide.html · https://github.com/sarisia/zundacord
- Listicles 2026 — https://voice.ai/hub/tts/tts-bot-discord/ · https://skywork.ai/skypage/en/discord-tts-bots-ai-voice-tools/2036021113608077312
