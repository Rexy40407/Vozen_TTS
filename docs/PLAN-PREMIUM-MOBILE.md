# Plano: secção Premium bonita em mobile (375-430px)

> Planeado em 2026-07-12. Estado de partida: commit 1702512
> live (faixa Free + 2 cartões pagos + tabela de 20 linhas, main-v25.css).
> O Diogo não gostou do resultado no telemóvel.

## Objetivo

Tornar a secção Premium agradável em ecrãs de 375-430px. O problema central: a
tabela de comparação tem `min-width: 680px` dentro de `overflow-x: auto` — em
mobile obriga a **scroll horizontal** numa tabela de 20 linhas, o anti-padrão
número um das pesquisas. Secundário: polir cartões/faixa/toolbar nesses tamanhos.

## Pesquisa (padrões de pricing mobile)

- **Cartões empilhados dominam** (78% dos sites; tabs 14%, carrosséis 8%) — o
  site já empilha os cartões a ≤920px, essa parte está certa.
- **Tabela de comparação em mobile**: nunca deixar só o scroll horizontal.
  Os padrões recomendados: (1) transformar cada linha num bloco vertical
  ("stacked rows"), (2) tabs/acordeão por plano, (3) coluna/cabeçalho sticky
  para nunca se perder a orientação de qual coluna é qual.
- **Sticky headers**: em tabelas longas, o utilizador não pode perder de vista
  os nomes dos planos enquanto desce ("lawn mower pattern" de leitura).
- **Zebra striping + alinhamento consistente** melhoram a scannability.
- Exemplos reais: Cloudflare usa tabs sticky + seletor de features; Spotify e
  Asana colapsam planos em painéis expansíveis.

Fontes: [Smart Interface Design Patterns — Pricing Plans](https://smart-interface-design-patterns.com/articles/pricing-plans/) ·
[Smashing Magazine — Designing Better Pricing Pages](https://www.smashingmagazine.com/2022/07/designing-better-pricing-page/) ·
[UX Patterns — Comparison Table](https://uxpatterns.dev/patterns/data-display/comparison-table) ·
[CXL — Mobile SaaS Pricing Pages](https://cxl.com/blog/mobile-saas-pricing-pages/) ·
[LogRocket — Feature comparison tables](https://blog.logrocket.com/ux-design/ui-design-comparison-features/)

**Decisão de design**: padrão (1)+(3) combinados, **CSS-only** — a ≤640px cada
linha da tabela vira um bloco (nome da feature em cima, 3 células de valor por
baixo) e o `<thead>` vira uma barra **sticky** de 3 colunas (Free · Plus ·
Premium) que acompanha o scroll. Zero JS novo, zero chaves i18n novas (o thead
já usa `price.free.name`/`price.plus.name`/`price.pro.name`), funciona nas 10
línguas. Tabs/acordeão ficam de fora: exigiriam JS + estado + mais i18n para um
ganho marginal.

## Scope

### In
- Tabela → "stacked feature rows" com thead sticky a ≤640px (CSS + classes/roles no HTML).
- Separadores visuais entre os 3 blocos da tabela (base grátis / pagos / exclusivos).
- Polimento dos cartões pagos, faixa Free e toolbar a 375-430px.
- Cache-bust main-v25.css → main-v26.css (4 HTML) + prettier + build:site.
- Deploy pages.yml + verificação live + screenshot mobile (browser 375px).

### Out
- JS novo (tabs, acordeão, carrossel) — o padrão escolhido é CSS-only.
- Chaves i18n novas / alterações a tools/i18n-src (nada muda → i18n-v20.js fica).
- Desktop (>640px) — nada muda visualmente acima do breakpoint.
- Código do bot (src/**) — sem restart do VPS.
- Reduzir as 20 linhas da tabela (fundir jogos etc.) — decisão separada do Diogo.

## Fases

### Fase 1 — Tabela mobile: stacked rows + thead sticky (CSS + HTML mínimo)
Deliverable: a ≤640px a tabela lê-se na vertical, sem scroll horizontal.
- [ ] HTML: adicionar `class="group-b"` à 1.ª linha do bloco pago (m.9) e
      `class="group-c"` à 1.ª dos exclusivos (m.17) — âncoras para separadores.
- [ ] HTML: `role="row"` nas `<tr>` e `role="columnheader"/"rowheader"/"cell"`
      onde o display grid partir a semântica de tabela (a11y).
- [ ] CSS (≤640px): `.plan-table-wrap { overflow-x: visible; }` e
      `.plan-table { min-width: 0; display: block; }`.
- [ ] CSS: `thead tr` → grid de 3 colunas iguais, `position: sticky; top: 0;`
      fundo `rgba(7,7,13,0.92)` + blur, `th:first-child` (Features) escondido;
      z-index acima das linhas.
- [ ] CSS: `tbody tr` → bloco: `th[scope=row]` ocupa a largura toda (nome da
      feature, texto à esquerda), os 3 `td` numa grid de 3 colunas alinhada com
      o thead sticky (✓/— centrados, ~16px, alvo ≥44px de altura por linha).
- [ ] CSS: zebra suave (`tbody tr:nth-child(even)` com fundo 0.02) e
      `tr.group-b, tr.group-c` com `border-top` mais forte + margem.
- Done: a 375px (browser pane, resize mobile) a tabela não tem scroll
  horizontal, o cabeçalho Free/Plus/Premium fica visível ao fazer scroll, e a
  vista desktop (1280px) fica pixel-igual ao atual.

### Fase 2 — Polimento dos cartões e faixa a 375-430px (dependência: nenhuma)
Deliverable: cartões pagos, faixa Free e toolbar sem apertos nem quebras feias.
- [ ] `.price-card__topline`: permitir wrap do badge + "BEST FOR SERVERS" sem
      empurrar o título (flex-wrap + gap; recommended encolhe para 10px).
- [ ] `.seat-toggle` full-width a ≤640px, botões `flex: 1 1 0` (paridade com o
      bill-toggle que já o faz).
- [ ] Preço grande: `clamp()` mais contido a ≤430px (evitar €75.99 a rebentar).
- [ ] `.free-plan` a ≤430px: preço €0 e identidade na mesma linha, chips com
      `gap` menor; CTA mantém largura total.
- [ ] `.price-card__idnote` e `__deal`: padding/fonte ligeiros a ≤430px.
- Done: a 375px e 430px nenhum elemento da secção quebra em 2 linhas feias nem
  toca as bordas; botões de toque ≥44px.

### Fase 3 — Fecho: cache-bust, deploy e verificação (dependência: F1+F2)
Deliverable: live em vozen.org, verificado em mobile.
- [ ] `git mv site/css/main-v25.css site/css/main-v26.css` + refs nos 4 HTML
      (index, account, privacy, terms).
- [ ] prettier + `npm run build:site` limpos.
- [ ] Commit único (paths explícitos, PT, autoria humana), push, esperar
      pages.yml em background.
- [ ] Verificação live: v26 200 / v25 404; regra sticky presente no CSS live.
- [ ] Verificação visual: browser pane em https://vozen.org, resize 375×812,
      scroll até #premium, screenshot da tabela e dos cartões para o Diogo.
- Done: checklist curl verde + screenshot mobile entregue.

## UI Blueprint (escala: acessório — design system existente mantém-se)

- **Direção visual**: a atual (dark glass, aqua/âmbar) — o mobile herda, não inventa.
- **Tokens**: os existentes; fundo do thead sticky `rgba(7,7,13,0.92)` (mesma
  família do nav), zebra `rgba(255,255,255,0.02)`, separador de grupo
  `rgba(255,255,255,0.12)`.
- **Componentes/estados**: `plan-table` ganha o estado "mobile stacked"
  (thead sticky visível durante scroll = estado novo a testar); toggles ganham
  full-width mobile; sem estados loading/empty (conteúdo estático).
- **Layout**: mobile-first neste passe — o público do Discord está fortemente
  no telemóvel; breakpoint de trabalho ≤640px (o de 920px já empilha bem),
  afinações extra ≤430px.
- **Fluxo crítico**: scroll da secção → percebe os 3 planos nos cartões →
  desce à tabela → cabeçalho sticky mantém a orientação → CTA Ko-fi.
- **Acessibilidade**: roles ARIA quando o grid partir a semântica da tabela;
  alvos ≥44px; contraste dos glifos mantém-se (aqua/âmbar/cinzento sobre escuro).

## Riscos

- **`display` grid em elementos de tabela remove a semântica** para screen
  readers — mitigado na F1 com roles ARIA explícitos.
- **Sticky dentro de overflow não funciona**: o `overflow-x: auto` do wrapper
  TEM de passar a `visible` no breakpoint, senão o thead não cola — está na F1;
  se algum ancestral tiver overflow escondido, o sticky falha (descobrir na F1,
  custo baixo: testar no browser logo após a primeira iteração de CSS).
- **20 linhas continuam longas na vertical** mesmo bonitas — é inerente à
  "comparação completa"; a zebra + separadores de grupo mitigam. Se o Diogo
  continuar a achar longa, a decisão é reduzir linhas (fora deste passe).
- **Suposição declarada**: "não gostei no telemóvel" = sobretudo a tabela com
  scroll horizontal + apertos nos cartões. Se for outra coisa (ex.: quer tabs
  por plano), o plano muda — dizer antes do "executa".

## MVP

Fase 1 (tabela vertical com sticky) + Fase 3 (deploy) — é o que mata o scroll
horizontal. A Fase 2 é polimento no mesmo commit.

---

**Próxima ação concreta:** adicionar as classes `group-b`/`group-c` e os roles
ARIA às linhas da `plan-table` em `site/index.html`.
