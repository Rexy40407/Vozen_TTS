# Plano 036 — Modal "Não estás a conseguir?" (o Ref como chave de suporte)

Escrito 2026-07-17, contra o commit `132605a`. Planeamento apenas —
execução por ordem explícita.

## Objetivo

O recibo de email do Ko-fi mostra `Ref: S-M1X823C9FW` — a única coisa com ar de
código no email inteiro. Quem procura um código encontra aquilo, cola no site e leva
"não encontrei nenhuma compra". Ideia do Diogo: a linha destacada do cartão de
ativação passa a abrir um **modal** (blur no fundo, X, clique-fora fecha) que pede o
Ref; no fundo do modal, "ainda não estás a conseguir?" → só aí o link do suporte.

**A restrição que molda tudo: o Ref nunca pode ativar sozinho.** O webhook do Ko-fi
envia `kofi_transaction_id`, `email`, `shop_items`, `message`, `tier_name`, `amount`,
`url`, `type` — e mais nada. O Ref do recibo não vem; não há como o ligar à compra
por código. O que o modal PODE fazer, e este plano faz:

1. **Guiar para o caminho que ativa** — botão "Go to your order" do email → copiar o
   endereço da página → colar no campo principal (o servidor extrai o UUID de
   qualquer forma de URL desde `2501e86`).
2. **Transformar o Ref na chave do caminho humano** — um clique envia (Discord ID,
   Ref) para o Diogo; ele encontra a encomenda pelo Ref no painel do Ko-fi e faz
   `/premium grant`. Para o comprador é quase o que o Diogo imaginou: escreve o Ref,
   carrega num botão, recebe o passe — minutos depois, pela mão do dono.

## Scope

### In

- Primeiro modal do site: backdrop `position:fixed` com blur, X, clique no backdrop
  fecha, **Esc fecha**, foco inicial no modal e devolvido ao trigger ao fechar,
  `role="dialog"` + `aria-modal` + `aria-labelledby`.
- Trigger: a linha `claim.lostHelp` do cartão passa a botão que abre o modal; o link
  do suporte muda-se para DENTRO do modal, no rodapé (href inline — nunca
  `js-support`, ver teste `offers a way back`).
- Conteúdo do modal: passo 1 = guia "Go to your order → copia o endereço → cola no
  campo de ativação"; passo 2 = campo Ref + botão "pedir ajuda"; rodapé = "Ainda não
  estás a conseguir? → suporte".
- **Interceção no campo principal:** input em forma de Ref (`S-` + 8–12
  alfanuméricos) não vai ao servidor — mensagem dirigida ("isso é o Ref do email…")
  + abre o modal. Client-side, antes do fetch.
- **Campo Ref à prova de burros:** se o que a pessoa lá colar contiver um UUID,
  corre o claim normal (reusa `extractReceiptCode`) — a pessoa não tem de saber a
  diferença entre Ref e código.
- `POST /api/claim-help` autenticado (mesmo OAuth de `/api/link`), rate-limited
  (infra existente do router), Ref validado/sanitizado (só `[A-Za-z0-9-]` no que sai
  para o Discord, cap 40 chars), dedupe em memória (user+ref/24h), notificação via
  webhook Discord — reusar `ERROR_WEBHOOK_URL` (já tem dedupe) OU env novo
  `CLAIM_HELP_WEBHOOK_URL`; decidir ao ler `src/` na execução.
- Fallback sem servidor: se o POST falhar ou a API estiver off, o modal mostra uma
  mensagem pronta-a-copiar (com o Ref) + o link do suporte. O MVP funciona sem F3.
- i18n ×10 (~10 chaves novas `claim.help.*`), cache-bust i18n v28→v29, main
  v31→v32, css v33→v34, refs nos 5 HTML + testes.
- Reescrever PRIMEIRO os 2 testes acoplados à copy atual (`offers a way back…`,
  `translates the recovery copy…`) — senão o CI fica vermelho a meio, a mesma
  armadilha registada no plano 034.
- Bloco de **Terms do Ko-fi** corrigido ("pasting the transaction code" → colar o
  link do recibo + mencionar o botão de ajuda) entregue pronto-a-colar [needs Diogo].

### Out

- Aceitar o Ref como chave de ativação automática — **impossível**, o webhook não o
  envia. Se o Ko-fi um dia o incluir no payload, promover o Ref a chave automática
  torna-se trivial (guardar no `kofi_pending` + procurar por ele no claim).
- Lookup por email (rejeitado no plano 021 — o email não é segredo).
- Auto-match pelo email verificado do Discord (o fix estrutural que elimina códigos
  de vez; continua a ser o próximo grande passo, plano próprio).
- Persistência em BD dos pedidos de ajuda (dedupe em memória chega: 1 processo).

## Fases

### F1 — Testes primeiro (RED)

- [ ] Reescrever os 2 testes acoplados em `tests/operationalHardening.test.ts` para
      a forma nova: o cartão tem o trigger do modal; o suporte vive no modal com
      `${SUPPORT_URL}` inline (sem `js-support`); chaves novas presentes ×10.
- [ ] Testes novos (source-assertion): interceção Ref no `doClaim` (REF_RE testado
      ANTES do fetch — mutation-check obrigatório), modal com `role="dialog"`,
      fecho por Esc/backdrop/X presente no fonte.
- [ ] **Done:** vitest FALHA por conteúdo, não por ficheiro em falta (semear v29
      como cópia byte-a-byte do v28 se preciso — lição do 034).

### F2 — Modal + copy ×10 (GREEN) + deploy do site

- [ ] Markup/CSS/JS do modal; trigger; interceção; Ref→UUID fallback; mensagem
      pronta-a-copiar como fallback do POST.
- [ ] i18n ×10; cache-busts; `npm run build:site`; `npm run check` verde.
- [ ] Browser: 10 línguas cabem num cartão de 300px (lição do nowrap), AR/RTL ok,
      blur ok, Esc/X/clique-fora fecham, foco devolvido, reduced-motion respeitado.
- [ ] Push; Pages verde; live check (v29 → 200, v28 → 404, copy nova servida).
- [ ] **Done:** MVP no ar — modal guia + Ref gera mensagem de suporte pronta.

### F3 — `POST /api/claim-help` (TDD) + notificação ✅

- [x] Ler router/statusApi + o envio do `ERROR_WEBHOOK_URL`; decidir canal (reusar
      vs. env novo) e registar a decisão no plano.
- [x] TDD: validação, sanitização, rate-limit, dedupe, respostas ok/erro; nenhum
      dado além de (Discord ID, Ref, timestamp) sai para o webhook.
- [x] Wiring no modal: sucesso → "Recebido! Ativamos manualmente em breve — vais
      ver o passe nesta página."; falha → fallback da F2.
- [x] Deploy do bot (auto via `deploy-bot.yml`).
- [x] **Done:** submeter um Ref no site e ver a notificação chegar ao Discord —
      provado 2026-07-17. `CLAIM_HELP_WEBHOOK_URL` definido no VPS (webhook num
      canal privado com roles Developer/Staff). Um `S-TEST36F30K` no modal deu a
      mensagem verde no site E o `🆘 Activation help requested` (Discord ID + Ref +
      instruções de `/premium grant`) no canal. É o único passo que nenhum teste
      substituía.

**Decisão do canal, tomada a ler o código:** `CLAIM_HELP_WEBHOOK_URL` próprio, **com
fallback para `ERROR_WEBHOOK_URL`**. Reusar o `errorReporter` inteiro seria errado —
faz dedup por hash de stack e redação de segredos, e nenhuma das duas coisas se aplica
a "um comprador precisa de ajuda", que não é um erro. Mas o URL já existe e já é
vigiado, por isso o fallback faz a coisa funcionar sem tocar no VPS; separar depois é
só definir a variável nova.

Verificado ponta-a-ponta contra o servidor real (não só a lógica pura): 401 sem token
e com token inválido, 400 sem Ref, 200 no válido, 200 `deduped:true` no repetido (o
webhook recebeu 2 mensagens e não 3), OPTIONS 204 com o CORS certo, GET 405. Um Ref
hostil (`@everyone \`hack\` S-XYZ99`) chega ao Discord como texto inerte
`everyonehackS-XYZ99`, com `allowed_mentions: {parse: []}` por cima.

### F4 — Ko-fi e VPS [needs Diogo]

- [ ] Colar o bloco de Terms corrigido (entregue na execução).
- [ ] Se F3 escolher env novo: criar a variável no VPS + restart.
- [ ] Prova ponta-a-ponta: compra de teste → fingir recibo perdido → resolver tudo
      só pelo modal.

## UI Blueprint (confinado ao modal)

- Tokens existentes, nada novo: fundos do painel, `--line`, `--text-0/2`, `--aqua`,
  radius e fontes do site.
- Backdrop: `fixed inset:0`, rgba escuro + `backdrop-filter: blur(6px)`; sem
  transição quando `prefers-reduced-motion`.
- Caixa: max-width 420px, margin 16px, `max-height: 85vh` + overflow auto; X com
  área de toque ≥40px.
- Estados: input Ref (normal/foco/erro), botão enviar (normal/working/disabled),
  mensagens ok/erro reusam o padrão `claimmsg`.
- A11y: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; Esc fecha; foco
  gerido; RTL verificado em árabe.

## Riscos

- **A expectativa de origem está errada, e é melhor dizê-lo já:** "introduz o Ref e
  ativa" não pode existir — o Ko-fi não envia o Ref no webhook. Este plano dá ao Ref
  o melhor uso possível (chave do caminho humano com um clique). Não é uma limitação
  nossa; é do payload do Ko-fi.
- **72 horas:** o passo 1 do modal depende do botão do email funcionar. Se o href
  do botão não contiver o UUID, o passo 1 morre 3 dias depois da compra e o passo 2
  (Ref) torna-se O caminho — o modal já está desenhado para isso. O clique de
  verificação (botão direito no botão do email → copiar endereço) continua pendente
  e afina a copy do passo 1.
- Notificações abusáveis → OAuth + rate-limit + dedupe + sanitização (injeção de
  conteúdo em webhook Discord é um vetor real; só `[A-Za-z0-9-]` passa).
- Primeiro modal do site → risco de layout nas 10 línguas e em RTL; mitigação:
  verificação browser explícita na F2.
- Falso positivo da interceção (um tx id legítimo em forma de Ref): improvável — os
  tx ids do Ko-fi são UUIDs — e o modal continua a dar caminho. Aceite.
- Os 2 testes atuais estão acoplados à copy de hoje → F1 primeiro, senão CI
  vermelho.

## MVP

F1+F2: o modal no ar — guia o caminho que ativa e transforma o Ref numa mensagem de
suporte pronta. F3 torna isso num clique. F4 fecha o funil do lado do Ko-fi.

**Estado (2026-07-17):** F1–F3 feitas, deployadas e **provadas em produção**. Só falta
a F4 (textos do Ko-fi), que é ação do Diogo.

**F3+ (descoberta ao testar o painel real do Ko-fi):** a pesquisa de transações do
Ko-fi só casa por **nome ou email**, não pelo Ref — logo o Ref era inútil para o dono
o encontrar. O pedido de ajuda passou a levar o **email** que a pessoa usou no Ko-fi
(que o dono cola na pesquisa e encontra a encomenda paga num passo). O email é pista
de procura, não prova (plano 021 de pé); fica fora dos logs (PII); o endpoint recusa
qualquer coisa sem um `@` limpo (400 bad_email), por isso um Ref ou um `@everyone`
injetado nunca chega ao Discord. Deployado (`fe69e24`), provado e2e + browser.

**Próxima ação concreta:** colar no Ko-fi o bloco de Terms corrigido — ainda diz
"paste the transaction code" onde já devia dizer "paste the receipt link" + mencionar
o botão de ajuda.
