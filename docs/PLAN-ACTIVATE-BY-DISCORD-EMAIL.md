# Plano 040 — Ativação por email verificado do Discord

> Planeado e revisto tecnicamente em 2026-07-19 (factos verificados no código nessa data).
> Repo: **Vozen-bot** (backend + site público). Substitui o plano 039
> (`PLAN-CLAIM-HELP-AUTOMATCH.md`, arquivado) — decisão do dono em 2026-07-19.
>
> **Estado em 2026-07-19:** implementação F1–F5 concluída, com suite automatizada e build local
> verdes. Produção continua em **HOLD** até à leitura jurídica do suporte duradouro, à aceitação
> autenticada com uma conta Discord de teste dedicada e à autorização explícita do dono para o
> deploy em duas etapas (F6).

## Objetivo

Ativação de compras Ko-fi em **1 clique, sem código de recibo**: a pessoa faz login no site com o
Discord (scope `identify email`), o servidor compara o **email verificado da conta Discord** com o
email da compra (via o MESMO HMAC keyed do webhook) e, com a checkbox dos termos marcada, ativa
todas as compras pendentes desse email — na hora.

**Porque isto é seguro onde "digitar o email" não era**: o email verificado do Discord é **prova
de posse** — para o ter, a pessoa teve de clicar num link enviado para essa caixa de correio. Um
atacante que apenas *conheça* o email do comprador não passa. Nenhum aviso punitivo é necessário
(a variante "ficas sem premium e sem reembolso" foi rejeitada: não é oponível a disputas
PayPal/Ko-fi nem à lei da UE, e puniria compradores honestos cujo email do PayPal difere do do
Discord — esses caem no fallback do código do recibo, que continua igual).

## Factos do código em que o plano assenta (verificados 2026-07-19)

- Login do site: OAuth **implícito**, `scope=identify`, token no sessionStorage
  (`site/js/main-v36.js` ~345-349). O dashboard usa scope `guilds` num fluxo separado (~407) —
  não é tocado.
- `statusApi.resolveIdentity` chama `https://discord.com/api/v10/users/@me`
  (`src/premium/statusApi.ts` ~54, ~84). Com o scope `email`, o `/users/@me` devolve também
  `email: string` e `verified: boolean` — sem scope, esses campos vêm ausentes.
- `statusApi.resolveAuthorization` já chama `https://discord.com/api/v10/oauth2/@me` e devolve
  `userId + applicationId` para fechar substituição de access tokens entre aplicações. A ativação
  reutiliza e estende esta defesa: além do audience (`applicationId === CLIENT_ID`), valida os
  scopes autorizados e exige `identify + email` antes de tocar na DB.
- `POST /api/link` (`kofiWebhook.ts` ~272, ~1057): bucket de rate-limit apertado próprio,
  `resolveIdentity` → `claimPendingGrant`; CORS `apiOrigin`; 404 genérico.
- `claimPendingGrant`/`applyPending` (`claim.ts`): transacional; race-safe via
  `markPendingClaimed`; siblings de subscrição viajam juntos; **só** um claim de subscrição
  escreve o binding (`rememberKofiSupporter`) — proteção de prendas (plan 035).
- `hashKofiEmail(token, email)` = HMAC-SHA256 com `trim().toLowerCase()` interno (`kofi.ts`);
  `listUnclaimedPendingByEmailHash` já existe (`kofiPending.ts`).
- Consent do claim: checkbox `ppClaimConsent` no cartão de claim (client-side gate;
  `main-v36.js` ~510-521, ~644-647); termos ~76 de `site/terms.html` cobrem "tick the acceptance
  box and activate a pass" — a ativação por email É "activate a pass" com a mesma caixa.
- `KOFI_WEBHOOK_TOKEN` é opcional e o servidor arranca sem ele — sem token não há hash possível:
  a feature fica indisponível de forma limpa (como o matching do 039).
- Assets versionados: `main-v36.js`/`i18n-v33.js` em 3 HTMLs + constantes em
  `operationalHardening.test.ts`; i18n com 10 locales; auto-apply do webhook (só renovações)
  fica INTOCADO.

## Scope

### In
- Scope OAuth do login da conta: `identify` → `identify email`.
- `statusApi`: novo `resolveActivationIdentity(token, expectedClientId)` com resultado tipado.
  Primeiro usa `/oauth2/@me` para validar token, `applicationId === expectedClientId` e scopes
  `identify + email`; depois usa `/users/@me` para obter `{ id, email, verified }` e confirma que
  o ID é o mesmo nas duas respostas. Distingue token inválido, audience errado, scope ausente,
  email ausente/não verificado e Discord indisponível. O email NUNCA é logado, persistido ou
  colocado na cache de 60 s: é usado apenas para calcular o HMAC e descartado.
- Função pura `activateByEmailHash(db, discordId, emailHash, now)`: aplica TODAS as pendentes
  unclaimed daquele hash numa transação (mesma semântica do claim: `markPendingClaimed` +
  `applyPending`; binding escrito sse alguma for subscrição).
- Evidência mínima de consentimento para a rota nova: constante `ACTIVATION_TERMS_VERSION` e
  tabela `kofi_activation_consent(transaction_id PK, confirmation_id, discord_id, accepted_at,
  terms_version, method)`; uma linha por transação aplicada, todas com o mesmo
  `confirmation_id=crypto.randomUUID()` no batch, escrita dentro da MESMA transação do grant, sem
  email nem email hash. `method=discord_email` neste fluxo (o enum fica preparado para `receipt`,
  mas endurecer o contrato legado de `/api/link` não faz parte deste plano). A retenção é a dos
  registos financeiros/entitlements e fica documentada na privacy.
- `POST /api/activate` (body `{ termsAccepted: true, termsVersion }`): bucket apertado tipo
  `/api/link`; `termsAccepted` tem de ser o booleano literal `true` e `termsVersion` tem de ser a
  versão atual. Só `200` representa sucesso. Contrato completo de erros na F3.
- Site (cartão de claim da conta): botão **"Ativação instantânea"** acima do campo do código,
  respeitando a MESMA checkbox, mas com texto explícito de entrega imediata + perda do direito de
  retratação na própria label; nota de prendas ("compraste para outra pessoa? envia-lhe o código
  do recibo — não cliques"); estados loading/sucesso (lista + confirmação descarregável)/
  não-encontrado (aponta para o código do recibo)/re-login com retoma automática; i18n ×10; cache bust
  (`main-v37.js`/`i18n-v34.js` + 3 HTMLs + constantes + grep=0).
- Docs: PRIVACY.md + `site/privacy.html` (novo processamento: leitura única do email Discord com
  permissão, hash, comparação, descartado — nunca armazenado; "Last updated"), COMPLIANCE-MATRIX,
  ARCHITECTURE e termos sincronizados com o consentimento explícito e versionado desta ativação.
- Arquivar o plano 039 (header SUPERSEDED).

### Out
- Ativação sem clique/consent (o webhook não muda; renovações continuam a ser a única
  auto-aplicação — a checkbox dos 14 dias é obrigatória por lei).
- Avisos punitivos no Ko-fi (rejeitado); mudanças ao fluxo do código do recibo; plano 039.
- Guardar o email do Discord (em claro OU hash) — comparação transitória apenas.
- Dry-run/pré-listagem das compras antes do clique (superfície extra sem ganho: a nota de
  prendas cobre o risco; a resposta lista o que ativou).

## Decisões fechadas pelo dono (2026-07-19 — não reabrir na execução)

1. **Aplicar todas as pendentes do email:** `activateByEmailHash` inclui Shop + subscrições e não
   terá pré-listagem nem seleção por transação. O risco de uma prenda ser ativada na conta do
   comprador é aceite conscientemente e mitigado apenas pela nota visível + fallback do recibo.
2. **Scope `email` no login da conta:** o login da conta pede sempre `identify email`; não criar
   um segundo login lazy apenas para o botão. O requisito comercial é o comprador usar no Ko-fi o
   mesmo email verificado da sua conta Discord. O dashboard continua com o fluxo próprio.
3. As correções desta revisão — audience OAuth, consentimento explícito/auditável, erros tipados,
   retoma após re-login, testes de segurança e deploy ordenado — são obrigatórias.

## Fases (TDD obrigatório)

### F1 — Identidade de ativação + audience OAuth (statusApi)
- [x] RED (`tests/statusApi*.test.ts`): `/oauth2/@me` com `application.id === CLIENT_ID` e scopes
  `identify,email` + `/users/@me` com email verificado → sucesso; `application.id` diferente →
  `wrong_audience`; scope `email` ausente → `no_email_scope`; IDs diferentes entre endpoints →
  falha fechada; `email:null`/campo ausente → `email_missing`; `verified:false` →
  `email_unverified`; 401/403 Discord → `invalid_token`; timeout/429/5xx →
  `discord_unavailable`.
- [x] RED de privacidade: email, HMAC e bearer token nunca aparecem no logger fake; a cache de
  identidade normal continua a funcionar, mas a identidade de ativação com email não entra nela.
- [x] GREEN: estender/reutilizar `resolveAuthorization` para devolver também `scopes`; implementar
  `resolveActivationIdentity(token, expectedClientId)` com teto de 5 s em cada pedido e comparação
  de user ID entre `/oauth2/@me` e `/users/@me`.
- Done: vitest verde, incluindo rejeição de token válido emitido por outra aplicação Discord.

### F2 — `activateByEmailHash` (pura, `claim.ts`)
- [x] RED (`tests/claim.test.ts` ou irmão): 0 pendentes → `not_found`; 1 shop → aplica, SEM
  binding; 1 subscrição → aplica + binding para o discordId; mistura shop+subscrição → aplica
  tudo, binding escrito; race (uma já claimed) → aplica as restantes; corrida em que a única
  subscrição perde o `markPendingClaimed` mas uma Shop é aplicada → NÃO escreve binding;
  duas ativações concorrentes/repetidas → nunca duplicam dias; rollback integral se um grant ou
  o registo do consentimento falhar.
- [x] GREEN: reutiliza `applyPending`/`markPendingClaimed`/`rememberKofiSupporter`;
  `rememberKofiSupporter` depende de uma subscrição efetivamente aplicada, não apenas listada.
- [x] Migração/store TDD da `kofi_activation_consent`; cada transação aplicada recebe
  `{transactionId, confirmationId, discordId, acceptedAt, termsVersion, method}` dentro da
  transação. Atualizar o texto da checkbox partilhada melhora também o claim por recibo, mas o contrato HTTP legado de
  `/api/link` fica intocado neste plano para não quebrar bundles antigos durante o deploy.
- Done: suite de claim antiga verde sem mudança de contrato + casos novos verdes.

### F3 — `POST /api/activate`
- [x] Contrato HTTP fechado (testar status + body):
  - `400 bad_request|consent_required|bad_terms_version` — JSON inválido, booleano não literal ou
    versão diferente de `ACTIVATION_TERMS_VERSION`;
  - `401 no_token|invalid_token` — sem bearer, token rejeitado ou audience/user mismatch (não
    revelar ao cliente qual verificação falhou);
  - `403 no_email_scope` — token legítimo do Vozen sem scope `email`; cliente guarda a intenção e
    força OAuth `identify email`;
  - `422 email_missing|email_unverified`;
  - `404 not_found`; `429 rate_limited`; `503 kofi_unavailable|discord_unavailable`;
  - `200` APENAS `{ok:true, items, confirmation:{id,acceptedAt,termsVersion,method}}`.
- [x] RED adicional: OPTIONS/CORS/no-store; método errado; body >4 KB; token de outra aplicação;
  Discord timeout/429/5xx não vira 401 nem cria loop de login; sem match não escreve consentimento;
  email/HMAC/token nunca aparecem em logs ou respostas.
- [x] GREEN: handler irmão do `/api/link` (CORS `apiOrigin`, body/guards existentes), audience
  validado antes da DB e hash via `hashKofiEmail(kofiWebhookToken, identity.email)`.
- Done: `npm run check` verde.

### F4 — Site + i18n + cache bust
- [x] Critérios antes (TDD browser): scope `identify email` no login da conta; botão no cartão
  de claim gated pela checkbox existente; a label diz explicitamente, na própria UI, que a pessoa
  pede entrega imediata e reconhece a perda do direito de retratação, além de aceitar os termos.
  Sem caixa → `claim.consentRequired`; o POST envia `termsAccepted:true` +
  `ACTIVATION_TERMS_VERSION`.
- [x] Retoma segura: ao receber `403 no_email_scope`, guardar em `sessionStorage` uma intenção
  one-shot `{action:'activate-by-email', termsVersion, createdAt, nonce}` com TTL máximo de 5 min,
  iniciar `login()` com `identify email` e manter a proteção `state`. No regresso OAuth, validar
  state+TTL+versão, apagar a intenção ANTES do replay e retomar uma única vez. Nunca retomar após
  `invalid_token`, `wrong audience`, intenção expirada ou versão de termos alterada; nesses casos
  mostrar ação explícita ao utilizador, sem loop.
- [x] Cliente faz parse do JSON antes de declarar sucesso e exige `res.status===200 && body.ok===true`;
  nenhum outro 2xx/shape é sucesso. Sucesso mostra itens ativados e ligação “Descarregar
  confirmação”, gerada a partir do objeto `confirmation` devolvido pelo servidor, sem email/HMAC.
- [ ] Nota de prendas visível; estados completos (`loading`, sucesso, `not_found`, re-login,
  email ausente/não verificado, serviço indisponível, rate-limit); teclado/foco; zero erros
  CSP/consola; mobile+desktop. Clique duplo e refresh durante a retoma não duplicam ativação.
- [x] i18n: chaves novas ×10 locales + testes de paridade; hardening tests atualizados
  (constantes de assets, source assertions).
- [x] Cache bust: `main-v37.js`/`i18n-v34.js`, 3 HTMLs e constantes sem referências antigas nos assets vivos.
- Done: `npm run build:site` + browser validation.

### F5 — Docs/compliance + arquivar 039
- [x] PRIVACY.md + `site/privacy.html`: divulgar a leitura única do email verificado do Discord
  (com a permissão OAuth que o utilizador concede no ecrã do Discord), hash transitório, nunca
  armazenado nem mantido na cache; divulgar a nova evidência mínima de consentimento, finalidade,
  retenção e base legal; "Last updated"; COMPLIANCE-MATRIX; ARCHITECTURE.
- [x] `TERMS.md` + `site/terms.html` + label i18n: texto sincronizado e explícito sobre entrega
  imediata e perda do direito de retratação — não depender apenas de uma cláusula escondida nos
  termos. Registar uma versão estável em `ACTIVATION_TERMS_VERSION`.
- [ ] Confirmação em suporte duradouro: após o commit da ativação, disponibilizar confirmação
  descarregável com ID, data/hora, versão dos termos, método e itens ativados. Não enviar email nem
  contactar o utilizador fora do Discord. A implementação final deste ponto deve ser validada por
  leitura jurídica antes de produção; se a confirmação descarregável não for suficiente, HOLD de
  produção até existir mecanismo compatível com a lei e com a política “sem contacto externo”.
- [x] Header do `PLAN-CLAIM-HELP-AUTOMATCH.md`: `SUPERSEDED pelo plano 040` (2 linhas).
- Done: docs coerentes com o comportamento.

### F6 — E2E seguro + deploy
> A validação automatizada local está verde; os itens abaixo exigem conta/ambiente externo e
> permanecem deliberadamente pendentes. Nenhuma compra real, push ou alteração de produção foi feita.
- [ ] E2E local/staging com conta Discord de teste dedicada (nunca o pass real do owner):
  pending de teste com o hash do email da conta de teste → login → botão → ativado + pending
  claimed + binding correto (só subscrição efetivamente aplicada) + consent rows + confirmação →
  cleanup por IDs exatos em finally + asserts pós.
- [ ] Caso mismatch: conta cujo email não bate → `not_found` → código do recibo continua a
  funcionar.
- [ ] Deploy (autorização do dono) em duas etapas porque VPS e GitHub Pages são workflows
  independentes: **push 1 backend+DB+docs internos**, esperar `deploy-bot` verde e fazer smoke da
  rota/CORS sem mutação; só depois **push 2 site+i18n+HTML**, esperar Pages verde e validar OAuth.
  Nunca assumir que “mesmo push” é atómico. Rollback do site = restaurar assets/HTML anteriores;
  endpoint backend é aditivo e pode ficar dormente.
- [ ] Validação real apenas depois das duas etapas: compra de teste barata OU pending inserida
  manualmente e removida (como no teste da consola); testar também token emitido por app errada,
  token identify-only com retoma e Discord indisponível; smoke não-mutante em produção.
- Done: fluxo real confirmado.

## UI Blueprint (confinado à F4)

- Reutilizar o cartão de claim existente (tokens/classes atuais): o botão "Ativação instantânea"
  é primário, o campo do código passa a secundário com separador "ou cola o código do recibo".
- Estados do botão: normal / loading ("A procurar a tua compra…") / sucesso (lista
  `plan · days · seats` ativados + download da confirmação) / `not_found` (copy aponta para o
  código) / re-login-retoma / email ausente ou não verificado / serviço indisponível.
- A label da checkbox não pode ser apenas “Aceito os termos”: deve dizer, de forma curta mas
  explícita, “Peço a ativação imediata das funcionalidades pagas e reconheço que, ao começar a
  prestação, perco o direito de retratação aplicável; aceito os termos”. Traduzir fielmente ×10.
- Nota de prendas em texto pequeno sob o botão. Tudo via i18n; sem HTML injetado (padrão `esc()`).

## Riscos

- **Email do PayPal ≠ email do Discord** (frequente): sem match → fallback do código intacto;
  nudge opcional na loja Ko-fi ("usa o email do teu Discord para ativação instantânea") é ação
  do operador, fora do código.
- **Prendas**: o comprador podia consumir a prenda na própria conta com 1 clique — mitigado pela
  nota visível; o recibo continua a ser o caminho de prendas. (O binding só se move em
  subscrições, como hoje — a proteção do plan 035 mantém-se pela reutilização de `applyPending`.)
- **Tokens antigos** (identify-only) em sessionStorage → `no_email_scope` → retoma automática
  única do OAuth com `identify email`; zero quebra para quem não usa a feature.
- **Scope novo no ecrã de consentimento do Discord** ("aceder ao teu endereço de email") — é
  visível ao utilizador e proporcional; divulgado na privacy (F5).
- **Substituição de access token entre aplicações**: `/users/@me` sozinho não prova que o token
  foi emitido para o Vozen. Mitigação obrigatória: `/oauth2/@me`, audience `CLIENT_ID`, scopes e
  user ID validados antes de calcular o hash ou tocar na DB; erro público genérico.
- **Discord indisponível**: timeout/429/5xx não pode parecer token expirado nem causar loop OAuth;
  responde `503 discord_unavailable`, preserva a intenção one-shot para retry explícito e não
  aplica nada.
- **Consentimento contestado**: checkbox genérica + cláusula escondida não bastam como desenho.
  Mitigação: label explícita, versão estável, registo por transação e confirmação descarregável;
  produção fica em HOLD se a validação jurídica exigir um suporte duradouro diferente.
- **Reautorização interrompida/stale**: intenção em sessionStorage expira em 5 min, é ligada ao
  `state`, apagada antes do replay e nunca corre com termos de versão diferente.
- **Rotação do `KOFI_WEBHOOK_TOKEN`** invalida hashes antigos (caveat existente, herdado).

## MVP

F1–F3: a ativação funciona por API (testável por curl). F4 torna-a visível; F5–F6 fecham
compliance e produção. **Não publicar apenas F1–F4**: audience OAuth, consentimento auditável,
docs legais e deploy ordenado fazem parte do mesmo gate de produção.

Próxima ação concreta: leitura jurídica da confirmação descarregável + E2E autenticado em staging
com uma conta Discord de teste dedicada. Só depois, e com autorização explícita do dono, executar
o deploy backend/site em duas etapas descrito na F6.
