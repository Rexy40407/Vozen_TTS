# Plano — Polir a HUD do formulário do /dashboard

> Planeado a partir do screenshot do estado atual (lista plana de 11
> linhas com checkboxes nativas). Estado: **aguarda aprovação do Diogo** — não
> implementar antes disso.

## Objetivo

Transformar o formulário funcional-mas-cru do `/dashboard` numa HUD com a
identidade visual do site (dark glass, aqua/blurple): settings agrupados por
tema com descrições, toggles estilizados em vez de checkboxes nativas, e um
fluxo de guardar com estado (só ativo quando há alterações). Assunção: "HUD" =
a vista do formulário do servidor; o picker de cartões (feito hoje) mantém-se.

## Scope

### In

- `site/js/dashboard-v2.js` → `dashboard-v3.js` (cache-bust) + ref em `site/dashboard.html`.
- CSS novo no `<style>` injetado pelo próprio dashboard JS (padrão atual; evita
  renomear `main-v30.css` e tocar em 5 páginas).
- Strings novas no dicionário inline en+pt do dashboard JS.

### Out

- Campos novos na API (`DASHBOARD_FIELDS` fica igual) — exceto expor o `locale`
  que a API **já aceita** mas o form nunca mostrou.
- Pickers de canal/voz, blocklist, pronúncias (é a "Fase 3b" do plano da Vaga 5).
- i18n ×10 do dashboard (continua en+pt; as outras línguas caem no en).
- Mexer no visual do resto do site (nav, account, index).

## Fases

### Fase 1 — Estrutura: secções, descrições e cabeçalho com identidade

Deliverable: o form agrupado e legível, ainda com controlos nativos.

- [ ] Cabeçalho do form: ícone do servidor (reutilizar `guildIconUrl`/iniciais do picker, 40px) + nome + botão "← Choose another server".
- [ ] Agrupar as 12 definições em 4 secções com título e divisor:
  - **Reading** (leitura): autoread, readBots, textInVoice, antispam
  - **Voice** (voz): xsaid, autojoin, greetOnJoin
  - **Community** (comunidade): streakAnnounce, soundboard
  - **Limits** (limites): maxChars, ratePerMin, locale
- [ ] Uma linha de descrição `muted` (~60 carateres) sob cada label, en+pt.
- [ ] Novo: linha `locale` como `<select>` (35 valores espelhando `SUPPORTED_LOCALES` de `src/i18n/index.ts` com nomes legíveis; o backend já valida via `sanitizePatch`).
- Done quando: no preview, o form mostra 4 secções tituladas, 12 linhas com descrição, cabeçalho com ícone; `document.querySelectorAll('.dash-section').length === 4`; zero erros de consola/CSP.

### Fase 2 — Controlos: toggle switches e inputs com a cara do site (depende da F1)

Deliverable: controlos estilizados, acessíveis, CSP-safe (sem handlers inline).

- [ ] Toggle switch CSS puro sobre a checkbox (track 40×22px, knob deslizante, ON = `--grad-brand`/aqua, OFF = `--line-2`), estados hover/focus-visible/disabled.
- [ ] Inputs numéricos e select com o estilo dos inputs do site (fundo `--bg-0`, borda `--line-2`, focus aqua) + hint do intervalo ("1–2000") junto ao label.
- [ ] Hover sutil por linha (fundo `--glass`), divisores `--line-2` só entre linhas.
- Done quando: computed styles confirmam track/knob e transições; navegação por teclado (Tab + Espaço) alterna toggles; focus ring visível.

### Fase 3 — Guardar com estado (depende da F2)

Deliverable: fluxo de save honesto — o botão diz a verdade.

- [ ] Dirty-tracking: snapshot da config ao carregar; "Save changes" `disabled` até algo mudar; contagem de alterações no botão ("Save 3 changes") opcional.
- [ ] Estados do botão: idle(disabled)/dirty/saving(spinner)/saved ✓(2s, volta a disabled)/erro (mensagem `--amber` + retry).
- [ ] Após guardar com sucesso, o snapshot atualiza (voltar a mexer reativa).
- [ ] Barra de guardar fixa no fundo do cartão em mobile (≤720px) para não fugir do ecrã em forms longos.
- Done quando: sequência carregar→sem alterações→botão disabled→alterar toggle→ativo→guardar→"Saved ✓"→disabled verificada no preview com API mockada.

### Fase 4 — Fecho: mobile, i18n e deploy (depende da F3)

- [ ] Passagem mobile 375px: secções empilham, toggles alinhados à direita, sem overflow horizontal.
- [ ] Strings novas (títulos de secção, descrições, estados do save) no dict en+pt.
- [ ] Cache-bust v2→v3, `npm run build:site`, verificação completa no preview (fluxo picker→form→save mockado), commit + push, live check em vozen.org.
- Done quando: deploy Pages verde + `curl vozen.org/dashboard | grep dashboard-v3.js` = 1.

## UI Blueprint

- **Tokens (já existem no main-v30.css — não criar novos):** fundos `--panel-2`/`--bg-0`/`--glass`; linhas `--line-2`; texto `--text-1`/`--text-2` (muted); acentos `--aqua`, `--grad-brand`, `--amber` (erro/aviso); fontes `--f-display` (Unbounded, títulos de secção), `--f-body` (Outfit), `--f-mono` (valores numéricos); raio `--radius`.
- **Componentes e estados:** toggle (off/on/hover/focus-visible/disabled·saving); número e select (idle/focus/invalid); botão save (disabled/dirty/saving/saved/erro); linha de setting (idle/hover); título de secção (eyebrow pequeno em aqua, tipo o "DASHBOARD" do hero).
- **Layout:** uma coluna, largura atual do cartão; secções separadas por 28px; linha = label+descrição à esquerda, controlo à direita (flex, `gap:16px`); mobile empilha sem quebrar o alinhamento do controlo.
- **Motion:** transições 150ms (knob, bordas, hover) — consistente com os cartões do picker; respeitar `prefers-reduced-motion`.
- **A11y:** toggles continuam `<input type="checkbox">` reais (label clicável, Espaço alterna); `aria-live="polite"` no estado do save (já existe no dashRoot); contraste ≥4.5:1 nos textos muted sobre `--panel-2`.

## Riscos

- **Screenshots do preview bloqueiam** (limitação conhecida) → verificação por `read_page` + computed styles, como hoje.
- **CSP `script-src 'self'`**: zero handlers inline; tudo por `addEventListener` (padrão atual do ficheiro, manter ES5).
- **Lista de locales duplicada no frontend** pode divergir do bot → risco aceite: o backend valida sempre (`sanitizePatch`), pelo que drift degrada para "opção em falta", nunca para erro; deixar comentário a apontar para `src/i18n/index.ts`.
- **`<select>` estilizado** tem limites cross-browser (dropdown nativo) → estilizar só o fecho (borda/fundo/seta), não as options.
- O ficheiro cresce (~+150 linhas) → manter helpers puros (`sectionRow`, `toggleRow`, `numRow`, `selectRow`) para legibilidade; sem framework.

## MVP

Fases 1+2 — secções com descrições + toggles estilizados. É o salto visual que se vê no screenshot; o save com estado (F3) e o fecho (F4) vêm logo a seguir mas o MVP já é mostrável.

**Próxima ação concreta:** aprovado o plano, arrancar a Fase 1 — renomear `dashboard-v2.js`→`dashboard-v3.js` e escrever o cabeçalho com ícone + as 4 secções com descrições en+pt.
