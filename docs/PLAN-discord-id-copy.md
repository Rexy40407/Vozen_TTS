# Plano — Discord ID escondido, revela no hover, clica para copiar

> **Notas de execução.** Feature pequena e visual, no painel de conta. Regras do projeto: comentários e commits em Português; NUNCA editar conteúdo com PowerShell `Get-Content`/`Set-Content` (corrompe UTF-8 — usar ferramentas de edição); `npm run build:site` tem de passar (guarda anti-mojibake); só caminhos explícitos no `git add`; commit/push só quando o humano pedir; não tocar em `.env`/bot/VPS.

## Objetivo / Goal
No painel de conta (estado logado), o **Discord ID** passa a estar **escondido por defeito** (mascarado). Quando o utilizador põe o **rato por cima (sem clicar)**, o ID **revela-se**. Existe um **sinal de "copiar" bonito** que indica que pode copiar; ao **clicar**, copia o ID para a área de transferência e mostra confirmação "Copiado!".

## Contexto do código (localizar antes de mexer — versões mudam)
- O ID é renderizado na função **`renderOk`** do JS principal do site: `site/js/main-v*.js` (procura a linha `class="ppanel__id">Discord ID: ${esc(u.id || "-")}</span>`).
- O CSS vive em `site/css/main-v*.css` no bloco **`.ppanel__id`** (dentro de `.ppanel__identity`).
- As labels do painel estão **hardcoded em inglês** (a "Discord ID:" também) — por isso os textos novos ("Click to copy" / "Copied!") podem ser **hardcoded** para manter o padrão. (i18n nos 10 JSON é opcional e não recomendado para 2 strings.)
- **Cache-bust:** o browser ignora `?v=`; a ÚNICA forma é renomear o ficheiro físico. Como mexes em JS **e** CSS, bumpa **os dois** (`main-vN.js`→`main-v(N+1).js` e `main-vM.css`→`main-v(M+1).css`) e atualiza as referências.

## Scope
### In
- Mascarar o número do ID por defeito; revelar em `:hover` **e** `:focus-within` (acessibilidade por teclado).
- Botão/afordância de copiar com ícone, tooltip "Click to copy", e estado "Copied!" após o clique.
- `navigator.clipboard.writeText(id)` no clique (o site é HTTPS, funciona).
### Out
- Sem mexer na lógica de OAuth/estado/`loadPanel`.
- Sem mudar o resto do painel (avatar, nome, grid de status) nem o resto do site.
- Sem novas dependências.

## Fases / Phases

### 1. Markup (no `renderOk` do JS)
- [ ] Trocar o `<span class="ppanel__id">` por um **`<button type="button" class="ppanel__id" data-id="${esc(u.id||"")}" aria-label="Copiar Discord ID">`** contendo:
  - a label `Discord ID: `
  - `<span class="ppanel__idnum">${esc(u.id || "-")}</span>` (é este `span` que se mascara)
  - um `<svg class="ppanel__copyic" ...>` (ícone de copiar, 14px, `fill="currentColor"`) + um `<svg class="ppanel__okic" ...>` (check, escondido por defeito)
  - `<span class="ppanel__tip" aria-hidden="true">Click to copy</span>` (tooltip)
- [ ] **Done:** o ID aparece como um botão focável; `data-id` tem o ID cru.

### 2. Handler de copiar (no wiring do painel, onde já se ligam `#ppLogin`/`#ppLogout`)
- [ ] Ligar `click` no `.ppanel__id`: `navigator.clipboard.writeText(el.dataset.id)`; em sucesso, adicionar classe `is-copied` ao botão e mudar o texto da tooltip para "Copied!"; remover ao fim de **1500ms** (`setTimeout`). Envolver em `try/catch` (se o clipboard falhar, não rebentar).
- [ ] **Done:** clicar copia mesmo o ID (testar colando algures) e mostra "Copied!".

### 3. CSS (no bloco `.ppanel__id`)
- [ ] Aplicar as specs da secção **UI Blueprint** abaixo (mascarar via `blur`, reveal no hover/focus, tooltip, estado copiado).
- [ ] **Done:** por defeito o número está borrado; hover revela suave; ícone de copiar visível e alinhado.

### 4. Fecho
- [ ] `npm run build:site` passa. Verificar a 375px e 1440px, e testar o teclado (Tab até ao ID → Enter copia).
- [ ] `grep -rn "main-vN\|main-vM" site/` (versões antigas) vazio; refs novas presentes em `index.html` + `account.html` (JS) e `index/account/privacy/terms` (CSS).

## UI Blueprint (reutilizar tokens de `:root` em `main-v*.css`)

**Direção:** discreto, tátil, "informação sensível sob um véu". Reutiliza `--text-1/2`, `--line`, `--aqua` (sucesso), `--f-mono`, `--radius`.

**Componente `.ppanel__id` (agora um botão):**
- Base: `display:inline-flex; align-items:center; gap:8px;` fonte `--f-mono` ~12px, cor `--text-2`, `background:transparent; border:1px solid transparent; border-radius:10px; padding:4px 8px; cursor:pointer; position:relative;` alvo de toque ≥44px (garantir com padding/min-height).
- **Máscara (default):** `.ppanel__idnum { filter: blur(5px); transition: filter .18s ease; user-select:none; letter-spacing:.02em; }`
- **Reveal:** `.ppanel__id:hover .ppanel__idnum, .ppanel__id:focus-within .ppanel__idnum, .ppanel__id.is-copied .ppanel__idnum { filter: blur(0); user-select:text; }`
- **Hover do botão:** `border-color: var(--line); background: rgba(255,255,255,.04); color: var(--text-1);`
- **Ícones:** `.ppanel__copyic{opacity:.7} .ppanel__id:hover .ppanel__copyic{opacity:1}` — o `.ppanel__okic` só aparece com `.is-copied` (troca copy↔check).
- **Estado copiado:** `.ppanel__id.is-copied { color: var(--aqua); border-color: rgba(46,230,200,.3); }` (flash suave).
- **Tooltip `.ppanel__tip`:** posicionada por cima (`position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);`), `background: var(--glass-2); border:1px solid var(--line); border-radius:8px; padding:3px 8px; font-size:11px; color:var(--text-1); white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .15s;` — visível em `:hover`/`:focus-within` (`opacity:1`). Com `.is-copied`, o texto passa a "Copied!" (o JS troca o `textContent`) e a cor a `--aqua`.
- **Foco:** `:focus-visible { outline:2px solid var(--aqua); outline-offset:2px; }`

**Acessibilidade:** o `<button>` é focável e ativável por Enter/Espaço; reveal também em `:focus-within`; `aria-label="Copiar Discord ID"`; tooltip `aria-hidden`.

**Movimento:** dentro de `@media (prefers-reduced-motion: reduce)`, tirar as `transition` (o reveal continua a funcionar, mas instantâneo).

## Riscos / Risks
- **Cache-bust incompleto** (bumpar JS mas esquecer CSS, ou falhar uma ref) → visual velho. Mitiga: o `grep` do fim.
- **`blur` não é segurança real** (só esconde de olhares casuais / screen-share) — é o objetivo pretendido, não proteção de dados. OK.
- **Clipboard** exige HTTPS + gesto do utilizador: ambos garantidos (vozen.org é HTTPS, é um clique). Ainda assim, `try/catch`.
- **Mudar `<span>`→`<button>`** pode herdar estilos de botão do site — reset explícito no CSS (`background/border/font` como acima) para não parecer um botão genérico.

## MVP
Fim da **Fase 3**: ID borrado por defeito, revela no hover, ícone de copiar visível e o clique copia com "Copied!". É a feature inteira.

**Próxima ação concreta:** localizar a função `renderOk` no `site/js/main-v*.js` atual e a regra `.ppanel__id` no `site/css/main-v*.css`, e confirmar a versão para o cache-bust.
