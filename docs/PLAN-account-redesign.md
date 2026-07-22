# Plano — Embelezar o Portal de Conta (account.html)

> **Notas de execução.** Executar este plano fase a fase. É um redesign **visual only** — não mexer na lógica de login/OAuth/estado. Regras do projeto: comentários e mensagens de commit em Português; NUNCA editar conteúdo de ficheiros com PowerShell `Get-Content`/`Set-Content` (corrompe UTF-8 — usar ferramentas de edição); `npm run build:site` tem de passar (guarda anti-mojibake); não fazer `git add .`/`-A` (só caminhos explícitos); commit/push só quando o humano pedir.

## Objetivo / Goal
Elevar o portal de conta (`site/account.html` + painel `.premium-panel`/`.ppanel__*`) de "funcional" para "polido e premium", mantendo a estética glass/dark do site. Redesign **visual only** — a lógica de login/OAuth/estado NÃO muda.

**Assunções (confirmar antes de mexer, podem ter mudado):** repo em `bots-discord/Vozen-bot`; ficheiros atuais `site/css/main-v12.css`, `site/js/main-v16.js`, `site/js/i18n-v10.js`; o painel tem 5 estados (`soon`, `anon`, `loading`, `error`, `ok`) renderizados em `main-v16.js` (função `renderPanel`/`renderOk`).

## Scope
### In
- Polir os **5 estados** do painel, com foco no estado `ok` (logado).
- Cartão glass, cabeçalho de conta (avatar+nome+ID+logout), grid de estados (Premium/Plus com ✓/❌), botão de login, skeleton de loading, estado de erro.
- Micro-interações (hover, focus, entrada) com `prefers-reduced-motion` respeitado.
- Copy nova via i18n (10 línguas) **só se** adicionares strings.

### Out
- Sem alterar OAuth, `PREMIUM_API_BASE`, CORS, ou qualquer lógica de `loadPanel`/`renderOk`.
- Sem mexer no resto do site (index/pricing/nav) — só account.
- Sem novas dependências, sem frameworks, sem fontes novas.
- Sem tocar em `.env`, no bot, ou no VPS.

## Fases / Phases

### 1. Preparação + cache-bust
- [ ] Ler `site/account.html`, `site/css/main-v12.css` (blocos `.premium-panel`/`.ppanel__*`, ~linhas 572-660) e a função `renderOk`/`renderPanel` em `site/js/main-v16.js`.
- [ ] **Cache-bust (obrigatório):** o browser ignora `?v=`; a única forma é RENOMEAR o ficheiro físico.
  - Só CSS muda → renomear `main-v12.css` → `main-v13.css` e atualizar refs em `index.html`, `account.html`, `privacy.html`, `terms.html`.
  - Se mexeres no markup do JS → renomear `main-v16.js` → `main-v17.js` e atualizar refs em `index.html` + `account.html`.
- [ ] **Done:** `grep -rn "main-v12\|main-v16" site/` devolve vazio (para o que renomeaste).

### 2. Redesign do CSS do painel (o grosso)
- [ ] Aplicar as specs da secção **UI Blueprint** abaixo aos blocos existentes (não criar classes novas sem necessidade; reaproveitar `.ppanel__*`).
- [ ] **Done:** ao abrir `account.html` logado, o cartão tem borda-hairline em gradiente, avatar com anel, e as linhas Premium/Plus distinguem-se claramente entre ativo (aqua glow) e inativo (mute + call-to-action).

### 3. Estados anon / loading / error / soon
- [ ] `anon`: CTA centrado com o `.btn--discord` grande + subtítulo (`panel.noneSub`).
- [ ] `loading`: 2-3 barras skeleton com shimmer (CSS puro).
- [ ] `error`: ícone + `panel.error` + botão `Try again`.
- [ ] `soon`: manter, mas alinhado com o novo cartão.
- [ ] **Done:** forçar cada estado no browser (mudar `panelState.mode` via consola) e confirmar que nenhum parece "partido".

### 4. Micro-interações + a11y + fecho
- [ ] Entrada do cartão (fade+rise 0.3s), hover-lift nas linhas de status, focus-ring visível nos botões; tudo dentro de `@media (prefers-reduced-motion: reduce)` → sem animação.
- [ ] Contraste AA, alvos de toque ≥44px, `:focus-visible` em todos os interativos.
- [ ] `npm run build:site` passa (guarda anti-mojibake). Verificar responsivo a 375px e 1440px.
- [ ] **Done:** build verde + screenshot dos estados a 375/1440.

## UI Blueprint

**a) Direção visual:** premium discreto, glass profundo, "cockpit de conta". Menos "formulário", mais "dashboard pessoal". 3 adjetivos: *sereno, iluminado, tátil.*

**b) Tokens — REUTILIZAR os existentes** (`:root` em `main-v12.css`): superfície `--glass`/`--glass-2`, linhas `--line`/`--line-2`, highlight `--hi`, texto `--text-0/1/2`, acentos `--blurple`, `--aqua` (=ativo/sucesso), `--amber` (=Premium), `--pink` (=inativo/off), gradientes `--grad-brand`/`--grad-vivid`, raio `--radius` (22px). **Escala de espaço:** 6/10/14/18/24/32. **Não** introduzir hex fora desta paleta.

**c) Inventário de componentes (estados):**
- **Cartão `.premium-panel`** — surface `--glass-2`, `backdrop-filter: blur(14px)`, borda 1px com gradiente `--line-2`→transparente (via `border` + pseudo `::before` de máscara, ou `box-shadow` inset com `--hi`), `border-radius: var(--radius)`, sombra de elevação `0 24px 60px -24px rgba(0,0,0,.6)`, `padding: 22px`. Estado de entrada: fade + `translateY(8px)`.
- **Cabeçalho de conta** — avatar 46px com anel `--grad-brand` (2px, via `padding` + `background`), nome `--text-0` 15px/700, `.ppanel__id` mono `--text-2` 12px; `.ppanel__logout` como ghost (hover: `--line`).
- **Linha de estado `.ppanel__status`** — grid `[chip][label][mark]`:
  - `.is-on`: fundo `rgba(46,230,200,.07)`, borda `rgba(46,230,200,.28)`, mark ✓ em `--aqua` com glow; meta "Ativo até {data}".
  - `.is-off`: fundo `--panel-2`, borda `--line`, mark ❌ **suave** (`--pink` a ~55% opacidade, sem glow), + link discreto "Obter →" que aponta a `index.html#premium`.
  - hover (só `.is-off`): borda → `--line-2`, `translateY(-1px)`.
- **Chips** `.ppanel__chip--pro` (amber) / `--plus` (gradiente blurple) — já existem, só afinar padding/peso.
- **Botão `.btn--discord`** (estado anon) — já existe; aumentar para `padding: 12px 18px`, largura 100% no mobile.
- **Skeleton** (loading) — `.ppanel__skel` barras `--panel-2` com `@keyframes shimmer` (gradiente a atravessar).

**d) Layout/responsivo:** desktop-first (página de conta vista sobretudo em desktop, mas TEM de funcionar no telemóvel). Cartão `max-width: 560px`, centrado. A ≤480px: `padding` do cartão 16px, cabeçalho pode quebrar o logout para baixo, linhas de status mantêm-se em coluna.

**e) Fluxos (2):** (1) *anónimo* → vê CTA "Entrar com Discord" → OAuth → volta logado. (2) *logado* → vê identidade + 2 linhas de estado; se `is-off`, o link "Obter →" leva ao pricing.

**f) Acessibilidade:** contraste de texto AA (o `--text-2` sobre `--glass-2` já passa; confirmar o mono do ID), `:focus-visible` com outline `2px var(--aqua)`, alvos ≥44px (logout/login), animações atrás de `prefers-reduced-motion`.

**g) Ordem de implementação:** tokens (já existem) → cartão → cabeçalho → linhas de estado → estados anon/loading/error → polish. **Não** começar pelos estados soltos.

## Riscos / Risks
- **Cache-bust esquecido** (renomear ficheiro e falhar uma ref) → página serve CSS/JS velho. Mitiga: o `grep` do fim da Fase 1.
- **Mexer no markup do JS** (`renderOk`) obriga a bump `main-v16→v17` E a garantir que as classes CSS batem certo. Se só mudares CSS, evitas isto — **preferir CSS-only**.
- **Mojibake** se editares por engano com PowerShell → build falha. Usar só ferramentas de edição.
- **Strings novas de copy** exigem editar os 10 JSON em `tools/i18n-src/` + `node tools/build-i18n.mjs` (regenera `i18n-v10.js` e valida chaves iguais nas 10 línguas). Se puderes reutilizar chaves `panel.*` existentes, evita este risco.

## MVP
Fim da **Fase 2**: o estado logado (`ok`) com cartão glass, avatar com anel, e linhas Premium/Plus visualmente distintas (ativo vs inativo). Já dá para mostrar e é uma melhoria clara.

## Verificação final (antes de dizer "feito")
- [ ] `npm run build:site` verde.
- [ ] `grep -rn "main-v12\|main-v16" site/` vazio (para o que renomeaste) e refs novas presentes.
- [ ] Estados `ok`, `anon`, `loading`, `error`, `soon` todos apresentáveis.
- [ ] Responsivo a 375px e 1440px OK.

**Próxima ação concreta:** ler `site/css/main-v12.css` linhas 572-660 e a função `renderOk` em `site/js/main-v16.js`, e decidir se o redesign é CSS-only (preferível) ou precisa de tocar no markup.
