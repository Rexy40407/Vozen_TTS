# Plano 039 — Claim Help Automatch (definitivo, 2.ª revisão)

> ⛔ **SUPERSEDED (2026-07-19)** — substituído pelo **plano 040**
> (`PLAN-ACTIVATE-BY-DISCORD-EMAIL.md`): a ativação por **email verificado do Discord** resolve o
> mesmo problema com prova real de posse do email, sem consola de pedidos. Este documento fica
> como referência (o estudo de código em §5 continua válido). NÃO implementar.

> **Estado**: planeado; **2.ª ronda de revisão técnica concluída em 2026-07-18**. Todos os factos
> de código citados em §5 foram verificados nos ficheiros/linhas indicados nessa data; se o código
> divergir na execução, o código manda e o executor corrige o ponto correspondente e regista-o.
> **Execução**: implementação futura. **Repos**: Vozen-bot (store, API, site público `site/`) e
> vozen-helper-bot (consola admin `site/vozen.html`).
>
> **Objetivo**: quando um comprador Ko-fi pede ajuda de ativação, o sistema regista o pedido com
> consentimento explícito, cruza automaticamente email (HMAC keyed) + produto declarado com as
> compras pendentes e o binding, entrega o veredicto ao operador (SOS + consola) e reduz o grant
> assistido a uma ação administrativa validada no servidor — **sem nunca existir auto-grant**.

## 2. Resumo executivo

- **Problema**: o fluxo de ajuda atual (plan 036) envia (Discord ID, email) para um canal privado
  e nada mais — sem persistência, sem match, sem consentimento equivalente ao do claim normal, e
  o operador investiga tudo à mão no painel Ko-fi.
- **Solução**: pedido persistido com lifecycle + consentimento; matcher puro reutilizado pelo
  endpoint público e pela consola; SOS enriquecida (snapshot com timestamp); consola admin com
  três ações distintas (`selected_only` default, `link_subscription`, `transfer_subscription`)
  validadas atomicamente no servidor com snapshot otimista.
- **Limites de confiança**: email, produto declarado, match e binding são **indícios**, nunca
  prova de propriedade; a prova é a verificação humana de recibo/transação. O self-service
  principal continua a ser o **código de transação (UUID) / URL do recibo**.

## 3. Scope

- Nova tabela `claim_help_request` + store + retenção + privacy erase.
- Matcher core puro + wrapper público + loader batch admin.
- `POST /api/claim-help` reformulado (consent, produto, persist-first, notification lease).
- Modal público: select de produto, checkbox de consentimento, parsing do novo contrato,
  fallback com email+produto; i18n ×10; cache bust.
- API admin: list paginada (keyset), apply (3 modos), dismiss; auditoria pós-commit.
- Consola helper: secção "Pedidos de ajuda", badges separados, typed confirmation.
- Docs: PRIVACY.md, site/privacy.html, TERMS.md + site/terms.html (cláusula de ativação
  assistida), ARCHITECTURE.md, COMPLIANCE-MATRIX.md, adenda de auditoria, runbook do operador.

## 4. Non-goals (fora de scope)

- Auto-grant por email/produto/binding (incl. `binding=self` como "prova").
- `Ref S-…` como credencial em qualquer superfície.
- DMs não solicitadas (nunca notificar o comprador).
- Email em claro (ou HMAC completo) persistido, em logs, ou exposto na consola/API admin.
- Re-notificação automática quando um pending chega depois do pedido (melhoria futura, §40).
- Redesign da consola; frameworks novos; alterações não relacionadas; migrations destrutivas.
- Deploy sem autorização separada do dono; grants reais de produção como teste.

## 5. Estado atual confirmado no código (2026-07-18, 2.ª ronda)

- **Claim self-service** (`src/premium/claim.ts`): credencial = código de transação; `UUID_RE` +
  `extractReceiptCode` extraem o UUID de código puro/código+lixo/URL do recibo; email rejeitado
  com `use_receipt_code` antes da DB; `claimPendingGrant` é transacional; blast radius: subscrição
  arrasta TODOS os siblings de subscrição do mesmo email (**re-consultados live dentro da
  transação**) e só subscrição escreve binding (`rememberKofiSupporter`); shop order = só a
  própria, sem rebind; race protegido por `markPendingClaimed` (false ⇒ não re-aplica).
- **`Ref S-…` não é credencial**: intercetado no cliente (`REF_RE = /^S-[A-Za-z0-9]{6,16}$/`,
  `main-v36.js` ~29 e ~637: `claim.help.refPasted` + abre a ajuda); teste
  `operationalHardening.test.ts` "catches the Ko-fi order Ref before it reaches the server".
- **Consentimento no claim normal** (`main-v36.js` ~510-521): checkbox `ppClaimConsent`
  obrigatória, link `{terms}`→`/terms`, `doClaim` bloqueia sem ela (~644-647,
  `claim.consentRequired`); `site/terms.html` ~76: ativar = pedir entrega imediata + perder o
  direito de retratação de 14 dias (Diretiva 2011/83/UE art. 16(m)). **O modal de claim-help NÃO
  tem consentimento** (~545-558: só email) — gap que este plano fecha.
- **Endpoint de ajuda atual** (`kofiWebhook.ts` `handleClaimHelpRequest` ~413-537): rate-limit →
  `sanitizeEmail` → validação → OAuth → dedupe em memória (`claimHelpSeen`, 24h, responde
  `{ok,deduped:true}` sem enviar) → webhook SOS. **Nada persiste**; 503 se a notificação falhar.
- **`sanitizeEmail`** (`claimHelp.ts` ~42-47) remove tudo fora de `[A-Za-z0-9._%+@-]` —
  destrutiva para apóstrofos/Unicode; hoje é aplicada ANTES da validação e do envio (é a string
  que seguiria para qualquer hash — inaceitável para identidade).
- **HMAC** (`kofi.ts` `hashKofiEmail`): `HMAC-SHA256(webhookToken, email.trim().toLowerCase())`
  — a canonicalização vive DENTRO da função; reutilizá-la garante compatibilidade com
  `kofi_pending.email_hash`/`kofi_supporter.email_hash`. Rotação do token invalida hashes.
- **Auto-apply do webhook** (`kofiWebhook.ts` ~1185-1240, plan 035): só RENOVAÇÃO
  (`isSubscriptionPayment && !isFirstSubscriptionPayment`) com email já ligado
  (`lookupKofiSupporter`) se aplica sozinha; **tudo o resto pende** (primeira mensalidade,
  qualquer shop order, até payloads com Discord ID) porque o claim é o passo de consentimento.
  Shop order fora de `KOFI_SHOP_MAP` é DROPPED com log de erro.
- **Catálogo** (`kofi.ts` ~215-235): memberships por keywords; **`days = annual ? 365 : 30` —
  monthly = 30 CONFIRMADO**; Plus recebe `seats = PREMIUM_PASS_SEATS` (3) por irrelevância —
  seats de Plus não têm significado comercial; `KOFI_SHOP_MAP` = `code:plan:days[:seats]` com
  days/seats arbitrários (legacy/custom possíveis em pendings).
- **Lifecycle de dados** (`dataLifecycle.ts`): `eraseUser` = `DELETE FROM <t> WHERE user_id = ?`
  genérico sobre `USER_ERASE_TABLES` + bespoke (`kofi_supporter.discord_id`); rot-guard obriga a
  classificar tabelas com colunas-identificador. ⇒ a nova tabela usa **`user_id`**.
- **Token opcional**: `KOFI_WEBHOOK_TOKEN` pode estar ausente (`config/index.ts` ~400) e o
  servidor HTTP arranca sem ele se houver `statusApi`/`adminApi`/top.gg (`kofiWebhook.ts` ~1031)
  ⇒ `/api/claim-help` pode estar vivo sem token; nunca assumir string.
- **Site público**: modal gerado em `site/js/main-v36.js` (não no HTML); i18n
  `site/js/i18n-v33.js` com **10 locales** (`en,pt,fr,es,de,tr,ar,zh,ru,ko`) e testes de paridade
  ("every advertised site language"); assets versionados `main-v36.js`/`i18n-v33.js`/
  `main-v38.css` referenciados em `index.html`+`account.html`+`dashboard.html` e pinados em
  `operationalHardening.test.ts` (`SITE_JS`/`SITE_I18N`/`SITE_CSS`); `siteEsc.test.ts` encontra o
  bundle dinamicamente; POST atual: `{ email }`.
- **`site/privacy.html`**: linha ~40 "Last updated: 15 July 2026"; ~48 "**never asks for your
  email**, phone…"; ~138 activation-help "…is **not stored in our database**". Ambas as
  afirmações ficam falsas com esta feature ⇒ atualização obrigatória (§27).
- **`docs/COMPLIANCE-MATRIX.md`**: cobre disclosure+deletion (§1.5, §2.4, §3.2) e retenção
  (§2.6 lista o purge de 90d do `kofi_pending`) ⇒ a atualização é **obrigatória**, não "se
  aplicável".
- **Consola helper** (`vozen-helper-bot/site/vozen.html`): estática, sem frameworks; `api()`
  (Bearer sessão), `logoutStale()` em 403, `cell()`/`textContent`, boxes `.box`, `.tblwrap`;
  **`confirmDialog(opts)` (linha ~477) suporta apenas `title`/`body` (um único textContent) +
  labels + `danger`** — sem input digitado nem linhas múltiplas ⇒ precisa de extensão (§24).
- **Rotas admin** (Vozen-bot `kofiWebhook.ts`): sessão HMAC owner-only, CORS `adminPanelOrigin`,
  rate buckets, rotas síncronas dentro de `try` (500 limpo); rotas async carregam `.then/.catch`
  próprio (padrão BUG-01, ver `/api/admin/toptalkers`).

## 6. Invariantes de segurança e privacidade (não negociáveis)

1. **Human gate**: nenhum grant/link/transfer sem ação humana explícita do owner.
2. **Consentimento ≠ ownership**: a checkbox do requerente autoriza a ativação assistida; NÃO
   prova que é o comprador. A verificação de ownership é do operador (recibo/transação) e tem a
   sua própria acknowledgement (§19).
3. **Sem email em claro**: nunca na DB, na API admin, em logs ou auditoria. Em claro apenas:
   transitório no request público, na mensagem SOS privada (comportamento já divulgado) e no
   fallback local do browser.
4. **Sem HMAC em logs** (nem prefixos — identificador estável desnecessário).
5. **Servidor é a autoridade**: target derivado do pedido persistido; request↔transaction
   associados por `email_hash` no servidor; snapshots revalidados atomicamente; 409 em stale.
6. **Persist-first**: o pedido existe na DB antes de qualquer tentativa de notificação; a
   mensagem Discord é um snapshot, a consola live é a fonte de verdade.
7. **Sem DMs não solicitadas**; `allowed_mentions: { parse: [] }` mantido.
8. **Nunca hash não-keyed**; sem token Ko-fi a feature degrada explicitamente (§15/§31).

## 7. Terminologia e tipos partilhados

```ts
// (nomes recomendados; ajustar apenas se colidirem com convenções existentes)
export type DeclaredProduct =
  | 'plus_30' | 'plus_365'
  | 'premium3_30' | 'premium3_365'
  | 'premium8_30' | 'premium8_365';
export type ProductMatch = 'match' | 'mismatch' | 'undeclared';
export type BindingState = 'none' | 'self' | 'other';
// NOTA: o matcher produz sempre um destes 4. O caso "matching indisponível" (sem token, §15)
// NÃO é um AggregateMatch — representa-se por `match: null` na construção da SOS.
export type AggregateMatch = 'complete' | 'email_only' | 'product_mismatch' | 'none';
export type NotificationStatus = 'sent' | 'already_sent' | 'failed' | 'unavailable';
export type ApplyMode = 'selected_only' | 'link_subscription' | 'transfer_subscription';
export type RequestStatus = 'open' | 'applied' | 'dismissed';
/** Versão dos termos aceites no pedido de ajuda. Constante do contrato (código), NUNCA uma
 *  tradução nem o texto visual. Recomendado: data "last updated" dos termos, ex. '2026-07-19'. */
export const CLAIM_HELP_TERMS_VERSION: string;
```

Mapping `DeclaredProduct` → spec (função única no backend, `declaredProductToSpec`):

| wire | plan | days | seats no match | label base (en) |
|---|---|---|---|---|
| `plus_30` | plus | 30 | **ignorado** (§5: Plus seats=3 por irrelevância) | Plus — monthly |
| `plus_365` | plus | 365 | ignorado | Plus — annual |
| `premium3_30` | premium | 30 | `=== 3` | Premium 3 servers — monthly |
| `premium3_365` | premium | 365 | `=== 3` | Premium 3 servers — annual |
| `premium8_30` | premium | 30 | `=== 8` | Premium 8 servers — monthly |
| `premium8_365` | premium | 365 | `=== 8` | Premium 8 servers — annual |

Pendings legacy/custom (days/seats fora do catálogo) nunca são `match` de um declarado diferente;
a UI mostra os valores reais ("custom: premium 5srv 90d").

## 8. User journeys

1. **Public claim help**: login Discord → modal: email + select produto (7 opções: "não tenho a
   certeza" + 6) + checkbox de consentimento → POST → resposta com `notificationStatus` → UI
   mostra sucesso/fallback conforme §15/§21.
2. **Admin selected-only**: consola lista pedidos abertos → operador verifica recibo/transação
   fora do sistema → confirma (ack de ownership) → aplica SÓ a transação escolhida, sem tocar no
   binding → pedido resolve se não restarem pendings.
3. **Admin link subscription** (binding `none`, pendente de subscrição): snapshot dos siblings
   confirmado → aplica o conjunto confirmado + cria binding para o requerente → renovações
   futuras passam a auto-aplicar.
4. **Admin transfer subscription** (binding `other`): warning máximo, snapshot + ack + typed
   confirmation → aplica conjunto confirmado + **re**binding → renovações futuras mudam de conta.
5. **Dismiss**: operador fecha um pedido (com ou sem pendings) com auditoria; novo pedido
   equivalente cria request novo.
6. **Privacy erase**: `/privacy erase` remove todos os requests do `user_id` (caminho genérico).

## 9. Contrato público — `POST /api/claim-help`

Request (`Authorization: Bearer <token OAuth Discord>`):

```ts
{
  email: string,                     // obrigatório
  product?: DeclaredProduct | null,  // AUSENTE=preservar declaração anterior (regra DEFENSIVA:
                                     // nenhum cliente real omite — o bundle novo envia sempre e
                                     // um bundle legacy morre antes no consent_required; a regra
                                     // existe para requests manuais/futuros, não para "legacy");
                                     // null="não tenho a certeza" (limpa declaração anterior);
                                     // enum=substitui; inválido=400 bad_product
  termsAccepted: true,               // ausente/false => 400 consent_required (nada persistido)
  termsVersion: string               // !== CLAIM_HELP_TERMS_VERSION => 400 bad_terms_version
}
```

Validação por ordem: rate-limit (429) → JSON (400 `bad_request`) → email: comprimento ≤254,
rejeitar newline/CR/control chars/whitespace interior e backtick (400 `bad_email`; §5 nota — o
backtick é rejeitado para o display em code-span ficar fiel sem mutilar), forma mínima
`/^[^@\s]+@[^@\s]+$/` sobre o email **raw trimmed** → `product` (400 `bad_product`) → consent
(400 `consent_required` / `bad_terms_version`) → OAuth (401).

Response:

```ts
// 200 — o pedido FICOU PERSISTIDO (modo normal) ou notificado (modo degradado sem token):
{ ok: true, requestId: string | null, notificationStatus: NotificationStatus }
// requestId null APENAS no modo degradado sem token (nada persistido).
```

- Sem match info, sem `email_hash`, sem binding — **anti-enumeration**: a resposta tem a MESMA
  forma exista ou não compra/binding; copy pública neutra.
- 500 apenas quando a persistência falhou; 503 apenas no modo degradado (sem token) quando a
  notificação também falhou (nada ficou registado — comportamento atual preservado).
- Compat: body legado `{email}` (sem consent) ⇒ 400 `consent_required` — **decisão**: o bundle
  novo sai no mesmo push do repo, pelo que só bundles em cache (ou a janela VPS→Pages, §34) batem
  aqui. Comportamento REAL do bundle antigo num 400 (verificado no código atual): mostra o
  fallback copy-to-support — degradação graciosa, o pedido chega ao operador na mesma. O rename
  de assets torna a janela curta; nenhuma copy nova é necessária no bundle antigo (impossível).

## 10. Contratos admin

### 10.1 `GET /api/admin/claim-help?limit&cursor`

- Sessão obrigatória; CORS `adminPanelOrigin`; rota síncrona (só DB) no `try` existente.
- `limit`: inteiro 1..100, default **50**; inválido ⇒ 400. `cursor`: opaco
  (base64url de `{lastAt, requestId}`); inválido ⇒ 400 `bad_cursor`.
- Ordenação estável: `last_at DESC, request_id DESC` (keyset: `WHERE (last_at, request_id) <
  (cursor.lastAt, cursor.requestId)` na ordenação definida). Só `status='open'`.
- Response: `{ requests: AdminClaimHelpRow[], nextCursor: string | null, hasMore: boolean }`.

```ts
interface AdminClaimHelpRow {
  requestId: string; userId: string;
  declaredProduct: DeclaredProduct | null;
  firstAt: number; lastAt: number; count: number;
  consentedAt: number; termsVersion: string;
  match: {
    aggregate: AggregateMatch; binding: BindingState;
    fullMatchTransactionIds: string[];
    pendings: Array<{ transactionId: string; plan: string; days: number; seats: number;
                      isSubscription: boolean; createdAt: number; productMatch: ProductMatch }>;
  };
}
// NUNCA inclui email_hash nem qualquer derivado do email.
```

- Batch (sem N+1): para a página, 2 queries — `kofi_pending WHERE email_hash IN (…) AND
  claimed_at IS NULL` e `kofi_supporter WHERE email_hash IN (…)` — agrupadas por hash em memória
  e delegadas no core puro (§14).

### 10.2 `POST /api/admin/claim-help/apply`

```ts
{
  requestId: string,
  transactionId: string,
  mode: ApplyMode,
  ownershipVerified: true,            // acknowledgement de auditoria/UX; ausente/false => 400.
                                      // NÃO é prova nem segurança — o servidor valida tudo.
  expectedTransactionIds?: string[],  // OBRIGATÓRIO para link/transfer: snapshot confirmado
  expectedBinding?: BindingState      // OBRIGATÓRIO para link/transfer
}
```

Servidor — TUDO dentro de UMA `db.transaction` que devolve um resultado estruturado (o log de
sucesso só DEPOIS do commit — §26):

1. `getClaimHelpRequest(requestId)` → 404; `status!=='open'` → 409 `stale_request`;
   `consentedAt`/`termsVersion` inválidos (impossível por constraint, defesa extra) → 409.
2. Target = `request.user_id` (nunca do payload).
3. Carregar a transação (incluindo claimed) → nunca existiu: 404; claimed: 409 `tx_unavailable`.
4. `pending.email_hash === request.email_hash` (ambos non-null) → 409 `hash_mismatch`.
5. Recalcular binding live e siblings live (subscrição+mesmo hash, unclaimed), ordenados por
   `transactionId` ASC (determinístico).
6. Policy por modo:
   - `selected_only`: sempre permitido. `markPendingClaimed(tx)` (false → 409 `tx_unavailable`)
     + `applySinglePending` (§14). **Sem** siblings, **sem** binding.
   - `link_subscription`: exige `pending.isSubscription` (400 `bad_mode`) e binding live
     `none` (senão 409 `stale_transfer`). Comparar `expectedTransactionIds` (ordenados) com
     `[tx, ...siblings]` live e `expectedBinding==='none'` — divergência → 409 `stale_transfer`.
     Aplicar TODAS as do snapshot validado + `rememberKofiSupporter(hash, request.user_id)`.
   - `transfer_subscription`: exige `pending.isSubscription` e binding live `other` (senão 409
     `stale_transfer`). Mesma validação de snapshot. Aplicar conjunto + rebinding para
     `request.user_id`.
   - Nota: com binding `self`, link/transfer são rejeitados (`stale_transfer`) — o binding já está
     correto; usa-se `selected_only` por transação.
7. Recalcular pendings unclaimed do hash: 0 ⇒ `status='applied'`, `resolved_at=now`; senão
   continua `open`.
8. Resultado estruturado: `{ appliedTransactionIds, mode, bindingBefore, bindingAfter,
   requestStatus, remainingPendings, items }`.

Response 200 = o resultado acima (lista EXATA de transações aplicadas; sem PII além do
`userId` já conhecido). Erros: 400 payload/mode/ack; 403 sessão; 404; **409**
`stale_request|tx_unavailable|hash_mismatch|stale_transfer`; 500 limpo. Falha parcial impossível
(transação única; rollback automático).

### 10.3 `POST /api/admin/claim-help/dismiss`

`{ requestId }` → open⇒`dismissed`+`resolved_at`; já resolvido⇒409; inexistente⇒404. Permitido
com ou sem pendings (falsos positivos). Auditoria pós-commit.

## 11–13. Modelo de dados, constraints e store APIs

```sql
-- Pedido de ajuda de ativação (plan 039). NUNCA o email em claro — só o HMAC keyed
-- (hashKofiEmail). user_id = Discord ID (nome deliberado: eraseUser genérico).
CREATE TABLE IF NOT EXISTS claim_help_request (
  request_id                   TEXT PRIMARY KEY,   -- crypto.randomUUID()
  user_id                      TEXT NOT NULL,
  email_hash                   TEXT NOT NULL,
  declared_product             TEXT CHECK (declared_product IN
    ('plus_30','plus_365','premium3_30','premium3_365','premium8_30','premium8_365')),
  status                       TEXT NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open','applied','dismissed')),
  first_at                     INTEGER NOT NULL,
  last_at                      INTEGER NOT NULL,
  count                        INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  consented_at                 INTEGER NOT NULL,   -- consent obrigatório: sem ele não há INSERT
  terms_version                TEXT NOT NULL,
  last_notification_attempt_at INTEGER,
  notification_lease_until     INTEGER,
  last_notified_at             INTEGER,            -- só avança em SUCESSO de envio
  resolved_at                  INTEGER,
  CHECK ((status = 'open' AND resolved_at IS NULL) OR (status <> 'open' AND resolved_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chr_open
  ON claim_help_request (user_id, email_hash) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_chr_open_page ON claim_help_request (status, last_at, request_id);
-- Purga dos resolvidos por resolved_at (a dos abertos usa idx_chr_open_page):
CREATE INDEX IF NOT EXISTS idx_chr_resolved
  ON claim_help_request (resolved_at) WHERE status <> 'open';
```

- **Sem coluna `resolution`** (round 2): `status` é canónico; o CHECK impede combinações
  contraditórias. Tabela nova ⇒ constraints fortes desde o início, sem compat vaga com legacy.
- Colocação: bloco `CREATE TABLE IF NOT EXISTS` de `src/store/db.ts` (convenção; aditivo).
- Lifecycle: `USER_ERASE_TABLES += 'claim_help_request'`; rot-guard passa sem bespoke; o erase
  remove a row inteira (HMAC incluído) sem precisar do email.
- Retenção (job diário existente, `index.ts` ~458): `open` com `last_at < now-90d` e
  `applied|dismissed` com `resolved_at < now-90d` são apagados (metadata de notificação vai com a
  row). Fronteira estrita (`<`). Independente do erase. **Nota deliberada**: como o upsert
  atualiza `last_at`, a retenção dos abertos é POR ATIVIDADE — um requerente que insista renova o
  prazo do próprio pedido. É o comportamento pretendido (o pedido está vivo); o cap de 90d conta
  a partir do último contacto, alinhado com o propósito de suporte.

Store (`src/store/claimHelpRequests.ts`, nomes recomendados):

```ts
recordClaimHelpRequest(db, userId, emailHash, product: DeclaredProduct | null | undefined,
                       termsVersion, now): ClaimHelpRequestRow
// upsert no open existente de (userId,emailHash): count+1, last_at=now, consented_at=now,
// terms_version=nova; product: undefined preserva, null limpa, enum substitui.
// sem open (só resolvidos ou nada): INSERT novo request_id.
reserveNotification(db, requestId, now, windowMs = 24h, leaseMs = 60s):
  'reserved' | 'already_sent' | 'lease_held'
// UPDATE atómico: SET notification_lease_until=now+leaseMs, last_notification_attempt_at=now
//  WHERE request_id=? AND (last_notified_at IS NULL OR last_notified_at < now-windowMs)
//    AND (notification_lease_until IS NULL OR notification_lease_until < now)
// changes=1 => 'reserved'; senão distingue por SELECT: last_notified_at fresco => 'already_sent',
// lease ativa => 'lease_held'.
finalizeNotification(db, requestId, now): void      // sucesso: last_notified_at=now, lease=NULL
releaseNotificationLease(db, requestId): void       // falha: lease=NULL (retry permitido já)
listOpenClaimHelpRequests(db, limit, cursor?): { rows, nextCursor, hasMore }
listUnclaimedPendingsByEmailHashes(db, hashes: string[]): Map<string, PendingGrant[]>   // batch
lookupKofiSupportersByEmailHashes(db, hashes: string[]): Map<string, string>            // batch
getClaimHelpRequest(db, requestId): ClaimHelpRequestRow | null
resolveClaimHelpRequest(db, requestId, status: 'applied' | 'dismissed', now): boolean
purgeOldClaimHelpRequests(db, cutoffMs): number
// NOVO em kofiPending.ts (o apply precisa de distinguir 404 de 409 — findUnclaimedPendingByTx
// só vê unclaimed): devolve a row COM claimed_at, exista ou não reclamada.
findPendingByTx(db, transactionId): (PendingGrant & { claimedAt: number | null }) | null
```

## 14. Matcher core puro + loaders (sem duplicar lógica)

```ts
// CORE puro e determinístico — único sítio com a semântica de match:
buildClaimHelpMatchFromRows(pendings: PendingGrant[], boundDiscordId: string | null,
                            requesterId: string, declared: DeclaredProduct | null): ClaimHelpMatch
// Wrapper público (tem email em claro transitório):
loadClaimHelpMatchByRawEmail(db, webhookToken: string, rawEmail: string,
                             requesterId: string, declared): ClaimHelpMatch
//  -> hashKofiEmail(token, rawEmail) [canonicalização DENTRO do hash; NUNCA sanitizeEmail antes]
//  -> listUnclaimedPendingByEmailHash + lookupKofiSupporter -> core.
// Loader admin batch (só tem hashes e rows):
loadClaimHelpMatchesForPage(db, rows: ClaimHelpRequestRow[]): Map<string /*requestId*/, ClaimHelpMatch>
//  -> 2 queries batch (§13) -> agrupa por email_hash -> core por request. Nunca reconstrói email.
```

Testes exigem: os dois caminhos produzem `ClaimHelpMatch` idêntico para as mesmas rows.

`ClaimHelpMatch` = `{ pendings: Array<{pending, productMatch}>, fullMatchTransactionIds: string[],
binding: BindingState, aggregate: AggregateMatch }` (plural; eixos independentes). Agregação:
`complete` se ≥1 full match; senão `email_only` (pendings + `declared===null`); senão
`product_mismatch` (pendings + declarado sem igual); senão `none`. O caso "matching
indisponível" (sem token) nunca passa pelo matcher — a SOS recebe `match: null` (§15).

## 15. Notification state machine

```
persistir/upsert ──▶ reserveNotification ──┬─ 'already_sent' ─▶ responder already_sent
                                           ├─ 'lease_held'  ─▶ responder already_sent (†)
                                           └─ 'reserved'
                                                 │  (FORA de qualquer transação DB)
                                                 ▼
                                          enviar webhook (timeout 5s)
                                           ├─ ok  ─▶ finalizeNotification ─▶ 'sent'
                                           └─ err ─▶ releaseNotificationLease ─▶ 'failed'
```

- (†) `already_sent` cobre, por definição documentada, "notificado com sucesso nas últimas 24h OU
  envio em curso neste instante" — nunca afirma um envio falhado como sucesso.
- `last_notified_at` NUNCA avança numa falha. Falha ⇒ retry possível na submissão seguinte
  (lease libertada; `count`/`last_at` continuam a atualizar-se independentemente).
- Crash pós-reserva: lease expira em 60s ⇒ recuperável. Crash entre envio-ok e finalize: o
  próximo pedido re-pinga (duplicado raro e inofensivo — documentado na failure matrix).
- O mapa em memória `claimHelpSeen`/`shouldSendClaimHelp` é **removido** do caminho persistente
  (substituído por `last_notified_at`); mantém-se APENAS no modo degradado sem token, onde
  continua a ser o único dedupe.
- **Ordem com URL de SOS vazia**: verificar `claimHelpWebhookUrl` ANTES de `reserveNotification`
  — sem URL não se reserva nada (evita churn de leases): persiste-se o pedido e responde-se
  `unavailable` diretamente.
- Modo degradado (sem `KOFI_WEBHOOK_TOKEN`): sem hash ⇒ sem persistência/match; notifica como
  hoje com a linha "matching indisponível (KOFI_WEBHOOK_TOKEN não configurado)";
  `notificationStatus` = `sent`/`failed`; `requestId: null`. Como o consentimento validado não
  fica persistido neste modo, a SOS transporta a evidência: linha
  `consent: assisted-activation vN accepted at <ISO timestamp>` (é o único registo que sobra).

## 16–17. Semântica de match e de binding

Matriz (badges SEPARADOS — produto e binding nunca colapsam num só estado/cor):

| Pendings | Declarado | Binding | aggregate | Badge produto | Badge binding | Ações disponíveis |
|---|---|---|---|---|---|---|
| 0 | qualquer | none | none | ❌ sem pendente | — | Dismiss |
| 0 | qualquer | self | none | ❌ (renovação pode já ter auto-aplicado — §5) | ℹ️ email do próprio | Dismiss |
| 0 | qualquer | other | none | ❌ | ⚠️ email de outra conta | Dismiss |
| ≥1 | ausente/null | qualquer | email_only | 🟡 produto não declarado | conforme | selected-only / link (se none+subscr.) / Dismiss |
| ≥1, ≥1 igual | igual | none | complete | ✅ match completo | neutro | selected-only / **link** / Dismiss |
| ≥1, ≥1 igual | igual | self | complete | ✅ | ℹ️ cliente repetente (indício, não prova) | selected-only / Dismiss |
| ≥1, ≥1 igual | igual | other | complete | ✅ | ⚠️ forte | selected-only / **transfer** / Dismiss |
| ≥1, nenhum igual | diferente | qualquer | product_mismatch | 🟠 declarou X, pendente é Y | conforme | selected-only (warning) / Dismiss |
| legacy/custom | qualquer | qualquer | conforme | 🟠 `custom: <plan> <seats>srv <days>d` | conforme | selected-only / link ou transfer se subscrição / Dismiss |

**Regra de disponibilidade das ações (por PENDENTE, não por pedido)**: `selected_only` está
disponível para qualquer pendente unclaimed; `link_subscription` só em pendentes com
`isSubscription` E binding do pedido `none`; `transfer_subscription` só em pendentes com
`isSubscription` E binding `other`. O gate é `isSubscription` — o product match (incl.
legacy/custom) NÃO restringe as ações, só informa os badges e os warnings do modal.

Consequências de `selected_only` para renovações (obrigatório na UI e no runbook):

- **A. binding=self**: renovações futuras já auto-aplicam ao requerente; selected-only não mexe
  em nada — UI: "renovações já ligadas a esta conta".
- **B. binding=none + pendente de subscrição**: selected-only NÃO cria binding ⇒ a próxima
  renovação volta a cair em pending. UI: "sem ligar a subscrição, as renovações continuarão a
  precisar de claim/ajuda — considera 'Ligar subscrição'". A ação de alcance maior chama-se
  **Ligar subscrição** (não "transferir": não há binding a mover).
- **C. binding=other**: a ação de alcance maior é **Transferir subscrição** (warning máximo);
  selected-only NUNCA reatribui o binding de outra conta.

## 18. Consentimento (ativação assistida)

- Modal público ganha checkbox **desmarcada por defeito**, com link acessível para `/terms`
  (mesmo padrão `{terms}` do claim normal — §5), bloqueando o submit sem ela (cliente) e o
  processamento sem `termsAccepted:true` + `termsVersion` correta (servidor, 400; **nada é
  persistido** com consent inválido).
- Persistência: `consented_at` + `terms_version` (constante `CLAIM_HELP_TERMS_VERSION` — nunca
  copy traduzida). Upsert renova ambos.
- O apply admin rejeita pedidos sem consent válido (impossível por constraint; a verificação em
  §10.2/1 é defesa em profundidade).
- **Currency da versão**: se os termos mudarem com pedidos abertos, esses pedidos continuam
  **acionáveis** — o consentimento é válido na versão em que foi dado (o POST público é que exige
  sempre a versão CORRENTE; uma nova submissão re-consente e atualiza a row). A consola mostra a
  `terms_version` de cada pedido; o apply NÃO compara com a constante corrente.
- **Wording legal**: os termos atuais (§5, terms.html ~76) cobrem "tick the acceptance box and
  activate a pass"; a ativação **assistida** (o operador ativa a pedido) precisa de uma frase que
  a equipare — atualização coordenada de `TERMS.md` + `site/terms.html` (cláusula: pedir ajuda de
  ativação com a caixa marcada = pedir a entrega imediata quando o operador ativar + mesma
  renúncia dos 14 dias). O texto final é a única **decisão de produto restante** (§39): o plano
  fixa a semântica; o dono aprova a redação.

## 19. Ownership verification (separada do consentimento)

- A consola exibe de forma persistente: "Email, produto e binding são **indícios** — nenhum prova
  a propriedade. Verifica o recibo/transação antes de conceder."
- Toda a confirmação de apply inclui uma checkbox de acknowledgement (semântica: "Verifiquei a
  propriedade com evidência do recibo/da transação" — PT, seguindo a língua da consola) que arma
  o botão e envia `ownershipVerified: true` (400 sem ele). É UX/auditoria, não prova — o servidor
  valida tudo na mesma.
- Runbook do operador (novo doc `docs/RUNBOOK-CLAIM-HELP.md`, criado na fase 8): evidências
  aceitáveis sem reter PII — o requerente mostra o email de recibo do Ko-fi (do próprio email da
  compra), o código de transação, ou o valor+data exatos; nada disso é copiado para o sistema.
- Verde nunca vira grant de um clique cego; ⚠️/🟠 nunca bloqueiam permanentemente casos
  legítimos — escalam a fricção.

## 20–22. Site público (UI, fallback, i18n, a11y)

- **Select de produto** no modal de ajuda: `<label>` associada; opção inicial "não tenho a
  certeza" (envia `product: null` explícito — o novo UI NUNCA omite a propriedade); 6 opções com
  os valores wire EXATOS (§7); teste de paridade bundle↔backend.
- **Checkbox de consentimento** (§18) entre o select e o botão; a11y: parte do focus trap do
  modal existente, navegável por teclado, `aria` herdada do padrão do claim normal.
- **Parsing da resposta**: SEMPRE ler o JSON (mesmo em 200) e agir por `notificationStatus`:
  `sent`/`already_sent` ⇒ sucesso (sem fallback redundante); `failed`/`unavailable` ⇒ "o teu
  pedido ficou registado, mas o aviso ao operador falhou/está indisponível" + fallback.
- **Fallback copy-to-support**: inclui o email EXATO digitado + o produto declarado (ou "não
  tenho a certeza") + nota "o pedido pode já estar registado" + instrução de contacto; vive só em
  memória/DOM do browser; limpo ao fechar o modal; nunca enviado a analytics/logs.
- **Copy**: nenhuma menção a `S-…` como código (a interceção existente mantém-se); reforçar que o
  recibo (URL/código) ativa instantaneamente.
- **i18n**: chaves novas (select+opções, consentimento, estados de notificação, fallback) nos
  **10 locales**; testes de paridade atualizados.
- **Cache bust obrigatório**: `main-v36.js`→`main-v37.js`, `i18n-v33.js`→`i18n-v34.js`;
  atualizar `site/index.html` + `site/account.html` + `site/dashboard.html` + constantes
  `SITE_JS`/`SITE_I18N` de `operationalHardening.test.ts`; `grep -rn "main-v36\|i18n-v33"` ⇒ 0
  ocorrências. Atualizar o teste do body ("posts it, not the Ref") para o novo contrato.

## 23–25. Consola admin (UI, typed confirmation, paginação)

- Nova box "Pedidos de ajuda" (aba Passes, entre "Passes ativos" e "Compras por reclamar"):
  por pedido — `request_id` (tooltip), `user_id` mono, `pedido em`/`count`/`consentido em`,
  produto declarado (label PT), e por pendente: `tx · produto real · badge productMatch`; badge
  binding ao nível do pedido; aviso permanente de §19.
- **Paginação keyset**: default 50, botão "Carregar mais" (usa `nextCursor`); sem duplicados ao
  carregar mais (dedupe por `request_id` no cliente); empty state; a lista recarrega do zero após
  qualquer apply/dismiss (evita cards stale).
- Estados: loading, vazio, erro de rede, 403⇒`logoutStale()`, **409⇒"o estado mudou — a
  recarregar" + refresh automático + reabertura da confirmação com os dados novos** (transfer/
  link: input digitado limpo, nova confirmação obrigatória); botões desativados durante POSTs
  (double-click impossível); refresh de Pedidos+Passes+Pendentes após sucesso; `textContent`
  para todos os dados.
- **`confirmDialog` estendido** (compatível — o dialog atual continua a funcionar): novas opts
  opcionais `lines: string[]` (renderizadas como `<div>`s via `textContent` — enumeração do blast
  radius) e `typedToken: string` (input incluído no focus trap, foco inicial nele, limpo em CADA
  abertura; botão confirmar `disabled` até `input.value.trim() === typedToken` — comparação
  exata, case-sensitive, documentada na UI "escreve TRANSFERIR"); Escape/Cancel/backdrop mantêm o
  comportamento atual; return focus preservado.
- Confirmações:
  - selected-only: `lines` = tx, produto real, produto declarado, entitlement resultante, target
    `user_id`, "binding: inalterado" + (caso B de §17) o aviso de renovações; checkbox de
    ownership (§19).
  - link: tudo acima + TODAS as transações do snapshot + "cria ligação: renovações futuras
    passam a ativar sozinhas nesta conta"; ownership; `typedToken: 'LIGAR'`.
  - transfer: idem + binding antes/depois + efeito nas renovações; ownership;
    `typedToken: 'TRANSFERIR'`; visual danger.
- Feature-detection: 404 no GET ⇒ box "indisponível — atualiza o bot Vozen" (UI nova ↔ backend
  antigo é inofensiva; backend novo ↔ UI antiga é aditivo).

## 26. Audit/logging

- A transação de apply devolve resultado estruturado; **o log de sucesso escreve-se só depois do
  commit**. Rollback ⇒ log de falha que nunca afirma grant.
- Linhas (inglês, convenção do repo), com campos validados antes de logar (UUID/snowflake/enum):
  - `[admin] claim-help apply req=<uuid> user=<id> tx=<tx> mode=<mode> binding=<before>-><after> applied=<n> resolved=<bool>`
  - `[admin] claim-help apply REJECTED req=<uuid> reason=<stale_request|tx_unavailable|hash_mismatch|stale_transfer|bad_mode>`
  - `[admin] claim-help dismiss req=<uuid> user=<id>`
  - `[claim-help] request recorded req=<uuid> user=<id> product=<enum|none> notification=<status>`
- **Nunca** email em claro; **nunca** `email_hash` nem prefixos dele; sem secrets/payloads.
- Identidade do operador: a consola é single-owner (sessão só do `OWNER_ID`) — o log não precisa
  de campo extra; se a sessão algum dia for multi-conta, acrescentar `op=<id>`.

## 27. Privacidade, termos e compliance (atualização obrigatória e coordenada)

- `PRIVACY.md`: linha da tabela §1 para `claim_help_request` (user_id, HMAC keyed do email —
  pseudónimo tratado como dado pessoal, produto declarado, timestamps, count, status,
  consent metadata; finalidade: suporte de ativação; retenção 90d; `/privacy erase`; acesso
  owner-only); corrigir o parágrafo "Activation-help" (deixa de ser verdade "not stored").
- `site/privacy.html`: corrigir ~48 ("never asks for your email" → exceção explícita do fluxo de
  ajuda), reescrever ~138 (o que passa a ser guardado: HMAC + metadados, nunca o email em claro;
  em claro só na mensagem privada ao operador e no browser), rever a secção de retenção, e
  **atualizar "Last updated"**. Build+preview do site após a alteração legal (mesmo sem JS).
- `TERMS.md` + `site/terms.html`: cláusula de ativação assistida (§18) + "Last updated".
- `docs/COMPLIANCE-MATRIX.md` (**obrigatório** — §5): §1.5 (novo datum divulgado+apagável),
  §2.4 (erase), §2.6 (retenção 90d da nova tabela), §4 Ko-fi se aplicável ao claim data.
- `docs/ARCHITECTURE.md`: nova store, fluxo público, matcher, endpoints admin, lifecycle,
  fronteira Vozen-bot↔helper.
- Adenda de auditoria (`docs/AUDIT-CONSOLE-037.md`): nova superfície, contratos, 3 modos e blast
  radius, snapshot/409, typed confirmation, ownership gate, auditoria pós-commit, ausência de
  auto-grant; nota de consentimento (§18) — o registo do pedido é a evidência do pedido explícito
  e autenticado do comprador.
- `docs/RUNBOOK-CLAIM-HELP.md`: runbook do operador (§19) + estados/ações + eventual consistency.

## 28. Migrations e compatibilidade

- Schema 100% aditivo (uma tabela + índices, `IF NOT EXISTS`); zero alterações a tabelas
  existentes; rollback de código não exige tocar na DB (tabela órfã inofensiva e purgável).
- API aditiva: rotas novas; `/api/claim-help` muda o contrato de request (consent obrigatório) —
  ver §9 "Compat" (bundles em cache recebem 400 com copy de refresh; assets renomeados minimizam).
- `claimPendingGrant` público mantém-se INTOCADO (o self-service não muda); o apply admin usa
  primitivas extraídas (`applySinglePending` + sibling query + `rememberKofiSupporter`) — o
  refactor é de extração pura com os testes existentes verdes sem alteração.

## 29. Ordem de implementação (fases; TDD RED→GREEN→REFACTOR→VERIFY→DONE em todas)

Dependências: F0→F1→F2→F3→(F4 ∥ F5)→F6→F7→F8→F9.

- **F0 — Contratos e invariantes**: fixar tipos/enums/constante de termos (§7), contratos
  (§9-10), estados (§15). Deliverable: tipos partilhados compilando + este plano como referência.
  DONE: `npm run typecheck` verde com os tipos novos (sem lógica).
- **F1 — Schema e store**: RED `tests/claimHelpStore.test.ts` (matriz §30 "Store/Upsert/
  Notification-store/TTL/erase/rot-guard/paginação keyset") → GREEN §11-13 → VERIFY vitest.
  DONE: suite verde; rot-guard verde com a tabela em `USER_ERASE_TABLES`.
- **F2 — Matcher**: RED em `tests/claimHelp.test.ts` (matriz §30 "Matcher") → GREEN §14 core+
  wrapper+batch → REFACTOR: `sanitizeEmail` renomeada/confinada a display (nenhum call-site no
  caminho de identidade; grep no PR). DONE: os dois caminhos equivalentes provados por teste.
- **F3 — Endpoint público**: RED router tests (validação §9, persist-first, lease §15, respostas,
  modo degradado, anti-enumeration shape, sem email/HMAC em logs) → GREEN reescrita de
  `handleClaimHelpRequest` (ordem §15; `webhookToken`+`db` no ctx) + SOS via
  `buildClaimHelpMessage(discordId, emailDisplay, match | null, asOf)` com timestamp "as of" e o
  aviso amarelo SEMPRE. DONE: `npm run check` verde.
- **F4 — Site público**: critérios §20-22 definidos antes (TDD de browser) + RED dos testes de
  hardening (body novo, paridade de produto, i18n ×10, constantes de asset) → GREEN
  (main-v37/i18n-v34 + 3 HTMLs) → VERIFY `npm run build:site` + browser (mobile/desktop/teclado/
  CSP/consola) + grep de refs antigas = 0.
- **F5 — Admin read API**: RED (`adminApi.test.ts`/`adminRouter.test.ts`: paginação, batch 2
  queries, sem email_hash na resposta, 400 cursor/limit, 403, vazio) → GREEN §10.1.
- **F6 — Admin apply/dismiss**: REFACTOR prévio (extração `applySinglePending` com testes de
  claim intocados verdes) → RED (matriz §30 "Selected-only/Link/Transfer/Consent-ownership/
  Audit") → GREEN §10.2-10.3 (transação única, snapshot, 409s, audit pós-commit).
- **F7 — Consola helper**: critérios §23-25 antes → implementar (extensão `confirmDialog`,
  box, paginação, badges, 3 confirmações) → VERIFY build helper + browser realista (E2E local
  §32) + responsivo/teclado/consola.
- **F8 — Legal/docs/compliance**: §27 completo (incluindo previews dos sites) + runbook.
- **F9 — Validação segura e rollout**: E2E §32 em local/staging; deploy (com autorização do
  dono): backend primeiro → validar (§34) → site público (mesmo push do repo) → consola helper;
  smoke de produção NÃO-mutante; monitorização §36; rollback §35.

## 30. Test matrix (o executor implementa exatamente isto; RED primeiro em cada fase)

- **Public validation**: email ausente/inválido/com whitespace interior/control chars/newline/
  backtick/>254; product ausente vs `null` vs cada um dos 6 vs inválido(400); termsAccepted
  ausente/false(400, nada persistido)/true; termsVersion errada(400); payload >4KB(413);
  rate-limit(429); 401 sem/inválido token.
- **Upsert/store**: primeiro pedido; repetido (count+1, last_at, first_at preservado, request_id
  estável); `undefined` preserva produto, `null` limpa, enum substitui; consented_at/terms_version
  renovados; INSERT novo após resolvido; índice único de open respeitado; sem email em claro
  (PRAGMA table_info); CHECKs (count>=1, status, resolved_at) rejeitam violações; keyset:
  ordenação estável com `last_at` empatado (desempate `request_id`), percorrer todas as páginas
  sem duplicar/omitir, cursor inválido, última página, vazio.
- **Notification**: sent; already_sent (dentro de 24h); failed (webhook err ⇒ lease libertada,
  `last_notified_at` NÃO avança); unavailable (URL vazia, pedido persiste); retry pós-falha com
  sucesso; duas submissões concorrentes ⇒ no máximo 1 envio (lease); lease expirada (crash
  simulado) ⇒ recupera; persistência sempre anterior à tentativa; count incrementa mesmo com
  already_sent.
- **Matcher**: zero/um/vários matches; igual/diferente/desconhecido(custom); Plus ignora seats;
  binding none/self/other; ortogonalidade (complete+other); wrapper público ≡ batch admin para
  as mesmas rows; batch = 2 queries por página (spy em `prepare` ou contagem equivalente);
  apóstrofo/Unicode no email → hash calculado do raw (identidade não mutilada).
- **Public UI (browser)**: consent desmarcado bloqueia; link de termos abre sem marcar a caixa;
  "não tenho a certeza" envia null; parse dos 4 notificationStatus; fallback com email+produto e
  limpeza ao fechar; escaping; 10 locales; foco/teclado/labels; reabertura do modal limpa estado;
  asset novo carregado (sem refs antigas).
- **Admin list**: 403; vazio; 1 página; várias (load more sem duplicados); tie de timestamps;
  cursor/limit inválidos; só open; matches live; zero email/hash na resposta; 500 limpo.
- **Selected-only**: fluxo válido; tx de outro hash(409); tx claimed(409); request resolvido
  (409); target derivado do request (payload com user malicioso é ignorado — não existe campo);
  binding none/self/other inalterado (ler `kofi_supporter` antes/depois); siblings NÃO aplicados;
  renovação seguinte continua pending quando binding=none (teste de integração com o webhook
  fake); double-apply concorrente não duplica entitlement.
- **Link**: binding none + snapshot válido ⇒ aplica conjunto + cria binding ⇒ renovação futura
  auto-aplica (integração); sibling adicionado entre GET e POST ⇒ 409 `stale_transfer`, ZERO
  mudanças; sibling entretanto claimed ⇒ 409; binding criado por corrida ⇒ 409; ordem diferente
  do mesmo conjunto NÃO é stale (ordenação canónica).
- **Transfer**: binding other + snapshot válido ⇒ rebinding + renovações mudam de target;
  binding mudou ⇒ 409; conjunto mudou ⇒ 409; resposta lista EXATA das transações aplicadas;
  reconfirmação obrigatória após stale (UI); atomicidade (falha simulada a meio ⇒ rollback total).
- **Consent/ownership**: apply com `ownershipVerified` ausente/false ⇒ 400; UI: acknowledgement
  presente nas 3 confirmações; warnings reforçados em mismatch/binding other; pedido aberto com
  `terms_version` ANTIGA continua aplicável (§18 currency) e a consola mostra a versão; nova
  submissão exige a versão corrente e atualiza a row; link/transfer disponíveis em pendente de
  subscrição legacy/custom (gate por `isSubscription`, não pelo catálogo).
- **Audit**: sucesso só após commit (espiar ordem log↔commit); rollback ⇒ sem log de sucesso;
  409/hash_mismatch/bad_mode auditados; nenhum email/HMAC em nenhum log (assert no logger mock).
- **Privacy**: `/privacy erase` remove rows por user_id; TTL open(last_at)/resolved(resolved_at)
  com fronteiras exatas; row inteira (HMAC incluído) desaparece; rot-guard.
- **E2E**: §32 (dedicated user, preflight, cleanup por IDs exatos, asserts pós-cleanup).

## 31. Failure matrix

| Falha | HTTP/resultado | Persistido? | Retry? | Utilizador vê | Operador vê | Auditoria | Parcial? |
|---|---|---|---|---|---|---|---|
| DB indisponível antes de persistir | 500 | não | sim | erro genérico | logError | falha | não |
| DB falha durante upsert | 500 | não (tx aborta) | sim | erro genérico | logError | falha | não |
| Token Ko-fi ausente | 200/503 | **não** (modo degradado) | sim | igual a hoje | SOS "matching indisponível" | log | não |
| SOS URL não configurada | 200 `unavailable` | sim | n/a | "registado; aviso indisponível"+fallback | consola tem o pedido | log | não |
| Webhook timeout/non-2xx | 200 `failed` | sim | sim (lease libertada) | "registado; aviso falhou"+fallback | consola tem o pedido | log | não |
| Lease contention (2 submissões) | 200 `already_sent` | sim (count+1) | n/a | sucesso | 1 ping no máximo | — | não |
| Lease expirada pós-crash | próximo pedido notifica | sim | sim | — | ping eventual | log | não |
| Crash entre envio-ok e finalize | duplicado raro de ping | sim | n/a | — | 2 pings (inofensivo, documentado) | — | não |
| Pedido repetido <24h | 200 `already_sent` | sim (count+1, last_at) | n/a | sucesso | sem re-ping | — | não |
| product/terms inválidos | 400 | **não** | sim | erro específico | — | — | não |
| Apply: request 404/resolvido | 404/409 | sem mudanças | após refresh | — | UI "estado mudou"+reload | REJECTED log | não |
| Apply: tx claimed/race | 409 | sem duplicar | após refresh | — | idem | REJECTED log | não |
| Apply: hash mismatch | 409 | nada | não | — | erro explícito | REJECTED log | não |
| Link/transfer: snapshot stale (sibling/binding mudou) | 409 `stale_transfer` | ZERO mudanças | após nova confirmação digitada | — | confirmação reaberta com dados novos | REJECTED log | não |
| Falha a meio do grant múltiplo | rollback total | nada | sim | — | erro | falha sem afirmar grant | **não** |
| Audit log falha pós-commit | grant mantém-se | sim | n/a | — | discrepância detetável por consola | logError do logger | n/a |
| Sessão admin expirada | 403 | — | re-login | — | `logoutStale()` | — | não |
| Cursor/limit inválido | 400 | — | sim | — | UI erro | — | não |
| Helper recebe resposta inesperada | UI erro genérico + reload | — | sim | — | mensagem clara | — | não |
| UI nova ↔ backend antigo | 404 detect | — | após deploy backend | — | box "indisponível" | — | não |
| Erase concorrente com apply | uma das transações vence; a outra 404/409 | consistente | — | — | 409/refresh | logs | não |
| Retention concorrente com list/apply | idem (rows desaparecem ⇒ 404/409) | consistente | — | — | refresh | — | não |
| Asset antigo em cache | impossível pós-rename; consent legado ⇒ 400 com copy de refresh | — | refresh | mensagem clara | — | — | não |
| Build/i18n falha | `npm run check`/`build:site` bloqueiam | — | corrigir | — | — | — | não |

## 32. E2E seguro (local/staging; produção só smoke não-mutante)

- **Ambiente**: DB local descartável ou staging; **conta Discord de teste dedicada** (nunca a
  conta/pass real do owner), sem premium/binding/requests pré-existentes.
- **Preflight (aborta se falhar)**: confirmar target = test user; zero entitlements; zero
  activations; zero bindings; zero claim_help_requests desse user.
- **Guardar explicitamente** durante o teste: `requestId`(s), `transactionId`(s), `emailHash`,
  test user ID, binding criado, entitlements criados.
- **Cenários**: fluxo completo selected-only (§30 E2E base); no-match + dismiss; 2 pendings
  (aplicar 1 ⇒ request continua open); link (binding none ⇒ renovação fake auto-aplica);
  transfer com snapshot stale (⇒ 409, reconfirmar); notificação com URL inválida (⇒ `failed`,
  pedido persiste).
- **Cleanup em `finally`, por IDs exatos** (nunca wildcard, nunca revoke genérico): apagar as
  rows criadas (`kofi_pending`, `claim_help_request`, `kofi_supporter`, entitlements do test
  user) e **asserts pós-cleanup**: zero rows de teste, zero binding, zero entitlement.
- **Produção**: por defeito apenas smoke NÃO-mutante (GET admin list 200 autenticado, OPTIONS/
  CORS). Qualquer teste mutante em produção exige aprovação explícita separada, conta dedicada,
  preflight, rollback e cleanup verificável documentados. Proibido usar o pass real do owner.

## 33. Build e validação

- Vozen-bot: `npm run check` (build+typecheck+lint+format+vitest) + `npm run build:site` +
  browser validation do site público (§20-22) — em F3/F4/F6 e no fim.
- Helper: build do site (minify) + browser validation da consola (§23-25).
- Greps de guarda no PR: zero `main-v36`/`i18n-v33`; zero `sanitizeEmail` no caminho de
  identidade; zero email/hash em strings de log novas.

## 34. Rollout

1. Merge Vozen-bot → deploy backend (autorização do dono) → validar: `GET /api/admin/claim-help`
   200 `{requests:[],nextCursor:null,hasMore:false}` com sessão; CORS; `POST /api/claim-help`
   com body legado ⇒ 400 `consent_required` (esperado até o site novo sair no mesmo push).
2. O site público sai no MESMO push do repo Vozen-bot (Pages) — janela de bundles em cache coberta
   pelo rename de assets + copy de refresh.
3. Consola helper depois (Pages do repo helper), com feature-detection já embutida.
4. Compatibilidades: UI nova↔backend antigo ⇒ box "indisponível"; backend novo↔UI antiga ⇒
   aditivo, secção inexistente.

## 35. Rollback

- Independente por repo. Backend: reverter o commit e redeploy — a tabela nova fica órfã e
  inofensiva (purga TTL continua a limpá-la se o código de purga persistir; se também for
  revertido, é só dados inertes). Site público: reverter (assets antigos voltam — o contrato
  antigo do endpoint também voltou com o backend). Helper: reverter a página; a box desaparece.
- Nunca reverter com `git reset --hard`/`checkout` destrutivo sobre trabalho não commitado.

## 36. Observabilidade

- Linhas de log de §26 são a telemetria mínima: volume de pedidos (`request recorded`), estados
  de notificação, rejeições 409 (staleness na prática), applies por modo.
- A consola é o dashboard operacional (contagem de abertos visível). Sem novas dependências.

## 37. Acceptance criteria (todos obrigatórios)

- [ ] Zero copy/exemplos com `S-…` como credencial; SOS/consola mostram o `transaction_id` real.
- [ ] Consentimento: checkbox default-off + link de termos; `termsAccepted`+`termsVersion`
      validados no servidor; 400 sem persistir; `consented_at`/`terms_version` gravados; apply
      impossível sem consent; termos atualizados (wording aprovado pelo dono).
- [ ] Ownership acknowledgement separada do consentimento nas 3 confirmações; runbook escrito.
- [ ] `notificationStatus` com 4 semânticas distintas; lease atómica; envio fora de transações;
      `last_notified_at` só em sucesso; falha nunca bloqueia retries 24h; persist-first provado.
- [ ] Site faz parse do JSON mesmo em 200; fallback (com email+produto) só em failed/unavailable.
- [ ] `product` ausente≠null≠inválido com os 3 comportamentos definidos e testados.
- [ ] Hash = `hashKofiEmail` sobre o email raw; `sanitizeEmail` (ou sucessora de display) nunca
      no caminho de identidade; apóstrofo/Unicode preservados; SOS mostra email exato copiável.
- [ ] Zero email em claro e zero HMAC (nem prefixos) em DB-fora-da-coluna, API admin, logs.
- [ ] Matcher core único; público e admin equivalentes por teste; batch 2 queries/página.
- [ ] Paginação keyset estável (tie-break `request_id`), limit validado, cursor opaco, load more
      sem duplicados/omissões.
- [ ] `selected_only` só a tx escolhida, binding intocado; `link` cria binding com snapshot;
      `transfer` re-binda com snapshot; qualquer divergência de conjunto/binding ⇒ 409 e ZERO
      mudanças; nova transação NUNCA entra sem nova confirmação digitada.
- [ ] Target sempre derivado do request; hash validado na mesma transação; double-apply não
      duplica; rollback total em falha.
- [ ] Consequências de renovações futuras visíveis na UI e cobertas por testes (A/B/C de §17).
- [ ] Request aberto enquanto houver pendings; auto-resolve a 0; dismiss auditado; reabertura
      cria request novo.
- [ ] `/privacy erase` + TTL 90d (open/last_at, resolved/resolved_at) + rot-guard verdes.
- [ ] PRIVACY.md, site/privacy.html (incl. "Last updated" e a frase "never asks for your
      email"), TERMS/terms.html, ARCHITECTURE, COMPLIANCE-MATRIX, adenda de auditoria e runbook
      atualizados.
- [ ] i18n ×10 + paridade; cache bust completo (v37/v34, 3 HTMLs, constantes, grep=0).
- [ ] Builds e browser validations verdes nos dois repos; backend deployado antes da consola.
- [ ] E2E com conta de teste dedicada, preflight, cleanup por IDs exatos e asserts pós-cleanup;
      produção só smoke não-mutante.
- [ ] Nenhum auto-grant/auto-link/auto-transfer; self-service por recibo continua o caminho
      principal.

## 38. Riscos conhecidos e mitigações

- **Roubo de passe por indícios públicos** (email+produto adivinháveis) → human gate + ownership
  ack + warnings escalonados + typed confirmation; auto-grant fora de scope.
- **Blast radius de subscrições** → snapshot otimista obrigatório em link/transfer; 409 stale.
- **Pedido antes do webhook Ko-fi** (eventual consistency) → SOS com "as of <timestamp>"; consola
  live é a fonte de verdade; request fica aberto com zero matches (intencional — o pending pode
  chegar depois); sem polling nem re-notificação nesta versão (§40).
- **Rotação do `KOFI_WEBHOOK_TOKEN`** → hashes antigos deixam de casar (caveat já documentado no
  código); a mensagem ❌ cobre; nada de novo.
- **Contrato público endurecido vs bundles em cache** → 400 com copy de refresh + rename de
  assets; janela curta.
- **Duplo ping em crash pós-envio** → raro e inofensivo; documentado.

## 39. Decisões explicitamente fechadas

Todas as decisões técnicas deste plano estão fechadas (contratos §7-§28). Factos confirmados no
código estão em §5 (incluindo monthly=30 e a cobertura da compliance matrix — sem "confirmar
depois"). **Única decisão de produto restante**: a redação final da cláusula de ativação
assistida nos termos (§18) — a semântica está fixada; o dono aprova o texto antes da F8.
Impacto se atrasar: F8 bloqueia; F0-F7 seguem.

## 40. Melhorias futuras (fora desta versão)

- Re-notificação automática quando um pending novo passa a casar com um request aberto.
- Filtro de estado na listagem admin (ver applied/dismissed históricos).
- Métricas agregadas (taxa de match, tempo até resolução) na consola.
