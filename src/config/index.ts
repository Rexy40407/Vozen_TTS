import 'dotenv/config';
import { log } from '../logging/logger';
import { PIPER_DEFAULT_SYNTH_PARAMS } from '../tts/calibration';
import {
  parseTranslationProviderConfig,
  type TranslationProviderConfig,
} from '../translation/provider';

export type TtsEngineKind = 'piper' | 'neural' | 'gtts' | 'router';

export interface AppConfig {
  token: string;
  clientId: string;
  piperPath: string;
  modelsDir: string;
  dbPath: string;
  defaultVoice: string;
  defaultSpeed: number;
  /** Silence (ms) PREPENDED to each message read — the bot only starts speaking after it. */
  messageLeadMs: number;
  queueCap: number;
  maxChars: number;
  ratePerMin: number;
  ttsEngine: TtsEngineKind;
  openaiApiKey?: string;
  // Per-user "Google HD" engine (Google Cloud TTS Standard, Premium perk). API key
  // (Google Cloud > Text-to-Speech). ABSENT => the 'gcloud' path IS gTTS (identity):
  // choosing Google HD behaves like the default and there is NO cost. The key lives ONLY
  // in the VPS .env (never in the repo), restricted to the TTS API. Env: GOOGLE_TTS_API_KEY.
  googleTtsApiKey?: string;
  // Google HD cost safeguards (allowances). All adjustable by env WITHOUT a deploy.
  // Economics: $4/1M chars, free tier 4M/month. Worst case (allowance exhausted, free tier
  // spent): Plus $0.40 vs €1.99; 3-server pass $1.60 vs €3.99; 8-server pass $4.00 vs €7.99.
  gcloudMaxChars: number; // request above this -> gTTS directly (default 500)
  gcloudPlusMonthlyChars: number; // PERSONAL Plus pool, per person/month (default 100 000)
  gcloudPass3MonthlyChars: number; // pool of the 3-server pass/month (default 400 000)
  gcloudPass8MonthlyChars: number; // pool of the 8-server pass/month (default 1 000 000)
  gcloudDailyCharBudget: number; // GLOBAL in-memory backstop/day (0 = off; default 300 000)
  /** Explicit provider configuration for text translation. Inert unless Azure config is complete. */
  translationProvider?: TranslationProviderConfig;
  presenceText?: string;
  healthPort?: number;
  /** Explicit opt-in for the coarse /status route on the loopback health listener. */
  publicStatusEnabled: boolean;
  /** Optional operator-authored public incident notice; it is sanitized and bounded at output. */
  publicStatusIncident?: string;
  shards?: string;
  // P11.5 — OPTIONAL top.gg webhook. Port absent => no server (default).
  // Secret absent => webhook without auth (insecure; always recommended to set it).
  topggWebhookPort?: number;
  topggWebhookSecret?: string;
  // Stable server-only HMAC key for the lifetime one-claim vote ledger. It is
  // intentionally separate from the rotatable Top.gg webhook secret. Required
  // for vote rewards; minimum 32 characters. Env: VOTE_REDEMPTION_SECRET.
  voteRedemptionSecret?: string;
  // Wave 3 — auto-post of the server count to top.gg (ranking/discovery).
  // top.gg API token (TOPGG_TOKEN). Absent => the updater does NOT start (opt-in).
  topggToken?: string;
  // Wave 3 — Discord webhook to send UNEXPECTED errors to (monitoring at
  // scale). URL absent => no sending (opt-in). See src/errorReporter.ts.
  errorWebhookUrl?: string;
  // Plan 036 — Discord webhook notified when a buyer asks for manual activation
  // (POST /api/claim-help). Falls back to ERROR_WEBHOOK_URL so the feature works
  // without new VPS setup; set this to route help requests to their own channel.
  // Both absent => the endpoint answers 503 and the site falls back to its
  // copy-this-to-support message. See src/premium/claimHelp.ts.
  claimHelpWebhookUrl?: string;
  // Per-segment multilingual synthesis (default ON). When ON, texts with more than
  // one language are synthesized PER-SEGMENT (the right voice per language) and the
  // WAVs concatenated — Vozen mixes voices like a real person. Can be FORCED OFF
  // globally via env MULTILINGUAL_SEGMENTS=false (single voice per sentence).
  multilingualSegments: boolean;
  // Piper synthesis QUALITY params, configurable globally. Defaults =
  // "strong" ORGANIC preset (0.75 / 0.95 / 0.4s), chosen in A/B by the operator
  // for a more natural sound (single source in PIPER_DEFAULT_SYNTH_PARAMS). They are
  // the global surface; per-voice tuning lives in VOICE_PARAM_OVERRIDES
  // (src/tts/calibration.ts). Still env-overridable via NOISE_*/SENTENCE_SILENCE.
  noiseScale: number;
  noiseW: number;
  sentenceSilence: number;
  // gTTS circuit-breaker: after N CONSECUTIVE Google failures (block/timeout
  // of ~15s), the engine "opens" and serves Piper directly during the cooldown, without
  // retrying gTTS — to avoid piling up 15s stalls per message. A successful synthesis
  // closes it. Env: GTTS_BREAKER_THRESHOLD / GTTS_BREAKER_COOLDOWN_MS.
  gttsBreakerThreshold: number;
  gttsBreakerCooldownMs: number;
  // Max gTTS chunks fetched IN PARALLEL from Google (long messages are split
  // into ≤200 chars). Default 3; 1 reproduces the old serial behavior. High
  // concurrency multiplies the instantaneous request rate (more 429 risk). Env: GTTS_CHUNK_CONCURRENCY.
  gttsChunkConcurrency: number;
  // Kokoro (OPT-IN neural engine, /voice set engine:Kokoro): Python sidecar command
  // (auto-detects tools/kokoro-venv + model if absent). WITHOUT a sidecar => choosing Kokoro
  // serves gTTS (never silence). Env: KOKORO_CMD.
  kokoroCmd?: string;
  // Languages that Kokoro serves (the others fall back to gTTS via RouterEngine). Locale
  // prefixes (what langKeyOfModel returns). Default = those validated in the spike (without 'zh',
  // which needs misaki[zh]). Env KOKORO_LANGS = csv, e.g. "en,pt,es".
  kokoroLangs: Set<string>;
  // Support/report channel shown in /help. Discord's Developer Policy
  // requires that the user has a way to report problems/violations;
  // this link satisfies that requirement. Default = Vozen's official support
  // server; a self-hoster points to THEIR OWN via env SUPPORT_URL.
  supportUrl: string;
  // Discord Premium Apps (native monetization). IDs of the SKUs created in the Developer
  // Portal AFTER the app is verified and the monetization onboarding is done.
  // ABSENT => the entitlements subsystem stays INERT (only /redeem). Env:
  // PREMIUM_GUILD_SKU_ID (per-server subscription ≙ Premium) and PREMIUM_USER_SKU_ID
  // (per-user subscription ≙ Plus).
  premiumGuildSkuId?: string;
  premiumUserSkuId?: string;
  // Ko-fi page where Premium/Plus is bought. Shown in /premium info and in the
  // "you have no pass" errors. Env KOFI_URL; default = generic page (the operator sets theirs).
  kofiUrl: string;
  // OWNER-ONLY commands (/vozen-grant): defense in depth. The command is registered ONLY
  // in OWNER_GUILD_ID (guild command) — the public does not even see it. In addition the handler
  // checks the invoker against the REAL owner resolved via client.application (User/Team) at startup;
  // OWNER_ID is an explicit fallback. Without OWNER_GUILD_ID the command is not registered.
  ownerGuildId?: string;
  ownerId?: string;
  // Ko-fi webhook (purchases -> premium). Verification token (Ko-fi > Settings > API);
  // ABSENT => the webhook server does NOT start (inert). Port of the local HTTP endpoint.
  kofiWebhookToken?: string;
  kofiWebhookPort: number;
  /**
   * Ko-fi Shop items -> product, as `code:plan:days[:seats]` entries separated by commas
   * (env KOFI_SHOP_MAP). Needed because a Shop Order does not carry the product NAME —
   * only its `direct_link_code`. Absent/empty => no shop products (annual passes off).
   */
  kofiShopMap?: string;
  // Site Premium Panel (login with Discord -> GET /api/me/premium on the SAME HTTP server).
  // OPT-IN: PREMIUM_API_ENABLED=true mounts the API. PREMIUM_API_ORIGIN is the site origin
  // allowed in CORS (only it can call the API from the browser). Without enable => inert.
  premiumApiEnabled: boolean;
  premiumApiOrigin: string;
  // Admin console (plan 037): the /api/admin/* routes on the SAME HTTP server. Gated by the
  // operator's Discord identity — only OWNER_ID may log in. Requires ADMIN_SESSION_SECRET (the HMAC
  // key for the signed session) AND OWNER_ID, or every admin route 404s (inert — this is what keeps
  // the public repo safe). ADMIN_PANEL_ORIGIN is the site origin allowed in CORS on the admin
  // routes ONLY (the panel lives on the Vozen-helper Pages site, a different origin than the
  // Premium panel).
  adminSessionSecret?: string;
  adminPanelOrigin?: string;
  // The OAuth application (client) id the admin console logs in with. A login token must have
  // been minted by THIS app (audience binding), not merely resolve to OWNER_ID. Defaults to the
  // Vozen-helper console's app id; override with ADMIN_CLIENT_ID.
  adminClientId?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function strEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return value;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Number that MUST be POSITIVE (> 0). Absent/empty => fallback. A non-numeric
 * value, <= 0, or (if `integer`) non-integer => WARNS and uses the fallback, instead
 * of silently accepting it. Rationale: `RATE_PER_MIN=0` / `QUEUE_CAP=0` /
 * `MAX_CHARS=0` (typo) made the bot silently MUTE (queue/limiter reject
 * everything) with no explanation. Degrading to the safe default + warning is better
 * than a silently dead bot OR a startup crash-loop.
 */
function numEnvPositive(name: string, fallback: number, opts: { integer?: boolean } = {}): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  const bad =
    !Number.isFinite(parsed) || parsed <= 0 || (opts.integer && !Number.isInteger(parsed));
  if (bad) {
    log.warn(
      `[config] ${name}="${raw}" is invalid (expected ${opts.integer ? 'an integer ' : ''}> 0). Using default ${fallback}.`,
    );
    return fallback;
  }
  return parsed;
}

/**
 * OPTIONAL number: absent/empty => undefined (unlike numEnv, which always has
 * a fallback). A non-numeric value also => undefined — the defensive choice,
 * consistent with the rest of the module: we do not start a server because of
 * a typo in the env. Used by HEALTH_PORT (no port => no server).
 */
function numEnvOptional(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * OPT-OUT boolean flag (default `true`): the feature is ON unless the env
 * turns it off EXPLICITLY. Only the exact value 'false' (case-insensitive) turns it off;
 * anything else (absent, empty, 'true', '1', typo) stays ON. It is the mirror of
 * boolEnv for features that are the default behavior but where we want a global
 * kill-switch via env.
 */
function boolEnvDefaultOn(name: string): boolean {
  const raw = process.env[name];
  if (raw === undefined) return true;
  return raw.trim().toLowerCase() !== 'false';
}

/**
 * OPT-IN boolean flag (default `false`): the feature is OFF unless the
 * env turns it on EXPLICITLY with the exact value 'true' (case-insensitive). Mirror
 * of boolEnvDefaultOn, for dangerous opt-ins that must never turn on by a typo.
 */
function boolEnvDefaultOff(name: string): boolean {
  const raw = process.env[name];
  if (raw === undefined) return false;
  return raw.trim().toLowerCase() === 'true';
}

/**
 * Reads TTS_ENGINE. Default 'piper'. An invalid value (other than 'piper'/'neural')
 * falls back to 'piper' with a warning on stderr — Piper is the safe default and never
 * needs an API key, so degrading to it is preferable to crashing the
 * startup over a typo in the env. (The 'neural' combination without OPENAI_API_KEY does
 * fail fast — see createEngine.)
 */
function engineEnv(): TtsEngineKind {
  const raw = process.env.TTS_ENGINE;
  if (raw === undefined || raw.trim() === '') return 'piper';
  const value = raw.trim().toLowerCase();
  if (value === 'piper' || value === 'neural' || value === 'gtts' || value === 'router')
    return value;
  log.warn(
    `[config] invalid TTS_ENGINE "${raw}"; accepted values are piper, neural, gtts, and router. Falling back to piper.`,
  );
  return 'piper';
}

/** A configuration problem detected by `validateConfigEnv`. */
export interface ConfigFinding {
  level: 'warn' | 'error';
  message: string;
}

// Secret/token vars that, if PRESENT but EMPTY, indicate a clobber by a
// duplicate line in the .env (dotenv v16: duplicate keys => the LAST one wins) rather
// than "feature intentionally turned off" (which is the ABSENT env). Any
// new secret with the same risk must be added here.
const EMPTY_SECRET_VARS = [
  'TOPGG_WEBHOOK_SECRET',
  'VOTE_REDEMPTION_SECRET',
  'KOFI_WEBHOOK_TOKEN',
  // PAID API keys: if a residual empty `KEY=` line overrides the good one, the respective
  // Premium engine silently falls back to the free default (Google HD) or fails
  // startup (OpenAI neural) — in both cases it is worth warning instead of degrading without a trace.
  'GOOGLE_TTS_API_KEY',
  'OPENAI_API_KEY',
] as const;

/**
 * Plan 024 (SECRET-01) — PURE validation of the raw env: it does not read `process.env`
 * directly (it receives a record) nor has side-effects, so it is testable in
 * isolation. Returns findings for the caller (`loadConfig`) to log, never
 * the secret value itself (only the var NAME).
 *
 * Two cases covered:
 *  1. Secret PRESENT but EMPTY (`KEY in env && KEY.trim() === ''`):
 *     distinct from ABSENT (which is "feature off", a legitimate state).
 *     Typical symptom: a residual/duplicate `TOPGG_WEBHOOK_SECRET=` line
 *     after the good one silently wipes the real value (dotenv last-wins) —
 *     see src/vote.ts:113, which treats secret === '' as "no auth".
 *  2. Redundant dedicated top.gg listener: TOPGG_WEBHOOK_PORT set
 *     at the same time as a non-empty TOPGG_WEBHOOK_SECRET — the shared
 *     /webhook/topgg route on the API already covers the authenticated case.
 */
export function validateConfigEnv(env: Record<string, string | undefined>): ConfigFinding[] {
  const findings: ConfigFinding[] = [];

  for (const key of EMPTY_SECRET_VARS) {
    if (key in env && (env[key] ?? '').trim() === '') {
      findings.push({
        level: 'warn',
        message: `[config] ${key} está presente mas VAZIO — uma linha duplicada/residual pode tê-lo sobreposto (dotenv usa sempre a ÚLTIMA ocorrência da chave). Se não era intenção desligar esta feature, corrige o .env.`,
      });
    }
  }

  const topggPortSet = (env.TOPGG_WEBHOOK_PORT ?? '').trim() !== '';
  const topggSecretNonEmpty = (env.TOPGG_WEBHOOK_SECRET ?? '').trim() !== '';
  const redemptionSecret = (env.VOTE_REDEMPTION_SECRET ?? '').trim();
  if (topggSecretNonEmpty && redemptionSecret.length < 32) {
    findings.push({
      level: 'error',
      message:
        '[config] the top.gg vote endpoint is enabled but VOTE_REDEMPTION_SECRET is missing or shorter than 32 characters; refusing to start with a resettable reward ledger.',
    });
  }
  if (topggPortSet && topggSecretNonEmpty) {
    findings.push({
      level: 'warn',
      message:
        '[config] TOPGG_WEBHOOK_PORT is set with a non-empty TOPGG_WEBHOOK_SECRET; the dedicated listener duplicates the shared public /webhook/topgg route, so consider removing TOPGG_WEBHOOK_PORT.',
    });
  }

  return findings;
}

export function loadConfig(): AppConfig {
  const findings = validateConfigEnv(process.env);
  for (const finding of findings) {
    if (finding.level === 'error') log.error(finding.message);
    else log.warn(finding.message);
  }
  if (findings.some((finding) => finding.level === 'error')) {
    throw new Error('[config] invalid security configuration; see the error above');
  }
  return {
    token: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('CLIENT_ID'),
    piperPath: strEnv('PIPER_PATH', 'piper'),
    modelsDir: strEnv('MODELS_DIR', './models'),
    dbPath: strEnv('DB_PATH', './tts.db'),
    defaultVoice: strEnv('DEFAULT_VOICE', 'en_US-amy-medium'),
    defaultSpeed: numEnvPositive('DEFAULT_SPEED', 1), // > 0 (fractional ok: 0.5–2.0)
    messageLeadMs: numEnv('MESSAGE_LEAD_MS', 200), // 0.20s (0 = no wait, so it does NOT require > 0)
    queueCap: numEnvPositive('QUEUE_CAP', 20, { integer: true }),
    maxChars: numEnvPositive('MAX_CHARS', 300, { integer: true }),
    ratePerMin: numEnvPositive('RATE_PER_MIN', 8, { integer: true }),
    ttsEngine: engineEnv(),
    openaiApiKey: strEnv('OPENAI_API_KEY', '') || undefined,
    // Google HD (Google Cloud TTS Standard). Absent => 'gcloud' path = gTTS (inert).
    googleTtsApiKey: strEnv('GOOGLE_TTS_API_KEY', '') || undefined,
    // Google HD allowances (see the comment on the interface). numEnvPositive: an
    // invalid/<=0 env falls into the safe default with a warning. The daily backstop allows 0 (off),
    // so it uses numEnv (does not require > 0).
    gcloudMaxChars: numEnvPositive('GCLOUD_MAX_CHARS', 500, { integer: true }),
    gcloudPlusMonthlyChars: numEnvPositive('GCLOUD_PLUS_MONTHLY_CHARS', 100_000, { integer: true }),
    gcloudPass3MonthlyChars: numEnvPositive('GCLOUD_PASS3_MONTHLY_CHARS', 400_000, {
      integer: true,
    }),
    gcloudPass8MonthlyChars: numEnvPositive('GCLOUD_PASS8_MONTHLY_CHARS', 1_000_000, {
      integer: true,
    }),
    gcloudDailyCharBudget: numEnv('GCLOUD_DAILY_CHAR_BUDGET', 300_000),
    translationProvider: parseTranslationProviderConfig(process.env),
    // P9.3 — optional presence text; empty/absent => undefined and buildPresence
    // uses its brand default. Exact override when set.
    presenceText: strEnv('PRESENCE_TEXT', '') || undefined,
    // P9.7 — OPTIONAL port for the HTTP health endpoint (uptime monitors). Absent
    // => undefined => does NOT start any server (default). Set => number.
    healthPort: numEnvOptional('HEALTH_PORT'),
    publicStatusEnabled: boolEnvDefaultOff('PUBLIC_STATUS_ENABLED'),
    publicStatusIncident: strEnv('PUBLIC_STATUS_INCIDENT', '') || undefined,
    // P11.4 — RAW value of BOT_SHARDS (sharding opt-in). Absent/empty =>
    // undefined => single-process (default). The interpretation (auto / N / single) is
    // done by resolveShardCount in the launcher src/shard.ts — here we only carry
    // the string.
    // NB: the env is called BOT_SHARDS and NOT `SHARDS` on purpose. `SHARDS` (and
    // `SHARD_COUNT`) are reserved: the discord.js Client constructor reads them
    // directly from process.env. In a single-process startup (`npm start`),
    // `SHARDS=auto` would make `JSON.parse('auto')` crash the Client, and `SHARDS=N`
    // would configure the process as an isolated shard — breaking the default. Keeping
    // the distinct name isolates the opt-in from discord.js's internal mechanism.
    shards: strEnv('BOT_SHARDS', '') || undefined,
    // P11.5 — OPTIONAL top.gg webhook. TOPGG_WEBHOOK_PORT absent/empty/invalid
    // => undefined => does NOT start a webhook server (default), just like
    // HEALTH_PORT. TOPGG_WEBHOOK_SECRET absent/empty => the dedicated listener
    // refuses to start, so vote rewards are never exposed without authentication.
    // Dedicated port, separate from HEALTH_PORT on purpose.
    topggWebhookPort: numEnvOptional('TOPGG_WEBHOOK_PORT'),
    topggWebhookSecret: strEnv('TOPGG_WEBHOOK_SECRET', '') || undefined,
    voteRedemptionSecret: strEnv('VOTE_REDEMPTION_SECRET', '') || undefined,
    topggToken: strEnv('TOPGG_TOKEN', '') || undefined,
    errorWebhookUrl: strEnv('ERROR_WEBHOOK_URL', '') || undefined,
    claimHelpWebhookUrl:
      strEnv('CLAIM_HELP_WEBHOOK_URL', '') || strEnv('ERROR_WEBHOOK_URL', '') || undefined,
    // Per-segment multilingual synthesis — ON by default: without this env (or with
    // any value != 'false'), Vozen mixes voices per language. Global kill-switch:
    // MULTILINGUAL_SEGMENTS=false forces a single voice per sentence.
    multilingualSegments: boolEnvDefaultOn('MULTILINGUAL_SEGMENTS'),
    // Piper quality params. Defaults = ORGANIC preset (single source in
    // PIPER_DEFAULT_SYNTH_PARAMS = 0.75/0.95/0.4). numEnv does safe parsing:
    // absent/empty/non-numeric env falls into the default; a valid env wins over it.
    noiseScale: numEnv('NOISE_SCALE', PIPER_DEFAULT_SYNTH_PARAMS.noiseScale),
    noiseW: numEnv('NOISE_W', PIPER_DEFAULT_SYNTH_PARAMS.noiseW),
    sentenceSilence: numEnv('SENTENCE_SILENCE', PIPER_DEFAULT_SYNTH_PARAMS.sentenceSilence),
    // gTTS circuit-breaker: 3 consecutive failures -> opens for 60s (uses Piper). Both
    // > 0 (numEnvPositive): a threshold/cooldown of 0 would disable the protection by accident.
    gttsBreakerThreshold: numEnvPositive('GTTS_BREAKER_THRESHOLD', 3, { integer: true }),
    gttsBreakerCooldownMs: numEnvPositive('GTTS_BREAKER_COOLDOWN_MS', 60_000, { integer: true }),
    gttsChunkConcurrency: numEnvPositive('GTTS_CHUNK_CONCURRENCY', 3, { integer: true }),
    // Kokoro: sidecar command (absent => auto-detects tools/kokoro-venv).
    kokoroCmd: process.env.KOKORO_CMD?.trim() || undefined,
    // Kokoro languages: csv KOKORO_LANGS (prefixes), or those validated in the spike by default.
    kokoroLangs: new Set(
      (process.env.KOKORO_LANGS?.trim()
        ? process.env.KOKORO_LANGS.split(',')
        : ['en', 'es', 'fr', 'hi', 'it', 'pt', 'ja']
      )
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
    // Support/report channel (Discord Developer Policy requirement).
    // Default = Vozen's official support server; override with SUPPORT_URL.
    supportUrl: strEnv('SUPPORT_URL', 'https://discord.gg/4kYw2WUbNN'),
    // Premium Apps (native monetization). Absent => inert entitlements (only /redeem).
    premiumGuildSkuId: strEnv('PREMIUM_GUILD_SKU_ID', '') || undefined,
    premiumUserSkuId: strEnv('PREMIUM_USER_SKU_ID', '') || undefined,
    // Ko-fi page (Premium/Plus purchase). The operator sets KOFI_URL to theirs.
    kofiUrl: strEnv('KOFI_URL', 'https://ko-fi.com/'),
    // Owner-only: control server (where /vozen-grant is registered) + explicit owner.
    ownerGuildId: strEnv('OWNER_GUILD_ID', '') || undefined,
    ownerId: strEnv('OWNER_ID', '') || undefined,
    // Ko-fi webhook: no token => does not start. Local endpoint port.
    kofiWebhookToken: strEnv('KOFI_WEBHOOK_TOKEN', '') || undefined,
    kofiWebhookPort: numEnvPositive('KOFI_WEBHOOK_PORT', 3001, { integer: true }),
    kofiShopMap: strEnv('KOFI_SHOP_MAP', ''),
    // Premium Panel: explicit opt-in (default off). Origin = site domain (vozen.org).
    // Production must set PREMIUM_API_ORIGIN in .env; the default follows the current domain.
    premiumApiEnabled: boolEnvDefaultOff('PREMIUM_API_ENABLED'),
    premiumApiOrigin: strEnv('PREMIUM_API_ORIGIN', 'https://vozen.org'),
    // Admin console (plan 037). Empty ADMIN_SESSION_SECRET or OWNER_ID => inert (no admin routes).
    // The owner check reuses OWNER_ID. ADMIN_PANEL_ORIGIN defaults to the Vozen-helper Pages origin.
    adminSessionSecret: strEnv('ADMIN_SESSION_SECRET', '') || undefined,
    adminPanelOrigin: strEnv('ADMIN_PANEL_ORIGIN', 'https://rexy40407.github.io') || undefined,
    adminClientId: strEnv('ADMIN_CLIENT_ID', '1526211106081734666') || undefined,
  };
}
