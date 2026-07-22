# Plano: cartões de preço em matriz ✓/✗ + instrução do Discord ID na compra

> Pedido do Diogo (2026-07-11): (1) nos 3 cartões de preço, mostrar o que cada plano TEM
> com ✓ e o que NÃO tem com ✗ (como no mockup do cartão Free); pontos compostos são
> divididos em pontos atómicos — "o máximo de pontos possíveis". (2) Dizer ao comprador
> para pôr o **Discord ID na nota da compra do Ko-fi** (senão o premium não ativa sozinho).
> Contexto já resolvido: o webhook lê `(N servers)` do nome do produto (fix `4863dbe` live).

## Objetivo

Os 3 cartões (Free / Plus / Premium) passam a mostrar a MESMA lista de features, pela mesma
ordem, com ✓/✗ por plano — comparação instantânea. E o fluxo de compra passa a dizer, no
sítio certo (junto ao botão de compra), que o Discord ID vai na nota do Ko-fi.

## Scope

### In
- Matriz de 18 pontos atómicos (tabela abaixo) nos 3 cartões de `site/index.html#premium`.
- Estilo ✗ novo no CSS (linha esbatida, marca ✗) + cache-bust `main-v20.css` → `v21` em
  TODAS as páginas que o referenciam (index, account, privacy, terms).
- Nota do Discord ID sob os botões de compra (Plus e Premium) com link para `/account`
  (onde há o botão "Copiar Discord ID").
- Frase do Discord ID acrescentada à resposta do FAQ "What does Premium include?".
- i18n: chaves novas traduzidas nas **10 línguas** (`tools/i18n-src/*.json`, secção `ui`);
  rebuild `i18n-v15.js` → **`i18n-v16.js`** (cache-bust) + refs nas 2 páginas + fallbacks
  EN no HTML.
- Verificação em browser (toggles mensal/anual e 3/10 servidores, EN+PT, mobile, sem erros
  de CSP) + `npm run build:site` + deploy + verificação live.

### Out
- Alterações ao JS (`main-v25.js`) — os toggles existentes não mudam de lógica.
- Preços, produtos Ko-fi, backend do webhook (já tratados).
- Redesign do resto da página; JSON-LD do FAQ fica só com o retoque EN da frase do ID.

## A matriz (fonte de verdade da copy)

Pontos atómicos derivados dos bullets atuais, divididos ao máximo. Chaves novas
`price.m.1..18` (secção `ui`); wording EN final (PT análogo):

| # | Ponto (EN) | Free | Plus | Premium |
|---|---|:-:|:-:|:-:|
| 1 | 38 voices | ✓ | ✓ | ✓ |
| 2 | 35 languages | ✓ | ✓ | ✓ |
| 3 | Auto-read channel | ✓ | ✓ | ✓ |
| 4 | Jokes & greetings | ✓ | ✓ | ✓ |
| 5 | 13 of the 16 games | ✓ | ✓ | ✓ |
| 6 | Robot & Echo effects | ✓ | ✓ | ✓ |
| 7 | Weekly leaderboard | ✓ | ✓ | ✓ |
| 8 | Full admin kit | ✓ | ✓ | ✓ |
| 9 | All 8 voice effects — deep, demon, radio… | ✗ | ✓ | ✓ |
| 10 | Voice clone (/voice clone) | ✗ | ✓ | ✓ |
| 11 | Word Chain | ✗ | ✓ | ✓ |
| 12 | Wordle | ✗ | ✓ | ✓ |
| 13 | Chess | ✗ | ✓ | ✓ |
| 14 | /rizz | ✗ | ✓ | ✓ |
| 15 | 50 personal pronunciations | ✗ | ✓ | ✓ |
| 16 | In the call 24/7 | ✗ | ✗ | ✓ |
| 17 | Yours personally — goes where you go | ✗ | ✓ | ✗ |
| 18 | For everyone in the server | ✗ | ✗ | ✓ |

Notas de design da matriz:
- 17 e 18 são o contraste honesto Plus↔Premium (pessoal vs servidor). O ✗ no Premium em
  #17 é deliberado (o Premium é do servidor, não te segue) — ver Riscos.
- Os `<li>` usam `class="no"` nos ✗; ordem idêntica nos 3 cartões.

## Nota do Discord ID (copy EN final; PT análogo)

Sob cada botão de compra (chave `price.idNote`, com o link para a página da conta):

> ⚠️ At the Ko-fi checkout, paste your **Discord ID** in the message box — that's what
> activates your Premium instantly. Copy yours on the [account page](/account).

FAQ (acrescento à resposta "What does Premium include?"): "When buying on Ko-fi, paste
your Discord ID in the checkout message so it activates instantly (copy it at
vozen.org/account)."

## Fases

### Fase 1 — Copy EN+PT + HTML da matriz
- [ ] Escrever os 18 pontos + idNote em EN e PT (as línguas-mãe do catálogo).
- [ ] `site/index.html`: substituir os 3 `<ul class="ticks">` pela matriz (18 `<li>`,
      `data-i18n="price.m.N"`, `class="no"` nos ✗ conforme a tabela); acrescentar
      `<p class="price-card__idnote" data-i18n="price.idNote">` sob os 2 botões de compra.
Done: HTML serve a matriz completa nos 3 cartões (verificado por curl local).

### Fase 2 — CSS (estilo ✗) + cache-bust
- [ ] `main-v20.css` → `main-v21.css` (git mv) + atualizar a ref nas 4 páginas HTML.
- [ ] Estilo novo: `.ticks li.no` — texto `var(--text-2)` (esbatido), marca ✗ (cinza/rosa
      suave) no `::before` em vez do ✓; `.price-card .ticks` com `gap` ~9px e fonte ~14.5px
      (18 pontos precisam de densidade); `.price-card__idnote` pequena, âmbar suave.
Done: os ✗ visualmente distintos dos ✓; cartões alinhados; mobile ok.

### Fase 3 — i18n (10 línguas) + build v16
- [ ] Adicionar `price.m.1..18` + `price.idNote` à secção `ui` dos 10 `tools/i18n-src/*.json`
      (en, pt escritos; ar, de, es, fr, ko, ru, tr, zh traduzidos).
- [ ] Remover as chaves antigas `price.free.1-4`, `price.plus.1-4`, `price.pro.1-4` dos 10
      ficheiros (mortas) — manter `price.*.name/per/note/deal/badges`.
- [ ] FAQ: acrescentar a frase do Discord ID à resposta do Premium nos 10 ficheiros + no
      JSON-LD EN do index.html.
- [ ] `tools/build-i18n.mjs`: output → `i18n-v16.js`; `git mv site/js/i18n-v15.js` →
      rebuild; atualizar `<script src>` no index e account; fallbacks EN no HTML = copy nova.
Done: `node tools/build-i18n.mjs` gera v16; zero refs a v15; PT no browser mostra a matriz.

### Fase 4 — Verificação + deploy
- [ ] `npm run build:site` (guard de mojibake) verde.
- [ ] Browser: EN+PT; toggle mensal/anual; toggle 3/10 servidores; mobile ~375px; consola
      sem erros de CSP; ✗ legíveis; idNote visível e com link a funcionar.
- [ ] Commit (paths explícitos, sem tocar nos docs de outras sessões) + push → pages.yml.
- [ ] Verificação live: curl a vozen.org confirma v16/v21 + matriz; refs antigas 404/mortas.
Done: produção a servir a matriz nas 10 línguas.

## UI Blueprint (âmbito: só a secção #premium)

- **Tokens**: reutilizar os existentes (`--text-0/-2`, `--amber`, verde dos ticks). Nada novo.
- **Componente `.ticks` (estados)**: `li` (✓, como hoje: bolinha verde/âmbar + texto
  `--text-0`) e `li.no` (✗: marca cinza-rosada sem glow, texto `--text-2`, sem strikethrough
  — legível, não "riscado"). Densidade: gap 9px, fonte 14.5px dentro de `.price-card`.
- **Hierarquia**: os ✓ primeiro? NÃO — ordem fixa da matriz nos 3 cartões (a comparabilidade
  vence a estética); o cartão Free fica naturalmente com os ✗ todos no fundo (como o mockup).
- **idnote**: 12.5–13px, cor `--text-2` com **Discord ID** em `--amber`; margem 10px acima
  do botão. Não competir com o botão de compra.

## Riscos

- **Cartões altos** (18 pontos): mitigado pela densidade (Fase 2); se ainda assim ficar
  desproporcionado no mobile, o fallback aprovável é fundir 11–13 num só ponto "Word Chain,
  Wordle & Chess" (−2 pontos). Decisão do Diogo ao ver no browser.
- **✗ no cartão Premium** (#17 "goes where you go"): honesto mas invulgar em pricing pages;
  se parecer mal, remove-se o par 17/18 e volta-se ao wording por-cartão. Diogo decide ao ver.
- **Traduções das 8 línguas não-mãe**: feitas por IA com qualidade razoável; frases curtas
  (nomes de features) têm risco baixo.
- **Cache-bust duplo (CSS v21 + i18n v16)**: qualquer ref esquecida parte a página — a
  verificação da Fase 4 (grep por v20/v15 + browser) cobre isto.

## MVP

Fases 1–2 (matriz + ✗ + idNote em EN, com fallbacks) já entregam o pedido visível; a Fase 3
completa as 10 línguas; a Fase 4 põe live.

---

**Próxima ação concreta:** Fase 1 — escrever a copy EN+PT dos 18 pontos + idNote e editar os
3 `<ul class="ticks">` do `site/index.html`.
