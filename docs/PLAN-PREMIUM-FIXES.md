# Plano: corrigir regressões do redesign Premium (commit 683d78b)

> Planeado em 2026-07-12. Estado de partida: redesign atual
> **já live** (faixa Free + 2 cartões pagos + tabela `plan-table`, main-v23.css,
> i18n-v20.js). Este plano corrige regressões SEM desfazer a estrutura nova.

## Objetivo

Manter o redesign atual mas repor o que se perdeu: os 8 pontos
órfãos voltam a aparecer (tabela passa a ser mesmo "completa"), o ✗ vermelho
substitui o traço "—" na tabela, e os emojis 🎁/💎 voltam onde faltam.

**Factos verificados (não re-descobrir):**
- Pontos órfãos (existem no i18n ×10 línguas, não renderizados em lado nenhum):
  `m.4` piadas, `m.5` 13/16 jogos, `m.6` Robot & Echo, `m.7` leaderboard,
  `m.12` Wordle, `m.13` Chess, `m.14` /rizz, `m.20` streaks.
- Tabela atual tem 12 linhas: m1,2,3,8 (base) · m9,10,11,15 (pagos) · m17 (Plus)
  · m19,16,18 (Premium).
- O 🎁 AINDA renderiza live (está nos valores i18n `price.pro.deal`/`price.max.deal`);
  só o fallback HTML o perdeu → flash sem emoji antes do JS. O 💎 foi mesmo
  substituído por ◆ no HTML (não é i18n).
- **Zero alterações i18n necessárias** → i18n-v20.js fica; só main-v23.css→v24.
- Faixa Free (`free-plan__highlights`) mostra só m1, m2, m3.

## Scope

### In
- Tabela `plan-table` completa: 12 → 20 linhas, em 3 blocos ordenados.
- Faixa Free: 3 → 6 chips (juntar m5, m20, m8).
- ✗ vermelho `#ff5c5c` nas células `.has-not` (em vez de "—").
- 🎁 no fallback HTML dos deals; 💎 no badge Premium (◆→💎).
- Cache-bust main-v23.css → main-v24.css (4 ficheiros HTML referenciam-no).
- prettier + build:site + commit + deploy + verificação live.

### Out
- Qualquer mudança à ESTRUTURA atual (cartões de destaques, faixa Free,
  toolbar, tabela) — mantém-se.
- Alterações i18n (`tools/i18n-src/*`, build-i18n.mjs, i18n-v20.js) — nada muda.
- Código do bot (`src/**`) — nada muda; sem restart do VPS.
- Copy nova ("See every difference" fica: passa a ser verdade com 20 linhas).
- Screenshots/gif do resultado (o Diogo valida no browser dele).

## Fases

### Fase 1 — Tabela completa (20 linhas em 3 blocos)
Deliverable: `site/index.html` com a `plan-table` a renderizar TODOS os pontos.
- [ ] Bloco A "base grátis" (✓✓✓): m1, m2, m3, m4, m5, m6, m7, m20, m8 — 9 linhas.
- [ ] Bloco B "pagos (Plus e Premium)" (✗✓✓): m9, m10, m11, m12, m13, m14, m15 — 7 linhas.
- [ ] Bloco C "exclusivos": m17 (✗✓✗) · m19, m16, m18 (✗✗✓ com `has--premium`) — 4 linhas.
- [ ] Células novas seguem o padrão existente: `<td class="has">✓</td>` /
      `<td class="has-not">✗</td>` (o glifo muda na Fase 3, escrever já ✗).
- [ ] Fallback EN de cada `<th scope="row">` = valor de `price.m.N` no en.json.
- Done: `grep -c 'price\.m\.' site/index.html` na tabela = 20; ordem A→B→C;
  m17 é a ÚNICA linha com ✗ na coluna Premium.

### Fase 2 — Faixa Free com 6 chips (dependência: nenhuma; paralela à F1)
Deliverable: `free-plan__highlights` com m1, m2, m3, m5, m20, m8.
- [ ] Acrescentar `<li data-i18n="price.m.5">`, `price.m.20`, `price.m.8` após m3.
- Done: 6 `<li>` na faixa; os chips continuam em flex-wrap (CSS existente aguenta).

### Fase 3 — CSS: ✗ vermelho + cache-bust v23→v24 (dependência: F1)
Deliverable: `site/css/main-v24.css` (git mv) com o estilo do ✗.
- [ ] `git mv site/css/main-v23.css site/css/main-v24.css`.
- [ ] `.plan-table td.has-not { color: #ff5c5c; opacity: 0.85; font-weight: 600; }`
      (juntar ao bloco `.plan-table` existente; hoje o "—" herda cor apagada).
- [ ] Se os 6 chips da Free rebentarem a altura da faixa a 375px, apertar
      `gap`/`font-size` de `.free-plan__highlights` (só se preciso).
- [ ] Atualizar a ref `main-v23.css` → `main-v24.css` nos 4 HTML:
      index.html, account.html, privacy.html, terms.html.
- Done: `grep -rn 'main-v23' site/*.html` = 0; `grep -c 'main-v24' site/*.html` = 4;
  regra `.has-not` com `#ff5c5c` presente no v24.

### Fase 4 — Emojis 🎁 e 💎 (dependência: nenhuma; pode ir no mesmo commit)
Deliverable: fallbacks/badge alinhados com a identidade anterior.
- [ ] Fallback dos deals volta a ter 🎁: `🎁 Three servers. One subscription.` e
      `🎁 Ten servers. One subscription.` (o i18n já tem 🎁 — é só o fallback).
- [ ] Badge Premium: `<span aria-hidden="true">◆</span>` → `💎` (HTML puro).
- Done: `grep -c '🎁' site/index.html` = 2; badge Premium contém 💎.

### Fase 5 — Fecho: build, deploy, verificação live (dependência: F1–F4)
Deliverable: tudo live em vozen.org e verificado.
- [ ] `npx prettier --write site/index.html site/account.html site/privacy.html site/terms.html site/css/main-v24.css`
- [ ] `npm run build:site` (guarda anti-mojibake) — sem erros.
- [ ] Commit único, paths explícitos (NUNCA `git add .`; não tocar em
      docs/RESEARCH-TTS-BOT-VS-VOXI.md nem docs/*.md untracked de outras sessões),
      mensagem convencional em PT, sem trailers de coautoria.
- [ ] Push → esperar pages.yml (gh run list em background) — só site, sem deploy-bot.
- [ ] Verificação live (curl):
      main-v24.css 200 e v23 404 · 20 linhas `price.m.` na tabela ·
      6 chips na faixa Free · `#ff5c5c` na regra `.has-not` do CSS live ·
      2×🎁 e 1×💎 no HTML live.
- Done: checklist de curl toda verde.

## UI Blueprint (escala: acessório — o design system atual mantém-se)

- **Direção visual**: a existente (dark glass, aqua/âmbar, Unbounded+Outfit) — sem mudanças.
- **Tokens usados**: `--aqua` (✓ base), `--amber` (✓ premium via `has--premium`),
  **`#ff5c5c`** (✗ — mesmo vermelho da iteração anterior da matriz), `--text-1/2`.
- **Componentes tocados**: `plan-table` (novo estado ✗ vermelho nas células
  `has-not`), `free-plan__highlights` (mais 3 chips, estados existentes chegam).
- **Responsivo**: tabela já tem `overflow-x` + `min-width: 680px` — 20 linhas só
  crescem na vertical, sem risco horizontal; validar faixa Free a 375px (F3).
- **Acessibilidade**: contraste do `#ff5c5c` sobre fundo escuro ≥ AA para texto
  grande/glifo; a tabela mantém `<th scope>`; ✓/✗ são glifos — aceitável, sem
  mudanças de aria neste passe.

## Riscos

- **20 linhas tornam a tabela alta** — é o comportamento esperado de uma
  "comparação completa" (os cartões é que são o resumo); risco baixo, mas se o
  Diogo achar longa, a mitigação futura é fundir m11+m12+m13 numa linha "3 premium
  games" (fica FORA deste passe).
- **O ✗ pode "pesar" mais que o —** visualmente em 8 células da coluna Free ×
  blocos B/C; mitigação já no plano: `opacity: 0.85` e sem glow.
- **Cache do Cloudflare** pode servir v23 uns minutos após o deploy — verificar
  com cache-buster (`?v=`) ou aceitar TTL; o rename garante que ninguém fica
  preso à versão velha.
- **Suposição declarada**: manter a copy "See every difference" em vez de a
  suavizar — válida porque a tabela passa a ser completa. Se o Diogo preferir
  fundir jogos numa linha, a copy tem de mudar também (fora deste passe).

## MVP

Fases 1 + 3: tabela completa com ✗ vermelho, live. As fases 2 e 4 são polimento
do mesmo commit; a fase 5 é o fecho obrigatório.

---

**Próxima ação concreta:** editar a `plan-table` em `site/index.html` — inserir as
8 linhas em falta pela ordem do Bloco A/B/C da Fase 1.
