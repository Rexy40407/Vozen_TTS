# Análise de Aquisição — Como os clientes chegam a um bot de TTS no Discord

Data: 2026-06-30
Pergunta: como é que os clientes **chegam** ao bot e como ele **fica conhecido** (0 → milhares de servidores)?
Método: 2 rondas de pesquisa multi-agente com busca web real + verificação adversarial (factos confirmados em fonte primária; superlativos/causalidade marcados quando não provados). Complementa [analise-concorrentes.md](analise-concorrentes.md).

---

## 0. A resposta curta
Para um bot de TTS, **os clientes não te encontram a pesquisar — eles OUVEM-te**. O motor de crescimento dominante da categoria é, muito provavelmente, a **viralidade audível dentro do Discord**: alguém põe o bot a ler numa call, todos os presentes ouvem, perguntam "que bot é este?" e adicionam-no ao seu servidor. O líder é consistente com isto — **1.477.972 servidores com só ~220 stars no GitHub e ~109 votos/mês no top.gg**: comprovadamente **NÃO** cresceu por listas/votos/marketing. *(Ressalva honesta: a viralidade audível é a explicação mais plausível, mas não está medida; e há um co-fator que não consegues copiar — ser **pioneiro desde 2018** num nicho vazio.)*

**A condição para ligar esse motor é pequena e barata — NÃO é "construir um produto hosted".** Correr no teu PC não é o bloqueio. O portão real é o bot estar **público (toggle "Public Bot" no Developer Portal) + sempre ligado (uptime 24/7)**. Basta pôr a tua instância atual num servidor sempre-ligado — um **VPS de ~€5/mês ou o free tier da Oracle Cloud** (já está no teu roadmap como "Dockerizar para VPS"). Assim que estiver público + 24/7, podes **listar no top.gg e arrancar o loop viral HOJE**, sem esperar meses. O único muro mais alto a seguir é a **verificação aos 100 servidores**.

---

## 1. Correção importante ao posicionamento
Verificámos por código e pelas páginas do líder: o **"TTS Bot" JÁ tem auto-leitura (`/setup` + auto-join) e deteção de língua/tradução (25+ línguas)**. Logo esses **não são diferenciais** — são *table stakes*. Os diferenciais genuínos do nosso bot são apenas dois, e são os certos:

1. **Voz neural GRÁTIS** (Piper) — o líder dá gTTS robótico no grátis e esconde Polly/gCloud atrás de Patreon de €5/mês (confirmado no código `TTSMode::is_premium()`; Patreon do líder: 4.073 membros, 562 pagantes, **€1.919/mês**).
2. **Fiabilidade** — os reviews 3,37/5 do líder agrupam-se em instabilidade ("disconnecting for hours", "tons of errors") e suporte ausente.

→ A mensagem de marketing em TODOS os canais: **"voz neural (não robótica) · nunca cai do canal · grátis para sempre, sem paywall (≠ Orator/MEE6)"**. Não vender "auto-leitura" como novidade.

---

## 2. Os dois regimes (o portão é: bot PÚBLICO + sempre-ligado — não "self-host vs hosted")
Correr no teu PC **não** é o bloqueio; o bloqueio é estar **privado** ou **offline**. Põe a instância atual num VPS ~€5/Oracle free tier + ativa "Public Bot" e a coluna da direita abre.
| | **Privado / só no PC (hoje)** | **Público + 24/7 (≈ VPS €5 / Oracle free)** |
|---|---|---|
| Viralidade audível intra-Discord | ❌ (não há invite público de 1 clique) | ✅ **o motor principal** |
| Bot lists (top.gg, discordbotlist…) | ❌ (exigem bot público + 24/7) | ✅ |
| App Directory nativa | ❌ (exige verificação aos ~75-100 serv.) | ✅ (amplificador, ranqueado por nº servidores) |
| GitHub / open-source | ✅ **melhor canal disponível** | ✅ (continua, p/ técnicos) |
| Conteúdo/SEO/AI-SEO de domínio próprio | ✅ (arrancar já; demora 6-12 meses) | ✅ |
| Clips/tutoriais YouTube | ✅ (awareness + tutoriais de setup) | ✅ (clip → invite de 1 clique) |
| Lançamento (Show HN, Product Hunt, Dev Hunt…) | ✅ (vertente open-source) | ✅ (completo) |

---

## 3. Plano faseado

### Fase 0 — AGORA (self-host, €0): fundação + ganhar os early adopters técnicos
1. **GitHub como hub** (o melhor canal disponível neste estado):
   - README como landing page: 1 frase de proposta, badges (stars, license, Docker, "made with Piper"), **GIF de 10s** a ler PT+EN, instalação em 3 linhas, níveis Easy/Normal/Hard.
   - **Dominar GitHub Topics**: o topic `discord-tts-bot` tem só ~11 repos (máx. 105 stars) vs `discord-bot` com 27.876 — vitória fácil. Adicionar `tts`, `text-to-speech`, `piper`, `piper-tts`, `self-hosted`, `neural-tts`.
   - **Submeter a listas curadas** (descoberta passiva): `awesome-selfhosted` (exige licença + >4 meses de vida + manutenção ativa), `gillesheinesch/opensource-discordbots` (propor categoria TTS). Nota: links de README/topics são `nofollow` — valem por descoberta, não por SEO.
   - **Semear PULL** (sem spam, ~9 contribuições por 1 auto-promoção): r/selfhosted (~787k), r/Discord_Bots, r/discordapp, r/LocalLLaMA, comunidades Piper/rhasspy/homelab.
2. **Fundação de SEO/conteúdo** (arrancar já — ranquear leva 6-12 meses):
   - Página própria **"TTS Bot alternative — voz neural grátis, sem paywall"** (tabela comparativa nós vs líder logo nos 1ºs 200 caracteres). Atenção: a cunha "neural grátis" está **mais disputada** do que parece (VibeBot, Wamellow, MorVoice já a usam) — diferenciar pela **fiabilidade + PT/europeu + deteção automática**.
   - **AI-SEO**: responder nos 1ºs 200 caracteres (citado 2,3× mais), incluir estatísticas, permitir `GPTBot`/`PerplexityBot`/`ClaudeBot` no robots.txt. Exige consenso multi-fonte (site + Reddit + YouTube + GitHub).
3. **Clips comparativos** neural-vs-robótico + multilíngua, e **tutorial-âncora YouTube** "self-host free neural TTS (Piper, €0)" — no self-host é o formato que mais converte.
4. **Preparar o salto hosted**: Política de Privacidade + Termos públicos; **deploy 1-clique** (Railway/Render/Oracle free tier — há bots em ~45-50k servidores em free tier) para alargar o funil para além de programadores.

### Fase 1 — O DESBLOQUEIO (passo pequeno e barato): bot PÚBLICO + sempre-ligado
Prioridade nº1 de distribuição — mas é um passo pequeno, não um produto novo: ativa **"Public Bot"** no Developer Portal e põe a tua instância atual num **VPS ~€5/mês ou Oracle Cloud free tier** (Dockeriza). Isto liga a viralidade audível, as bot lists e (depois) a App Directory. Sem isto ficas preso ao nicho técnico.
- 2026: o muro dos 100 servidores para o **MESSAGE CONTENT intent acabou** — é **self-serve até 10.000 utilizadores únicos** (sem review). Ativar logo: é o que permite a auto-leitura. Pré-escrever a justificação para a revisão dos 10k (guardar para a janela de 90 dias).

### Fase 2 — Hosted: acender os canais de massa
5. **Listar em TODAS as bot lists no dia 1** (top.gg, discordbotlist.com, discord.bots.gg, discords.com) com tags `#tts #text-to-speech #accessibility #no-mic #Utility #Social` e descrição com o gancho na 1ª linha. Construir **rating 4,5+** (líder = 3,37) pedindo reviews a utilizadores satisfeitos. `/vote` com recompensas (norma de facto p/ visibilidade; respeitar as Voting Guidelines). Bónus: o tráfego do top.gg é **~28% EUA** (não 88%) → internacional, **ajuda** o público PT/UE.
6. **Lançamento coordenado** (nunca pedir upvotes — voting-ring = ban vitalício de domínio no HN / remoção em top.gg/PH):
   - **Show HN**: "Show HN: <Nome> – Free neural TTS Discord bot you self-host (Piper, no paywall)". Ter ~8-10 upvotes + 2-3 comentários genuínos nos 1ºs 30 min; estar 100% presente as 1ªs 2h. (Show HN típico: 5k-50k visitas/48h, ~1,4 stars/upvote.)
   - **Product Hunt** (aceita open-source/self-host), + **Dev Hunt / Fazier / Peerlist / BetaList** (backlinks dofollow), + **AlternativeTo** como alternativa ao "TTS Bot".
   - **"I built X"** em r/SideProject e r/Discord_Bots (ler regras de self-promo; enquadrar como história, linkar GitHub).
7. **Seeding de nicho/acessibilidade — PULL, nunca PUSH** (DM/convite em massa = ban):
   - Responder a pedidos reais ("bot to read for friends with no mic") em r/discordbots, r/needabot.
   - **Parcerias com donos de servidor** (o dono adiciona = consentido): gaming co-op, RP, aprendizagem de línguas, e servidores listados no DISBOARD/Discadia sob tags `disability`/`no-mic`/`shy` (ex.: "The Wheelies", "SM Community").
   - Ângulo de copy **casual-largo** ("sem mic / tímido / ruído / mãos ocupadas") primeiro; acessibilidade clínica como 2ª camada de credibilidade/SEO.
   - **Aterrar 2-3 servidores "baleia"** (comunidades grandes e ativas em voz: jogos populares, RP grandes): para um bot **audível**, entrar numa só comunidade grande expõe-o a milhares de ouvintes-prospects de uma vez — o bot Astro cresceu em parte por adoção de guilds grandes (Overwatch/Elden Ring), não só por top.gg. Vale mais que dezenas de servidores pequenos.
8. **Engenharia do loop viral**: manter fricção zero (auto-leitura sem prefixo, `/setup` de 1 comando), rodapé subtil "🔊 lido por [Bot] — adiciona grátis", comando `/invite`, e uma **voz/sotaque assinatura memorável**. Cada fala numa call é um anúncio ao próximo dono de servidor.

### Fase 3 — Escalar: descoberta nativa + monetização
9. Aos **~75-100 servidores**: verificar o bot (ID via Stripe) → ativar Discovery → **App Directory** (amplifica tração existente; ranqueada por nº de servidores). É **amplificador, não motor de 0→1**.
10. **Monetização**: **Premium Apps / App Subscriptions** (dev PT/UE **elegível** via Stripe; **Server Subscriptions são só-EUA** — não construir o paywall sobre elas). Manter a regra **"qualidade neural NUNCA atrás de paywall"** — monetizar extras (vozes premium, limites maiores, prioridade), o flanco onde o líder (€5/mês) está exposto. Growth Tier: 15% até ~1M USD.
11. **Sharding** antes dos 2.500 guilds (1 shard/~1.000 guilds) — sustenta a promessa de fiabilidade.

---

## 4. As 5 alavancas de maior impacto (resumo do crítico)
1. **Tornar PÚBLICO + sempre-ligado** (VPS €5/Oracle free) — o desbloqueador barato que liga tudo o resto. Prioridade nº1 de distribuição. (≠ "construir um produto hosted".)
2. **Viralidade audível intra-Discord** — o motor orgânico mais barato (grátis), via fricção-zero + auto-marketing embebido + voz assinatura.
3. **Distribuição open-source/GitHub** — o que funciona JÁ em self-host; domina o nicho quase-vazio e ganha os primeiros utilizadores técnicos.
4. **Bot lists no dia 1 + reviews 4,5+** — ponte para os 100 servidores e captura de pesquisa por tag onde o líder (3,37/5) está vulnerável.
5. **Conteúdo: clip neural-vs-robótico + tutoriais + página "alternativa"** — arrancar a fundação de SEO/AI-SEO agora (demora meses).

---

## 5. Riscos / o que NÃO fazer
- **Crescer por spam = ban**: nada de DM-advertising, self-bots, invite-reward, ou pedir upvotes. Tudo orgânico/PULL.
- **Não confundir** App Subscriptions (UE ✅) com Server Subscriptions (só-EUA).
- **MESSAGE CONTENT intent** é o maior risco de plataforma: a auto-leitura depende dele (reaplicação anual; janela de 90 dias acima dos 10k users).
- **Enquanto o bot estiver privado ou offline** o funil limita-se aos técnicos — o desbloqueio (público + 24/7 num VPS barato) é o que faz a tração arrancar a sério.
- A cunha "neural grátis" está mais **disputada** do que parece (VibeBot/Wamellow/MorVoice) — ancorar na **fiabilidade + PT/europeu**, não só em "neural".
- A virialidade de "vozes IA" (TikTok/AI Presidents) é de **voz expressiva/celebridade**, não de leitor-de-chat utilitário — não assumir que um clip viral converte em instalações; e o formato passou o pico (crackdown YouTube a "AI slop" em 2026).

## Fontes-chave
- Líder: https://top.gg/bot/513423712582762502 · https://github.com/Discord-TTS/Bot · https://www.patreon.com/Gnome_the_Bot_Maker
- Mecânicas: https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps · https://docs.discord.com/developers/gateway/getting-started-with-privileged-intent-review · https://support-dev.discord.com/hc/en-us/articles/23810643331735-Premium-Apps-Required-Support-for-Monetizing-Apps
- Listas/tráfego: https://www.similarweb.com/website/top.gg/ · https://support.top.gg/hc/en-us/articles/23146974461596-Voting-Guidelines
- Casos de crescimento: https://medium.com/@gpimenoff/story-and-lessons-from-building-a-discord-bot-that-reached-150k-servers-094b6d000c21 · https://dev.to/mistval/how-i-host-a-bot-in-45000-discord-servers-for-free-5bk9
- Nicho/acessibilidade: https://disboard.org/servers/tag/disability · https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy
- GitHub/open-source: https://github.com/topics/discord-tts-bot · https://github.com/awesome-selfhosted/awesome-selfhosted
