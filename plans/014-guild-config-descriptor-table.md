# Plan 014: Drive guild_config mapping, upsert SQL and migrations from a single column-descriptor array

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- src/store/guildConfig.ts src/store/db.ts tests/store.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. NOTE: if plan 010 landed,
> `src/store/guildConfig.ts` WILL have drifted — expect `cached(...)` in
> `getGuildConfig` and `invalidate(...)` at the end of `setGuildConfig` /
> `resetGuildConfig`; that specific drift is expected and must be PRESERVED,
> not removed (see Step 4). Any other drift is a STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/010-hot-path-store-cache.md (soft — execute 010 first
  if both are planned; if 010 landed, keep its invalidation calls intact)
- **Category**: tech-debt
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

Adding ONE field to guild_config today requires ~10 synchronized edits across
two files: the CREATE TABLE (`src/store/db.ts:22-38`), an idempotent ALTER
migration (`src/store/db.ts:184-227`), the `GuildConfig` interface, the
`GuildConfigRow` interface, `DEFAULTS`, the row→object mapping in
`getGuildConfig`, and the INSERT column list / VALUES placeholders /
ON CONFLICT SET list / `.run(...)` args quartet in `setGuildConfig`
(`src/store/guildConfig.ts`). Fifteen columns already exist and every past
addition (xsaid, autojoin, read_bots, text_in_voice, greet_on_join,
greet_locale…) repeated all ten edits. Missing one produces subtle bugs
(a column silently not persisted, or a migration missing on old DBs). A single
ordered column-descriptor array makes one edit produce the mapping, the upsert
SQL and the migration — with a parity test so the handwritten interfaces can't
drift.

## Current state

- `src/store/guildConfig.ts` (148 lines) — interfaces, `DEFAULTS`,
  `getGuildConfig`, `resetGuildConfig`, `setGuildConfig`.
- `src/store/db.ts` (257 lines) — `initDb`: CREATE TABLE block + idempotent
  per-column ALTER migrations.
- `tests/store.test.ts` — `describe('guildConfig')` at lines 75-178 (13 tests:
  defaults, ttsRoleId null/set/clear, partial patches, locale, boolean/null
  round-trips). This is the behavior-pinning net.

Key excerpts (verify before editing):

`src/store/db.ts:22-38` — the CREATE TABLE (STAYS HANDWRITTEN; a test pins it
to the descriptor):

```sql
      CREATE TABLE IF NOT EXISTS guild_config (
        guild_id       TEXT PRIMARY KEY,
        tts_channel_id TEXT,
        autoread       INTEGER NOT NULL DEFAULT 0,
        default_voice  TEXT NOT NULL DEFAULT 'en_US-amy-medium',
        max_chars      INTEGER NOT NULL DEFAULT 300,
        rate_per_min   INTEGER NOT NULL DEFAULT 5,
        enabled        INTEGER NOT NULL DEFAULT 1,
        tts_role_id    TEXT,
        locale         TEXT NOT NULL DEFAULT 'en',
        xsaid          INTEGER NOT NULL DEFAULT 1,
        autojoin       INTEGER NOT NULL DEFAULT 0,
        read_bots      INTEGER NOT NULL DEFAULT 0,
        text_in_voice  INTEGER NOT NULL DEFAULT 0,
        greet_on_join  INTEGER NOT NULL DEFAULT 1,
        greet_locale   TEXT NOT NULL DEFAULT 'en'
      );
```

`src/store/db.ts:184-227` — seven hand-rolled idempotent ALTERs, all the same
shape (this is what the descriptor replaces):

```ts
    const cols = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'tts_role_id')) {
      db.exec('ALTER TABLE guild_config ADD COLUMN tts_role_id TEXT');
    }
    if (!cols.some((c) => c.name === 'locale')) {
      db.exec("ALTER TABLE guild_config ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'");
    }
    ... (xsaid INTEGER NOT NULL DEFAULT 1, autojoin INTEGER NOT NULL DEFAULT 0,
         read_bots INTEGER NOT NULL DEFAULT 0, text_in_voice INTEGER NOT NULL DEFAULT 0,
         greet_on_join INTEGER NOT NULL DEFAULT 1, greet_locale TEXT NOT NULL DEFAULT 'en')
```

Note: db.ts:184-227 ALSO contains migrations for `user_voice.engine` and
`user_clone.target_id` (lines 228-242) — those are OTHER tables; leave them
untouched.

`src/store/guildConfig.ts:74-99` — `getGuildConfig` with the per-column
defensive mapping (each column has its own null-fallback rule — the descriptor
must encode these):

```ts
if (!row) return { ...DEFAULTS };
return {
  ttsChannelId: row.tts_channel_id,
  autoread: row.autoread === 1,
  defaultVoice: row.default_voice,
  maxChars: row.max_chars,
  ratePerMin: row.rate_per_min,
  enabled: row.enabled === 1,
  ttsRoleId: row.tts_role_id,
  locale: row.locale ?? DEFAULT_LOCALE,
  xsaid: row.xsaid == null ? DEFAULTS.xsaid : row.xsaid === 1,
  autojoin: row.autojoin == null ? DEFAULTS.autojoin : row.autojoin === 1,
  readBots: row.read_bots == null ? DEFAULTS.readBots : row.read_bots === 1,
  textInVoice: row.text_in_voice == null ? DEFAULTS.textInVoice : row.text_in_voice === 1,
  greetOnJoin: row.greet_on_join == null ? DEFAULTS.greetOnJoin : row.greet_on_join === 1,
  greetLocale: row.greet_locale ?? DEFAULTS.greetLocale,
};
```

`src/store/guildConfig.ts:105-148` — `setGuildConfig`: read-merge, then the
quartet (column list, 15 placeholders, ON CONFLICT SET for every non-PK
column, 15 positional args with `? 1 : 0` boolean serialization). The
serialized VALUES per field are the byte-semantics to preserve:
`ttsChannelId` as-is (string|null), booleans as `1`/`0`, numbers as-is,
strings as-is.

If plan 010 landed: `getGuildConfig` wraps its body in
`cached(db, 'guild_config', guildId, ...)` and `setGuildConfig` /
`resetGuildConfig` end with `invalidate(db, 'guild_config', guildId)`.
PRESERVE both.

Conventions: comments in Portuguese; `DEFAULT_LOCALE` imported from
`../i18n/index`; tests use `initDb(':memory:')` per test.

## Commands you will need

| Purpose                        | Command                              | Expected on success          |
| ------------------------------ | ------------------------------------ | ---------------------------- |
| Install                        | `npm install`                        | exit 0                       |
| Typecheck                      | `npm run build`                      | exit 0 (tsc, no errors)      |
| Behavior pin (BEFORE refactor) | `npx vitest run tests/store.test.ts` | all pass — record the count  |
| Tests (all)                    | `npx vitest run`                     | 114 files / 1298+ tests pass |

(Verified at `fb7f916`: full suite → 1298 passed. No lint script.)

## Scope

**In scope** (the only files you should modify):

- `src/store/guildConfig.ts`
- `src/store/db.ts` (ONLY the guild_config ALTER-migration block, lines
  184-227; and optionally importing the descriptor)
- `tests/store.test.ts` (add tests; do not delete existing ones)

**Out of scope** (do NOT touch, even though they look related):

- The CREATE TABLE literal in `src/store/db.ts` — keep handwritten; parity is
  enforced by a test, not by generation (generating DDL at runtime is a bigger
  behavior risk than this plan accepts).
- Migrations for `user_voice.engine` and `user_clone.target_id`
  (db.ts:228-242) and every other table's schema.
- The `GuildConfig` / `GuildConfigRow` interfaces' SHAPE — they stay
  handwritten types (a test asserts key parity with the descriptor).
- Every caller of `getGuildConfig`/`setGuildConfig` (messageHandler,
  commands/index, bot/client) — signatures and returned shapes are frozen.
- `src/store/cache.ts` (if it exists from plan 010) — call it, don't edit it.

## Git workflow

- Branch: `advisor/014-guild-config-descriptor-table`
- Commit style: conventional-ish Portuguese one-liner, e.g.
  `refactor(store): guild_config guiada por descritor de colunas — 1 edit por campo novo`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Pin current behavior

Run `npx vitest run tests/store.test.ts` and confirm green BEFORE touching
anything. Also run this snapshot for later comparison:

```
node -e "const {initDb}=require('./dist/store/db');" 2>/dev/null || npm run build
```

(Ensures a compiled baseline exists; the real pin is the test suite.)

**Verify**: `npx vitest run tests/store.test.ts` → all pass.

### Step 1: Define the descriptor in `src/store/guildConfig.ts`

Add (Portuguese comments), ABOVE the existing functions:

```ts
type SqlValue = string | number | null;

/** Descritor de UMA coluna de guild_config: acrescentar um campo novo = acrescentar
 * UMA entrada aqui (+ o campo nos interfaces + no CREATE TABLE de db.ts — a paridade
 * é garantida por testes). */
interface GuildConfigColumn {
  /** nome da propriedade em GuildConfig */
  prop: keyof GuildConfig;
  /** nome da coluna SQL */
  column: string;
  /** tipo+constraints para o ALTER de migração, ex. "INTEGER NOT NULL DEFAULT 1" */
  sqlType: string;
  /** JS -> SQL (booleans viram 1/0; o resto passa tal e qual) */
  toDb: (v: GuildConfig[keyof GuildConfig]) => SqlValue;
  /** SQL -> JS com o fallback defensivo por-coluna (DBs antigas podem ter null) */
  fromDb: (raw: unknown) => GuildConfig[keyof GuildConfig];
}

export const GUILD_CONFIG_COLUMNS: GuildConfigColumn[] = [ ... ];
```

Fill the array with the FIFTEEN non-derived entries, one per column except
`guild_id` (the PK is handled separately). Encode today's exact semantics:

| prop         | column         | sqlType                                    | toDb        | fromDb                                           |
| ------------ | -------------- | ------------------------------------------ | ----------- | ------------------------------------------------ |
| ttsChannelId | tts_channel_id | `TEXT`                                     | identity    | identity (null stays null)                       |
| autoread     | autoread       | `INTEGER NOT NULL DEFAULT 0`               | `v ? 1 : 0` | `raw === 1`                                      |
| defaultVoice | default_voice  | `TEXT NOT NULL DEFAULT 'en_US-amy-medium'` | identity    | identity                                         |
| maxChars     | max_chars      | `INTEGER NOT NULL DEFAULT 300`             | identity    | identity                                         |
| ratePerMin   | rate_per_min   | `INTEGER NOT NULL DEFAULT 5`               | identity    | identity                                         |
| enabled      | enabled        | `INTEGER NOT NULL DEFAULT 1`               | `v ? 1 : 0` | `raw === 1`                                      |
| ttsRoleId    | tts_role_id    | `TEXT`                                     | identity    | identity                                         |
| locale       | locale         | `TEXT NOT NULL DEFAULT 'en'`               | identity    | `raw ?? DEFAULT_LOCALE`                          |
| xsaid        | xsaid          | `INTEGER NOT NULL DEFAULT 1`               | `v ? 1 : 0` | `raw == null ? DEFAULTS.xsaid : raw === 1`       |
| autojoin     | autojoin       | `INTEGER NOT NULL DEFAULT 0`               | `v ? 1 : 0` | `raw == null ? DEFAULTS.autojoin : raw === 1`    |
| readBots     | read_bots      | `INTEGER NOT NULL DEFAULT 0`               | `v ? 1 : 0` | `raw == null ? DEFAULTS.readBots : raw === 1`    |
| textInVoice  | text_in_voice  | `INTEGER NOT NULL DEFAULT 0`               | `v ? 1 : 0` | `raw == null ? DEFAULTS.textInVoice : raw === 1` |
| greetOnJoin  | greet_on_join  | `INTEGER NOT NULL DEFAULT 1`               | `v ? 1 : 0` | `raw == null ? DEFAULTS.greetOnJoin : raw === 1` |
| greetLocale  | greet_locale   | `TEXT NOT NULL DEFAULT 'en'`               | identity    | `raw ?? DEFAULTS.greetLocale`                    |

(That's 14 — plus NOTHING else; `guild_id` is the 15th column and is not in
the array.) TypeScript note: with `prop: keyof GuildConfig` the per-entry
value types widen to a union; keep `toDb`/`fromDb` loosely typed
(`unknown`/union) internally — the strong typing lives in the handwritten
interfaces and the parity test, not in the descriptor. Do not over-engineer
generics; a small `as` inside the two mapping functions is acceptable here.

**Verify**: `npm run build` → exit 0.

### Step 2: Drive `getGuildConfig` from the descriptor

Replace the hand-rolled literal (lines 79-98) with:

```ts
if (!row) return { ...DEFAULTS };
const out = {} as Record<string, unknown>;
for (const col of GUILD_CONFIG_COLUMNS) {
  out[col.prop] = col.fromDb((row as unknown as Record<string, unknown>)[col.column]);
}
return out as unknown as GuildConfig;
```

Keep the surrounding `SELECT * FROM guild_config WHERE guild_id = ?` query and
(if plan 010 landed) the `cached(...)` wrapper exactly where they are. The
`GuildConfigRow` interface stays (it documents the row shape and the parity
test covers it), but the mapping no longer references it field-by-field.

**Verify**: `npx vitest run tests/store.test.ts` → the 13 existing guildConfig
tests still pass.

### Step 3: Drive `setGuildConfig`'s upsert from the descriptor

Build the SQL ONCE at module level (better-sqlite3 caches prepared statements
per-connection, but string-building each call is also fine — building once is
cleaner):

```ts
const UPSERT_SQL = (() => {
  const cols = GUILD_CONFIG_COLUMNS.map((c) => c.column);
  const placeholders = ['?', ...cols.map(() => '?')].join(', ');
  const sets = cols.map((c) => `${c} = excluded.${c}`).join(',\n       ');
  return `INSERT INTO guild_config
       (guild_id, ${cols.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(guild_id) DO UPDATE SET
       ${sets}`;
})();
```

And in `setGuildConfig`:

```ts
const current = getGuildConfig(db, guildId);
const next: GuildConfig = { ...current, ...patch };
db.prepare(UPSERT_SQL).run(guildId, ...GUILD_CONFIG_COLUMNS.map((c) => c.toDb(next[c.prop])));
```

Semantics that MUST hold (they are what "byte-identical" means here): every
column is written on every set; booleans serialize to `1`/`0`; `null` stays
`null`; the read-merge with `DEFAULTS` via `getGuildConfig` is unchanged.
Column ORDER in the SQL may differ from today only if you reorder the
descriptor — keep descriptor order = today's column order anyway (listed in
Step 1) so diffs stay reviewable. If plan 010 landed, keep the trailing
`invalidate(db, 'guild_config', guildId);` as the last statement.
`resetGuildConfig` is untouched (plain DELETE, plus 010's invalidate if present).

**Verify**: `npx vitest run tests/store.test.ts` → all pass (the partial-patch
and round-trip tests exercise every serialization path).

### Step 4: Drive the ALTER migrations in `src/store/db.ts`

Import the descriptor and replace ONLY the seven guild_config `if (!cols.some(...)) db.exec('ALTER TABLE guild_config ...')`
blocks (db.ts lines 184-227) with:

```ts
// Migracoes idempotentes de guild_config guiadas pelo descritor: qualquer coluna
// do descritor que falte numa DB antiga e adicionada com o MESMO tipo/default do
// CREATE TABLE (backfill via DEFAULT constante, como antes). No-op em DBs novas.
const cols = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
for (const col of GUILD_CONFIG_COLUMNS) {
  if (!cols.some((c) => c.name === col.column)) {
    db.exec(`ALTER TABLE guild_config ADD COLUMN ${col.column} ${col.sqlType}`);
  }
}
```

Two subtleties:

1. Today only SEVEN columns have ALTERs (the original eight from the first
   CREATE never needed one). Looping ALL descriptor columns is a strict
   superset and is safe: on any DB created by any historical version, the
   original columns exist, so those iterations are no-ops. This actually FIXES
   a latent gap (a hypothetical pre-tts_role_id DB).
2. `sqlType` strings must match the historical ALTERs exactly for the seven
   migrated columns (compare with the excerpts in Current state — e.g.
   `tts_role_id` is `TEXT` with NO default, `locale` is
   `TEXT NOT NULL DEFAULT 'en'`).

Leave the `user_voice.engine` and `user_clone.target_id` migrations (lines
228-242) byte-identical. Check for import cycles: `db.ts` importing from
`guildConfig.ts` is safe (guildConfig imports only types from better-sqlite3
and `DEFAULT_LOCALE` from i18n — no cycle).

**Verify**: `npm run build` → exit 0; `npx vitest run tests/store.test.ts` →
all pass.

### Step 5: Add the new tests, then full suite

See Test plan.

**Verify**: `npm run build` → exit 0; `npx vitest run` → all 1298+ pass.

## Test plan

Add to `tests/store.test.ts` inside (or next to) `describe('guildConfig')`,
modeled on the existing tests there:

1. **Descriptor ↔ interface key parity** (the load-bearing test):
   `expect(GUILD_CONFIG_COLUMNS.map((c) => c.prop).sort()).toEqual(Object.keys(DEFAULTS).sort())`
   — this requires exporting `DEFAULTS` or, to avoid changing exports, assert
   against `Object.keys(getGuildConfig(db, 'no-such-guild'))`. Both directions
   are covered by `.toEqual` on sorted arrays. Also assert no duplicate
   `column` names: `new Set(columns).size === columns.length`.
2. **Descriptor ↔ CREATE TABLE parity**: on a fresh `initDb(':memory:')`,
   `db.pragma('table_info(guild_config)')` names must equal
   `['guild_id', ...GUILD_CONFIG_COLUMNS.map((c) => c.column)]` as sets.
3. **Round-trip of EVERY field**: `setGuildConfig` with a patch that sets all
   14 props to NON-default values (e.g. `ttsChannelId: 'c1'`,
   `autoread: true`, `defaultVoice: 'pt_PT-x'`, `maxChars: 999`,
   `ratePerMin: 42`, `enabled: false`, `ttsRoleId: 'r1'`, `locale: 'pt'`,
   `xsaid: false`, `autojoin: true`, `readBots: true`, `textInVoice: true`,
   `greetOnJoin: false`, `greetLocale: 'pt'`) → `getGuildConfig` returns
   exactly that object (`toEqual`). This pins serialization of every column.
4. **Migration from an old-shape DB**: create a tmp FILE db (pattern:
   `mkdtempSync` — see the imports already present at the top of
   `tests/store.test.ts`), open it raw with `new BetterSqlite3(path)`
   (already imported there), `exec` a guild_config CREATE with ONLY the
   original 8 columns (guild_id … tts_role_id — copy from the Current state
   excerpt minus the last 7), insert one row, close, then call `initDb(path)`
   → `getGuildConfig` for that guild returns the stored values for old columns
   and DEFAULTS for the new ones; `pragma table_info` now contains all 15.
5. The 13 EXISTING guildConfig tests are the regression net — they must pass
   unchanged (do not edit them).

Export note: tests need `GUILD_CONFIG_COLUMNS` — export it from
`src/store/guildConfig.ts` (as shown in Step 1). Do not export `DEFAULTS`
unless test 1 needs it (prefer the `getGuildConfig(db, 'absent')` trick).

Verification: `npx vitest run tests/store.test.ts` → all pass, ≥4 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0 (full suite; the 13 pre-existing guildConfig
      tests unchanged and green)
- [ ] `grep -n "GUILD_CONFIG_COLUMNS" src/store/guildConfig.ts src/store/db.ts tests/store.test.ts`
      → matches in all three files
- [ ] `grep -c "ADD COLUMN" src/store/db.ts` → exactly 3 (the descriptor loop + user_voice.engine + user_clone.target_id; today it is 9)
- [ ] `grep -n "excluded.tts_channel_id" src/store/guildConfig.ts` returns no
      match (the handwritten SET list is gone, generated instead)
- [ ] If plan 010 landed: `grep -n "invalidate(" src/store/guildConfig.ts`
      still shows calls in `setGuildConfig` and `resetGuildConfig`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts,
  except the expected plan-010 drift described in the drift check.
- Any pre-existing test in `tests/store.test.ts` fails after Steps 2-4 —
  that means the descriptor changed behavior; do NOT "fix" the test, fix the
  descriptor, and if you can't after two attempts, stop.
- The migration test (Test 4) reveals the historical ALTER strings and the
  descriptor `sqlType`s disagree in a way that changes backfilled values
  (e.g. a DEFAULT that differs from the hand-rolled migration) — stop rather
  than pick one.
- You find yourself wanting to generate the CREATE TABLE DDL or change any
  interface shape — both are explicitly out of scope.

## Maintenance notes

- Future "add a guild_config field" procedure (document this in a short
  Portuguese comment above the descriptor): 1 entry in
  `GUILD_CONFIG_COLUMNS` + 1 line in `GuildConfig` + 1 line in
  `GuildConfigRow` + 1 line in `DEFAULTS` + 1 column in the CREATE TABLE.
  Tests 1 and 2 fail loudly if any of the five is missed — that is the point.
- Reviewer should scrutinize: the generated UPSERT SQL (log it once locally
  and diff against the old literal), and the seven `sqlType` strings against
  the deleted hand-rolled ALTERs.
- Interacts with plan 010: the cache invalidation calls in
  `setGuildConfig`/`resetGuildConfig` must survive this refactor.
- Deferred: applying the same descriptor pattern to other multi-column tables
  (`user_voice`, `user_clone`) — not worth it below ~6 columns.
