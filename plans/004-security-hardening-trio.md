# Plan 004: Security hardening trio — refuse unauthenticated top.gg webhook, gate guild-code /redeem behind Manage Server, scrub tokens from error-webhook reports

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/vote.ts src/config/index.ts src/commands/index.ts src/store/premium.ts src/i18n/catalog.ts src/errorReporter.ts tests/vote.test.ts tests/config.test.ts tests/premium.test.ts tests/errorReporter.test.ts tests/commandsRedeem.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

Three small, independent hardenings (SEC-01/02/03), grouped because each is a few lines plus tests:

1. **SEC-01 (vote webhook)**: with `TOPGG_WEBHOOK_PORT` set and `TOPGG_WEBHOOK_SECRET` empty, the bot opens an HTTP listener that accepts **unauthenticated** vote payloads — anyone who finds the port can forge votes. Today it only warns. Change: refuse to start unless the operator explicitly opts in with `TOPGG_WEBHOOK_ALLOW_INSECURE=true`.
2. **SEC-02 (/redeem)**: any member of a server can redeem a **guild**-kind Premium code onto that server. Codes are paid artifacts; a random member redeeming one binds it irreversibly (code is marked used in a transaction) to a server the buyer may not have intended. Change: guild-kind codes require the **Manage Server** permission (same server-side re-check `handleConfig` does); user/Plus codes stay open to anyone.
3. **SEC-03 (error reporter)**: `formatErrorMessage` forwards raw stack/message text to a Discord webhook. If an error message ever embeds a credential (e.g. a discord.js error echoing a request, or a `Bearer` header in an HTTP error), it lands in a chat channel. Change: redact Discord-token-shaped strings and `Bearer …` values, and cap the forwarded body at 1500 chars.

## Current state

Files and roles:

- `src/vote.ts` — top.gg webhook; `startVoteWebhookServer` (lines 149-223) currently warns-and-continues without a secret.
- `src/config/index.ts` — env parsing; `AppConfig` interface (lines 7-73), webhook envs parsed at lines 200-201, bool helper `boolEnvDefaultOn` at 138-142.
- `src/commands/index.ts` — `handleRedeem` at 1250-1269; the permission re-check exemplar is `handleConfig` at 1883-1889.
- `src/store/premium.ts` — `RedeemResult` (lines 12-17), `redeemCode` transaction (210-238), `createRedeemCode` (191-202, used by tests to mint codes).
- `src/i18n/catalog.ts` — UI-string catalog; `redeem.*` keys at lines 441-460; `error.needManageGuild` at 32-35.
- `src/errorReporter.ts` — `formatErrorMessage` at 33-41; `MAX_CONTENT = 1900` at 15.
- Tests to extend: `tests/vote.test.ts`, `tests/config.test.ts`, `tests/premium.test.ts`, `tests/errorReporter.test.ts`. To create: `tests/commandsRedeem.test.ts`.

Verified excerpts as of commit `fb7f916`:

`src/vote.ts:152-163` — the warn-only path (SEC-01):

```ts
const port = config.topggWebhookPort;
if (port === undefined) return undefined;

const secret = config.topggWebhookSecret;
if (secret === undefined || secret === '') {
  // top.gg aceita webhooks sem auth, mas e inseguro — qualquer um que descubra
  // a porta pode forjar votos. Avisamos mas nao bloqueamos (decisao do dono).
  log.warn(
    `[vote] TOPGG_WEBHOOK_PORT definido (${port}) mas TOPGG_WEBHOOK_SECRET vazio — ` +
      'o webhook fica SEM autenticacao. Define TOPGG_WEBHOOK_SECRET (recomendado).',
  );
}
```

`src/vote.ts:149-151` — the signature whose `Pick<>` must grow:

```ts
export function startVoteWebhookServer(
  config: Pick<AppConfig, 'topggWebhookPort' | 'topggWebhookSecret'>,
): Server | undefined {
```

`src/config/index.ts:200-201` — how the sibling envs are parsed (add the new one right after):

```ts
topggWebhookPort: numEnvOptional('TOPGG_WEBHOOK_PORT'),
topggWebhookSecret: strEnv('TOPGG_WEBHOOK_SECRET', '') || undefined,
```

`src/config/index.ts:138-142` — the existing bool helper (default-ON; the new one mirrors it as default-OFF):

```ts
function boolEnvDefaultOn(name: string): boolean {
  const raw = process.env[name];
  if (raw === undefined) return true;
  return raw.trim().toLowerCase() !== 'false';
}
```

`src/commands/index.ts:1250-1269` — `handleRedeem` (SEC-02; no permission check today):

```ts
async function handleRedeem(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const code = i.options.getString('code', true).trim().toUpperCase();
  const res = redeemCode(
    deps.db,
    code,
    { guildId: i.guildId ?? undefined, userId: i.user.id },
    Date.now(),
  );
  if (res.status === 'invalid') {
    await reply(i, t('redeem.invalid', locale));
    return;
  }
  ...
```

`src/commands/index.ts:1883-1889` — the server-side permission re-check pattern to mirror (from `handleConfig`):

```ts
async function handleConfig(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const member = i.member as GuildMember;
  if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await reply(i, t('error.needManageGuild', locale));
    return;
  }
```

`src/store/premium.ts:12-17` — `RedeemResult` (unchanged by this plan; the gate happens in the command layer via a new read-only peek):

```ts
export interface RedeemResult {
  status: 'ok' | 'invalid' | 'used';
  kind?: PremiumKind;
  days?: number;
  expiresAt?: number;
}
```

`src/i18n/catalog.ts:449-452` — key format to copy for the new message (every key: `en` required, `pt` optional):

```ts
'redeem.used': {
  en: 'That code has already been used.',
  pt: 'Esse código já foi usado.',
},
```

`src/errorReporter.ts:33-41` — the unscrubbed formatter (SEC-03):

```ts
/** Formata o erro como content de webhook (cabeçalho + stack num code block, truncado). */
export function formatErrorMessage(error: unknown, context: string): string {
  const e = error as { stack?: string; message?: string };
  const head = `⚠️ **Vozen** — erro em \`${context}\``;
  const body = e?.stack || e?.message || String(error);
  const full = `${head}\n\`\`\`\n${body}\n\`\`\``;
  if (full.length <= MAX_CONTENT) return full;
  return `${full.slice(0, MAX_CONTENT - 4)}\n\`\`\``;
}
```

Repo conventions: code comments in **Portuguese**; env parsing helpers live in `src/config/index.ts` and degrade safely; the i18n contract is documented at the top of `src/i18n/catalog.ts` (`en` mandatory, `pt` optional). NEVER put a real-looking credential in code or tests — build synthetic token shapes with `'x'.repeat(n)`.

## Commands you will need

| Purpose      | Command                                                                                | Expected on success |
| ------------ | -------------------------------------------------------------------------------------- | ------------------- |
| Install      | `npm install`                                                                          | exit 0              |
| Typecheck    | `npm run build`                                                                        | exit 0 (tsc)        |
| Step-1 tests | `npx vitest run tests/vote.test.ts tests/config.test.ts`                               | all pass            |
| Step-2 tests | `npx vitest run tests/premium.test.ts tests/commandsRedeem.test.ts tests/i18n.test.ts` | all pass            |
| Step-3 tests | `npx vitest run tests/errorReporter.test.ts`                                           | all pass            |
| Full suite   | `npx vitest run`                                                                       | all pass            |

(There is no lint script in this repo.)

## Scope

**In scope** (the only files you should modify/create):

- `src/vote.ts`, `src/config/index.ts` (step 1)
- `src/commands/index.ts` (only `handleRedeem`), `src/store/premium.ts` (add one read-only function), `src/i18n/catalog.ts` (one new key) (step 2)
- `src/errorReporter.ts` (step 3)
- Tests: `tests/vote.test.ts`, `tests/config.test.ts`, `tests/premium.test.ts`, `tests/commandsRedeem.test.ts` (create), `tests/errorReporter.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `handleVoteWebhook` (the pure handler in `src/vote.ts:96-135`) and its constant-time auth — already correct.
- The `redeemCode` transaction body in `src/store/premium.ts` — the permission gate lives in the command layer; the store stays policy-free (code kind is immutable, so a pre-check has no TOCTOU race).
- Entitlements (`src/store/entitlements*`, Discord Premium Apps) — separate purchase path, no redeem codes.
- `.env.example` edits beyond documenting the new env var IF such a file exists (check; if it documents `TOPGG_WEBHOOK_SECRET`, add `TOPGG_WEBHOOK_ALLOW_INSECURE` next to it — docs-only change is allowed there).
- The dedup/report logic in `src/errorReporter.ts` — only `formatErrorMessage` changes.

## Git workflow

- Branch: `advisor/004-security-hardening-trio`
- One commit per step; conventional-ish Portuguese one-liners, e.g.:
  - `sec(vote): webhook top.gg sem secret recusa arrancar (opt-in TOPGG_WEBHOOK_ALLOW_INSECURE)`
  - `sec(redeem): código de servidor exige Gerir Servidor (códigos Plus continuam abertos)`
  - `sec(errors): reporter redige tokens e limita o corpo enviado ao webhook`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Refuse to start the vote webhook without a secret (opt-out via env)

1. `src/config/index.ts`:
   - Add to `AppConfig` (after `topggWebhookSecret?: string;`, keep the comment style):

   ```ts
   // SEC-01 — opt-in EXPLÍCITO para correr o webhook top.gg SEM secret (inseguro:
   // qualquer um que descubra a porta forja votos). Default false => sem secret,
   // o listener NÃO arranca. Env: TOPGG_WEBHOOK_ALLOW_INSECURE=true.
   topggWebhookAllowInsecure: boolean;
   ```

   - Add a helper next to `boolEnvDefaultOn` (line 138), its mirror:

   ```ts
   /**
    * Flag booleana OPT-IN (default `false`): a feature está DESLIGADA a menos que a
    * env a ligue EXPLICITAMENTE com o valor exato 'true' (case-insensitive). Espelho
    * do boolEnvDefaultOn, para opt-ins perigosos que nunca devem ligar por typo.
    */
   function boolEnvDefaultOff(name: string): boolean {
     const raw = process.env[name];
     if (raw === undefined) return false;
     return raw.trim().toLowerCase() === 'true';
   }
   ```

   - In `loadConfig()`, after line 201: `topggWebhookAllowInsecure: boolEnvDefaultOff('TOPGG_WEBHOOK_ALLOW_INSECURE'),`

2. `src/vote.ts`:
   - Widen the signature: `config: Pick<AppConfig, 'topggWebhookPort' | 'topggWebhookSecret' | 'topggWebhookAllowInsecure'>`.
   - Replace the warn-only block (lines 156-163) with refuse-by-default:

   ```ts
   const secret = config.topggWebhookSecret;
   if (secret === undefined || secret === '') {
     if (!config.topggWebhookAllowInsecure) {
       // SEC-01: sem secret, qualquer um que descubra a porta forja votos. Recusar
       // arrancar é o default seguro; o opt-in explícito fica para quem sabe o risco.
       log.error(
         `[vote] TOPGG_WEBHOOK_PORT definido (${port}) mas TOPGG_WEBHOOK_SECRET vazio — ` +
           'o webhook NÃO vai arrancar. Define TOPGG_WEBHOOK_SECRET, ou (por tua conta e ' +
           'risco) TOPGG_WEBHOOK_ALLOW_INSECURE=true para arrancar sem autenticação.',
       );
       return undefined;
     }
     log.warn(
       `[vote] TOPGG_WEBHOOK_PORT definido (${port}) sem TOPGG_WEBHOOK_SECRET e com ` +
         'TOPGG_WEBHOOK_ALLOW_INSECURE=true — webhook SEM autenticação (inseguro).',
     );
   }
   ```

   - Also update the module doc comment at the top of `src/vote.ts` (the "Sem `secret` configurado…" paragraph, lines 23-24) to reflect the new default.

3. Tests:
   - `tests/vote.test.ts`: the `cfg()` helper (lines 8-10) gains a third param `allowInsecure = false` mapped to `topggWebhookAllowInsecure`. Existing calls keep working (existing server tests pass a SECRET, so behavior is unchanged). Add to the `startVoteWebhookServer` describe (line 121):
     - port set + no secret + allow-insecure absent → `startVoteWebhookServer(cfg(0, undefined))` returns `undefined` (no server).
     - port set + no secret + `allowInsecure=true` → returns a `Server`; a POST without auth still gets 200 (reuse the existing POST helper pattern from the test at line 138).
   - `tests/config.test.ts`: add cases for `TOPGG_WEBHOOK_ALLOW_INSECURE`: unset → `false`; `'true'` → `true`; `'yes'`/`'1'` → `false` (only exact `'true'` enables). Follow the env set/cleanup pattern already used in that file.

**Verify**: `npm run build` → exit 0; `npx vitest run tests/vote.test.ts tests/config.test.ts` → all pass, including the new cases.

### Step 2: Require Manage Server to redeem guild-kind codes

1. `src/store/premium.ts` — add a read-only peek (below `createRedeemCode`, comment in Portuguese):

   ```ts
   /**
    * Espreita o TIPO de um código SEM o consumir — para o /redeem poder exigir
    * permissão de gestão ANTES de gastar um código 'guild'. O tipo de um código é
    * imutável, por isso este pre-check não tem corrida com o redeemCode.
    * Devolve null se o código não existir.
    */
   export function peekRedeemCodeKind(db: Database.Database, code: string): PremiumKind | null {
     const row = db.prepare('SELECT kind FROM redeem_code WHERE code = ?').get(code) as
       { kind: string } | undefined;
     if (!row) return null;
     return row.kind === 'guild' ? 'guild' : 'user';
   }
   ```

2. `src/i18n/catalog.ts` — add one key next to the other `redeem.*` keys (after `redeem.used`, line ~452), EN+PT:

   ```ts
   'redeem.needManageGuild': {
     en: 'This code grants **server** Premium — only members with the **Manage Server** permission can redeem it here. Ask an admin, or redeem a personal (Plus) code instead.',
     pt: 'Este código dá Premium de **servidor** — só membros com a permissão **Gerir Servidor** o podem resgatar aqui. Pede a um admin, ou resgata antes um código pessoal (Plus).',
   },
   ```

3. `src/commands/index.ts` — in `handleRedeem` (line 1250), after computing `code` and BEFORE calling `redeemCode`, mirror the `handleConfig` re-check (1886) but only for guild-kind codes:

   ```ts
   // SEC-02: um código de SERVIDOR é um artefacto pago — um membro qualquer não o
   // pode gastar (o redeem marca-o usado numa transação, irreversível). Espreita o
   // tipo SEM consumir e exige Gerir Servidor só para 'guild' (re-check server-side,
   // como no handleConfig). Códigos 'user' (Plus) continuam abertos a todos.
   if (peekRedeemCodeKind(deps.db, code) === 'guild') {
     const member = i.member as GuildMember;
     if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
       await reply(i, t('redeem.needManageGuild', locale));
       return;
     }
   }
   ```

   Add `peekRedeemCodeKind` to the existing import from `../store/premium` (check the import list near the top of `src/commands/index.ts`; `redeemCode` is already imported from there). `GuildMember` and `PermissionFlagsBits` are already imported (used by `handleConfig` / `joinUserVoice`).

4. Tests:
   - `tests/premium.test.ts` — in the `códigos de resgate` describe (line 64): `peekRedeemCodeKind` returns `'guild'` / `'user'` for codes minted with `createRedeemCode`, `null` for an unknown code, and — crucially — does NOT consume: after a peek, `redeemCode` on the same code still returns `status: 'ok'`.
   - `tests/commandsRedeem.test.ts` (create) — model on `tests/commandsConfig.test.ts` (same `vi.mock('@discordjs/voice', ...)`, `initDb(':memory:')`, fake interaction with `commandName: 'redeem'`, `options.getString('code') → the code`, and `member: { permissions: { has: (p) => ... } }`). Mint codes with `createRedeemCode(db, 'VOZEN-GUILD-1', 'guild', 30, now)` / `('VOZEN-USER-1', 'user', ...)`. Cases:
     1. guild code + member WITHOUT ManageGuild → reply is the `redeem.needManageGuild` text and the code is NOT consumed (a second attempt by an admin interaction succeeds with `redeem.ok`).
     2. guild code + member WITH ManageGuild → success reply (contains the localized `redeem.targetServer` text or matches `redeem.ok` shape).
     3. user code + member WITHOUT ManageGuild → success (Plus codes stay open).
     4. unknown code + member WITHOUT ManageGuild → `redeem.invalid` text (the peek returning null must not block the normal invalid path).
   - `tests/i18n.test.ts` — run it; if it enumerates catalog keys it will pick the new key up automatically (no edit expected; only edit if it has an explicit key list that fails).

**Verify**: `npm run build` → exit 0; `npx vitest run tests/premium.test.ts tests/commandsRedeem.test.ts tests/i18n.test.ts` → all pass.

### Step 3: Scrub tokens and cap the error-reporter body

1. `src/errorReporter.ts` — add above `formatErrorMessage` (comments in Portuguese):

   ```ts
   /** Corpo máximo encaminhado (antes do invólucro cabeçalho+code block). */
   const MAX_BODY = 1500;
   // Forma de um token de bot do Discord (3 blocos base64url separados por '.').
   const DISCORD_TOKEN_RE = /[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{27,}/g;
   // Credencial "Bearer xxx" (headers HTTP ecoados em mensagens de erro).
   const BEARER_RE = /Bearer\s+[\w.~+/=-]+/gi;

   /**
    * SEC-03: o texto de um erro pode ecoar credenciais (token do bot num erro do
    * discord.js, header Authorization num erro HTTP). Redige-as ANTES do envio para
    * o webhook (que é um canal de chat) e limita o tamanho — redigir primeiro,
    * cortar depois, para um corte nunca deixar meio token visível.
    */
   function scrub(text: string): string {
     return text
       .replace(DISCORD_TOKEN_RE, '[token-redigido]')
       .replace(BEARER_RE, 'Bearer [redigido]')
       .slice(0, MAX_BODY);
   }
   ```

2. In `formatErrorMessage`, change one line:

   ```ts
   const body = scrub(String(e?.stack || e?.message || String(error)));
   ```

   Keep the existing `MAX_CONTENT` final truncation untouched (it remains the Discord-limit guard for the wrapped message).

3. `tests/errorReporter.test.ts` — extend the `formatErrorMessage` describe (line 8) with, building token shapes synthetically (NEVER paste anything resembling a real token):

   ```ts
   it('SEC-03: redige um token com forma de token do Discord', () => {
     const fake = `${'A'.repeat(24)}.${'B'.repeat(6)}.${'C'.repeat(27)}`;
     const msg = formatErrorMessage(new Error(`401 ao usar ${fake}`), 'ctx');
     expect(msg).not.toContain(fake);
     expect(msg).toContain('[token-redigido]');
   });

   it('SEC-03: redige credenciais Bearer', () => {
     const msg = formatErrorMessage(new Error('Authorization: Bearer abc.def-123'), 'ctx');
     expect(msg).not.toContain('abc.def-123');
     expect(msg).toContain('Bearer [redigido]');
   });

   it('SEC-03: corpo limitado a 1500 chars antes do invólucro', () => {
     const msg = formatErrorMessage(new Error('x'.repeat(5000)), 'ctx');
     // corpo = 1500; invólucro (cabeçalho + code fences) é pequeno e fixo
     expect(msg.length).toBeLessThanOrEqual(1500 + 100);
   });
   ```

   Note: the existing test `trunca conteúdos gigantes...` (line 16-20) asserts `<= 1900` — it still passes (1500-char bodies are under 1900); leave it.

**Verify**: `npx vitest run tests/errorReporter.test.ts` → all pass. Then `npx vitest run` → full suite passes (watch `tests/shutdown.test.ts` / anything constructing `AppConfig` literals — `tsc` will flag any test fixture missing the new required `topggWebhookAllowInsecure` field; fix fixtures by adding `topggWebhookAllowInsecure: false`).

## Test plan

- Step 1: `tests/vote.test.ts` (+2: refuse-to-start default, opt-in starts and serves), `tests/config.test.ts` (+3 env-parse cases). Pattern: existing describes in those same files.
- Step 2: `tests/premium.test.ts` (+peek cases incl. non-consumption), `tests/commandsRedeem.test.ts` (create; 4 cases in Step 2.4). Pattern: `tests/commandsConfig.test.ts` for the fake interaction.
- Step 3: `tests/errorReporter.test.ts` (+3: discord-token redaction, Bearer redaction, 1500 cap).
- Verification: `npx vitest run` → all pass, ≥12 new tests total.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0, including the new tests in all five test files
- [ ] `grep -n "topggWebhookAllowInsecure" src/config/index.ts src/vote.ts` shows the AppConfig field, the loadConfig parse, and the guard in startVoteWebhookServer
- [ ] `grep -n "peekRedeemCodeKind" src/store/premium.ts src/commands/index.ts` shows the definition and the handleRedeem gate
- [ ] `grep -n "redeem.needManageGuild" src/i18n/catalog.ts` shows one entry with both `en:` and `pt:`
- [ ] `grep -n "token-redigido" src/errorReporter.ts` shows the redaction in scrub()
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live code at the cited lines (drift).
- `tsc` reveals more than ~5 call sites constructing `AppConfig` object literals that now miss `topggWebhookAllowInsecure` — that means the field should be optional (`topggWebhookAllowInsecure?: boolean`) instead; making it optional with the guard treating `undefined` as `false` is the acceptable fallback, but report the deviation.
- The `handleRedeem` gate would require touching the `redeemCode` transaction itself (it must not — the peek is sufficient because a code's kind is immutable).
- `tests/i18n.test.ts` fails on the new catalog key for a structural reason you don't understand after reading that test.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- SEC-01: `.env.example` (if present) should document `TOPGG_WEBHOOK_ALLOW_INSECURE` as a footgun flag. Operators who ran secret-less webhooks before will see the webhook silently NOT start after upgrading — the `log.error` line is their breadcrumb; mention this in the PR description.
- SEC-02: if a `/redeem` UX with autocomplete or a code-gifting flow is ever added, the ManageGuild gate must move/extend with it. Reviewer should confirm the gate runs BEFORE `redeemCode` (a rejected member must not consume the code) — test case 1 proves it.
- SEC-03: the token regex is shape-based and may over-redact base64-ish triples in stacks; that is the safe direction. If the webhook reports become unreadable, tighten the regex rather than removing the scrub. Deferred on purpose: scrubbing other credential shapes (AWS keys, generic API keys) — no such credentials exist in this codebase's dependencies' error paths today.
