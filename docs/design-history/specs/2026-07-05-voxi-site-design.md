# Vozen — Site oficial · Plano de design & layout

> **Estado:** plano aprovado para implementação em 2026-07-05.
> **Referência de estilo:** https://quantum-bot.net/ (analisado 2026-07-05 via CSS/JS bundle — screenshots bloqueados pela política de Controlo de Aplicações do Windows)
> **Implementação:** seguir o sistema visual descrito abaixo e rever o resultado nos browsers suportados.

---

## 1. O que aprendi do quantum-bot.net (DNA a herdar)

Extraído do bundle CSS/JS real (Tailwind + React/Vite SPA):

| Elemento | Quantum | Herdar? |
|---|---|---|
| Tema | Escuro quase-preto (`#141414`, `#2a2a2a`, `#000`) | ✅ sim |
| Acentos | Blurple Discord `#5865f2` + indigo `#6366f1`/`#4f46e5`, gradientes indigo→cyan, indigo→purple/pink | ✅ a base; ver §2 para a variação Vozen |
| Glass | `backdrop-blur` 8–24px em nav/cards, bordas translúcidas | ✅ sim |
| Atmosfera | Glow orbs desfocados (blur 40–64px) atrás do hero | ✅ sim |
| Radius | Generoso: 0.75–2rem em cards, pill (9999px) em botões | ✅ sim |
| Hero copy | "The #1 all-in-one Discord bot" + CTA "Add to Discord" | ✅ padrão |
| Secções | "Everything you need" (grid de features), stats, team, FAQ | ✅ estrutura |
| i18n | Site multilingue (EN/PT/ES/FR/IT/DE) | ✅ EN + toggle PT (V1) |
| Fontes | system-ui (fraco!) | ❌ NÃO herdar — ver §3 |

**O que NÃO copiar:** o quantum usa fontes de sistema e indigo genérico. O Vozen precisa de identidade própria, sem um aspeto visual genérico e com tipografia com carácter.

## 2. Conceito & identidade visual do Vozen

**Conceito: “SOUND ON” — um palco escuro onde texto vira som.**
O Vozen é um bot de VOZ. O motivo visual assinatura é o **equalizador/onda sonora**: barras que pulsam, ondas que atravessam secções, um chat do Discord onde uma mensagem escrita se transforma em áudio. É a única coisa que o visitante tem de recordar: *escreves → ouves*.

### Paleta (CSS custom properties)

```css
:root {
  /* base escura com undertone azul (palco) */
  --bg-0: #07070d;        /* fundo raiz */
  --bg-1: #0d0e17;        /* secções alternadas */
  --bg-2: #14162399;      /* cards glass (com alpha) */
  --border-glass: #ffffff14;

  /* marca */
  --blurple: #5b6cff;     /* primário (afinidade Discord, mas mais elétrico que #5865f2) */
  --aqua: #2dd4bf;        /* assinatura ÁUDIO — ondas/equalizador (teal, não o cyan do quantum) */
  --grad-brand: linear-gradient(135deg, #5b6cff 0%, #2dd4bf 100%);

  /* apoio */
  --amber: #fbbf24;       /* highlights lúdicos (jogos, estrelas) — usar com MUITA parcimónia */
  --text-0: #f4f5fb;      /* títulos */
  --text-1: #9aa0b5;      /* corpo secundário */
}
```

Regra: **blurple domina, aqua é o som, amber só aparece na secção de jogos.** Nada de arco-íris.

### Tipografia (distinta — nada de Inter/system)

- **Display (títulos):** `Unbounded` (Google Fonts) — geométrica expandida, tem "voz alta", memorável. Pesos 500/700. Usar em H1/H2 e números de stats.
- **Corpo:** `Outfit` (Google Fonts) — geométrica limpa, quente, legível. 400/500/600.
- **Mono (comandos/chat mock):** `JetBrains Mono` 400/700 — blocos `/tts olá`, mock do Wordle.
- Carregar via Google Fonts com `display=swap` + `preconnect`.

### Atmosfera & profundidade

- Gradient-mesh fixo no hero: 2 glow orbs (blurple e aqua, `filter: blur(120px)`, opacidade ~0.25) + **grain** (SVG noise data-URI, opacidade 0.04, `pointer-events:none`) sobre todo o site.
- Linhas de onda (SVG path) muito ténues a separar secções — costura o motivo áudio.
- Cards: glass (`background: var(--bg-2); backdrop-filter: blur(16px); border: 1px solid var(--border-glass); border-radius: 1.25rem`), hover: elevação + borda a ganhar gradiente.

### Motion (alto impacto, CSS-first)

1. **Load do hero (o momento):** revelação em cascata — badge → H1 (palavra a palavra, `animation-delay` escalonado) → sub → CTAs → mock do chat. ~900ms total.
2. **Assinatura permanente:** equalizador de 5–7 barras a pulsar (CSS `@keyframes`, alturas dessincronizadas) no logo/nav e no chat mock.
3. **Chat mock animado (hero, direita):** mensagem “gostas de música? 🎵” escreve-se (typing), aparece o avatar Vozen com **onda sonora animada** + legenda “🔊 Vozen is speaking…”. Loop com 2–3 mensagens (uma em PT, uma em EN — mostra a deteção de língua!).
4. **Scroll-reveal:** `IntersectionObserver` + classe `.in-view` (fade+rise 24px). Uma vez, não repetir.
5. **Marquee de línguas:** faixa contínua de chips (🇵🇹 Português · 🇬🇧 English · 🇪🇸 Español · …34) em `animation: scroll linear infinite`, pausa on-hover.
6. `prefers-reduced-motion: reduce` → desligar tudo (obrigatório).

## 3. Estrutura da página (single-page, ordem exata)

### 3.0 Navbar (sticky, glass)
- Esq.: logo (equalizador SVG animado + wordmark “Vozen” em Unbounded).
- Centro: Features · Games · Commands · Languages · FAQ (âncoras, scroll suave).
- Dir.: toggle **EN/PT** (pill) + CTA primário **“Add to Discord”** (pill, grad-brand).
- On-scroll: encolhe (padding) e ganha `backdrop-blur` + borda inferior.
- Mobile: hamburger → painel glass em overlay.

### 3.1 Hero (2 colunas; mobile empilha)
**Esquerda:**
- Badge pill: `🔊 Free forever · No paywall`
- H1 (Unbounded): **“Type it. Hear it.”** com “Hear it.” em gradiente brand.
  - PT: “Escreve. Ouve.”
- Sub (Outfit, --text-1): “Vozen reads your Discord chat out loud with natural neural voices — in 34 languages, with games, laughter and zero paywalls.”
  - PT: “O Vozen lê o teu chat do Discord em voz alta com vozes neurais naturais — em 34 línguas, com jogos, risos e zero paywalls.”
- CTAs: **Add to Discord** (primário, grad) + **Join support server** (ghost/glass). Ícones Discord inline SVG.
- Micro-stats strip por baixo (mono): `34 languages · 38 voices · 13 minigames · 100% free`

**Direita:** o chat mock animado (ver §2 motion #3) dentro de uma janela estilo Discord (header com ●●●, fundo #313338-ish, mensagens com avatares). É a peça de memória do site.

### 3.2 Stats bar (full-width, glass strip)
4 números grandes (Unbounded) com labels: **34** languages · **38** neural voices · **13** minigames · **∞** free forever. Contador animado on-scroll (JS pequeno).

### 3.3 Features — “Everything your server needs” (grid 3×2)
Cards glass com ícone (SVG inline, traço 1.5px, cor aqua):
1. **Auto-read channel** — “Pick a channel; Vozen reads every message out loud. Set it once with /setup.”
2. **Your voice, your language** — “Each member picks their own voice from 34 languages — Google or local neural engine.”
3. **Speaks like a human** — “Detects the language of each message and even mixes voices in one sentence.”
4. **13 voice minigames** — “Guess the language, spelling bees, Wordle, reflex duels — with a server leaderboard.” *(badge amber “NEW”)*
5. **Personality included** — “Greets people who join the call, says who’s talking, tells jokes and laughs in 34 languages.”
6. **Admin peace of mind** — “Blocklists, rate limits, role gating, opt-out and a kill-switch. You stay in control.”

### 3.4 Showcase A — Voz & línguas (2 col: texto esq, visual dir)
- Título: “One server, every language.”
- Texto: deteção automática, vozes por língua, frases mistas, /voice set com nomes na língua de cada um.
- Visual: marquee de chips de línguas (§2 #5) + mock do picker do /voice set (lista “Alemão / Français / Español…”).

### 3.5 Showcase B — Jogos (invertido: visual esq, texto dir; acentos amber)
- Título: “Play it out loud.”
- Texto: 13 minijogos por voz e texto, 1º-a-acertar, leaderboard e stats.
- Visual: mock do Wordle ANSI (letras coloridas em bloco mono — recriar com spans verde/amarelo/cinza) + pills dos jogos (Guess the Language, Fast Talk, Reflexes…).

### 3.6 Showcase C — “Ready in 30 seconds” (3 passos horizontais)
1. **Invite** — botão Add to Discord. 2. **/join** — entra na tua call. 3. **Type** — o Vozen fala. Cada passo num card numerado (números Unbounded gigantes, meio-transparentes atrás).

### 3.7 Commands (tabs + lista)
Tabs pill: General · Voice · Fun · Admin. Cada comando numa linha glass: `/comando` (mono, aqua) + descrição curta. Conteúdo real:
- General: /help, /join, /leave, /tts, /skip, /setup, /invite, /vote, /uptime, /botstats
- Voice: /voice set·list·preview·reset·detection·nickname·optout·optin, context-menu “Speak”
- Fun: /game play·stop·list·leaderboard·stats, /joke, /laugh
- Admin: /config (tts-channel, autoread, language, greet, greet-language, xsaid, autojoin, read-bots, text-in-voice, default-voice, max-chars, rate-limit, role, enabled, blockword, pronunciation, show, reset), /stats

### 3.8 FAQ (accordion, 6 itens)
1. Is Vozen really free? → “Yes. Every feature, every voice, every game — free forever. No premium tier.”
2. How do I add Vozen? / 3. Which languages? (34 + lista no marquee) / 4. Do I need to configure anything? (/setup faz tudo) / 5. Can each person have a different voice? / 6. How do I turn features off? (/config …)

### 3.9 CTA final (banner full-width)
Fundo grad-brand suave + orbs; H2 “Give your server a voice.” + botão gigante Add to Discord + linha “Free forever · 34 languages · Set up in 30 seconds”.

### 3.10 Footer
3 colunas: logo+tagline (“Vozen — type it, hear it.”) · Product (âncoras) · Community (Support server, Vote on top.gg, GitHub). Linha final: © 2026 Vozen · Not affiliated with Discord.

## 4. i18n do site (V1)

- EN é a língua base do HTML. Toggle EN/PT na navbar troca via dicionário JS (`data-i18n="hero.title"` + `site-i18n.js` com `{en:{...}, pt:{...}}`). Persistir escolha em `localStorage`; auto-detetar `navigator.language` pt-* na 1ª visita.
- Todo o copy deste plano já tem par EN/PT onde importa; o resto traduzir na implementação.

## 5. Especificação técnica

- **Stack:** estático puro — `site/index.html` + `site/css/main.css` + `site/js/main.js` (+ `site/js/i18n.js`). **Zero build, zero dependências** (o quantum é React, mas para 1 página estática é peso morto). Deployável em GitHub Pages/Netlify tal-e-qual.
- **Assets:** logo/ícones SVG inline (equalizador, ícones das features, marca Discord); noise em data-URI; fontes via Google Fonts. Nada de imagens raster (a não ser o avatar do Vozen se o Diogo fornecer — senão desenhar avatar SVG: quadrado arredondado grad-brand com equalizador branco).
- **Links (constantes no topo do main.js):**
  - `INVITE_URL` — `https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&scope=bot+applications.commands&permissions=274881137664` (o repo já deriva estas permissions em INVITE_PERMISSIONS; confirmar o inteiro no código ao implementar)
  - `SUPPORT_URL` (placeholder até o Diogo dar o link), `TOPGG_URL` = `https://top.gg/bot/<CLIENT_ID>/vote`.
- **Performance:** 1 página, sem JS pesado; anims CSS; `IntersectionObserver`; fontes `swap`; alvo Lighthouse ≥95.
- **A11y:** contraste AA no dark, `:focus-visible` claro, aria nos accordions/tabs, `prefers-reduced-motion`.
- **Responsive:** breakpoints 1080/768/480. Hero empilha; marquee mantém; commands viram lista simples.

## 6. Checklist de implementação

1. [ ] Rever o conceito visual e os critérios de acessibilidade antes de escrever código.
2. [ ] Criar `site/` com index.html + css/main.css + js/main.js + js/i18n.js.
3. [ ] Tokens (§2) + fontes + grain + orbs.
4. [ ] Navbar + hero com chat mock animado (a peça central — investir aqui).
5. [ ] Stats bar com contadores.
6. [ ] Features grid (6 cards).
7. [ ] Showcases A/B/C (marquee de línguas, Wordle mock, 3 passos).
8. [ ] Commands tabs + FAQ accordion + CTA final + footer.
9. [ ] i18n EN/PT + toggle + localStorage.
10. [ ] `prefers-reduced-motion`, focus states, aria.
11. [ ] Testar o comportamento responsivo nos browsers suportados e fazer revisão visual.
12. [ ] Commitar `site/` (não tocar em `.env` nem docs alheios).

## 7. Fora de âmbito (V2, não fazer agora)

Dashboard web, login Discord OAuth, página de status ao vivo (via /botstats API), blog/changelog, mais línguas do site além de EN/PT, dark/light toggle (o site É dark — identidade).
