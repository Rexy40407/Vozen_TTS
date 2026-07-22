// src/premium/kofiWebhook.ts
//
// THIN HTTP server for the Ko-fi webhook. Receives the POST, verifies the token, and applies the
// grant (via the pure logic in ./kofi). INERT without KOFI_WEBHOOK_TOKEN. Always responds
// quickly (Ko-fi retries on non-2xx). The host points the domain at this port.

import { createServer, type Server } from 'node:http';
import type Database from 'better-sqlite3';
import { hardenServerTimeouts } from '../http/serverHardening';
import {
  grantGuildPass,
  grantUserPremium,
  rememberKofiSupporter,
  lookupKofiSupporter,
  recordKofiTransaction,
} from '../store/premium';
import { recordPendingGrant } from '../store/kofiPending';
import { ACTIVATION_TERMS_VERSION, activateByEmailHash, claimPendingGrant } from './claim';
import { sanitizeEmail, sendClaimHelp, shouldSendClaimHelp } from './claimHelp';
import {
  parseKofiPayload,
  verifyKofiToken,
  mapKofiToGrant,
  type ShopProduct,
  hashKofiEmail,
  type KofiEvent,
  type KofiGrant,
} from './kofi';
import type { StatusApi } from './statusApi';
import type { DashboardApi } from './dashboardApi';
import type { AdminApi, AdminGrantInput } from './adminApi';
import { handleVoteWebhook } from '../vote';

export interface KofiWebhookDeps {
  db: Database.Database;
  token: string | undefined;
  /** Discord OAuth application audience required by instant email activation. */
  clientId?: string;
  port: number;
  now: () => number;
  logInfo: (m: string) => void;
  logError: (m: string, err: unknown) => void;
  // Premium panel: optional read API mounted on the SAME server (GET /api/me/premium).
  // Absent => only the webhook. Present => also serves the API with CORS restricted to `apiOrigin`.
  statusApi?: StatusApi;
  apiOrigin?: string;
  // Web config dashboard (optional): /api/dashboard/* routes on the SAME server, same CORS.
  // Absent => no dashboard. Also requires `apiOrigin`.
  dashboardApi?: DashboardApi;
  // Admin console (plan 037): /api/admin/* routes on the SAME server. CORS restricted to
  // `adminPanelOrigin` (a DIFFERENT origin than the Premium panel — the console lives on the
  // Vozen-helper Pages site). Absent OR adminApi.enabled=false => every /api/admin/* route 404s.
  adminApi?: AdminApi;
  adminPanelOrigin?: string;
  // Discord webhook notified when a buyer asks for manual activation (POST /api/claim-help).
  // EMPTY/absent => the endpoint answers 503 and the site falls back to its copy-to-support
  // message; nothing breaks, the buyer just does one more step by hand.
  claimHelpWebhookUrl?: string;
  /** Defensive limit of the API rate-limit map. Default 2048. */
  apiRateMaxEntries?: number;
  /**
   * Ko-fi Shop item `direct_link_code` -> product (built by parseShopMap from KOFI_SHOP_MAP).
   * REQUIRED to recognize Shop purchases (e.g. the annual passes): a Shop Order does not carry
   * the product name. Absent/empty => shop orders fall back to keyword matching, which for a
   * digital item means they are ignored.
   */
  shopMap?: Map<string, ShopProduct>;
  // top.gg webhook (vote reward) mounted on the SAME public server (POST /webhook/topgg)
  // — avoids a dedicated port + new Caddy route. Absent/empty => the route is NOT served
  // (without a secret anyone would forge votes). See ./vote (handleVoteWebhook, constant-time auth).
  topggWebhookSecret?: string;
  /** Called with the id of whoever voted on each valid upvote (wires the reward grant). */
  onUpvote?: (userId: string, eventId?: string) => unknown;
}

// Simple per-IP rate limit for the panel API (sliding window). No dependencies:
// an in-memory Map is enough — resets with the process, it's best-effort anti-abuse.
const API_RATE_MAX = 30; // requests
const API_RATE_WINDOW_MS = 10_000; // per 10s
const API_RATE_MAX_ENTRIES = 2048;

// Claim (POST /api/link): MUCH tighter limit — it's anti-brute-force for the transaction
// code. 5 attempts / 10 min / IP: more than enough for a legitimate buyer and makes it
// impractical to brute-force a tx id (UUID).
const CLAIM_RATE_MAX = 5;
const CLAIM_RATE_WINDOW_MS = 10 * 60 * 1000;

// Help request (POST /api/claim-help): every accepted call pings the owner's Discord, so the limit
// protects a HUMAN's attention, not a secret — there is nothing to brute-force here (the email is
// a lookup hint, not a key). Slightly looser than the claim: someone genuinely stuck may fumble the
// email a couple of times, and the per-(user, email) dedupe in claimHelp.ts already absorbs repeats.
const CLAIM_HELP_RATE_MAX = 8;
const CLAIM_HELP_RATE_WINDOW_MS = 10 * 60 * 1000;

interface RateState {
  count: number;
  reset: number;
}

const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Applies a Ko-fi grant to the store (extends/accumulates, never reduces). Without an associated
 * Discord ID it returns null (the caller logs it for a manual grant with /vozen-grant).
 */
export function applyKofiGrant(
  db: Database.Database,
  grant: KofiGrant,
  now: number,
): number | null {
  if (!grant.discordId) return null;
  return grant.plan === 'plus'
    ? grantUserPremium(db, grant.discordId, grant.days, 'kofi', now)
    : grantGuildPass(db, grant.discordId, grant.seats, grant.days, 'kofi', now);
}

/**
 * Resolves the Discord ID of an event: from the MESSAGE (1st purchase) — and memorizes it by email —
 * or, if the message doesn't carry it (RENEWALS don't resend the note), by the stored EMAIL.
 */
export function resolveKofiDiscordId(
  db: Database.Database,
  event: KofiEvent,
  grant: KofiGrant,
  now: number,
  webhookToken: string | undefined,
): string | null {
  // We index by the email HASH (never the plaintext email) — see hashKofiEmail. The webhook
  // token is the HMAC key; it authenticates the request (verifyKofiToken), so it is always
  // present when we get here. Without a token we don't hash (degrades safely, never leaks).
  const emailHash = event.email && webhookToken ? hashKofiEmail(webhookToken, event.email) : null;
  if (grant.discordId) {
    if (emailHash) rememberKofiSupporter(db, emailHash, grant.discordId, now);
    return grant.discordId;
  }
  return emailHash ? lookupKofiSupporter(db, emailHash) : null;
}

/** Request IP (respects the reverse proxy's X-Forwarded-For; otherwise the socket). */
function clientIp(req: import('node:http').IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    // The LAST element of X-Forwarded-For is the one appended by the trusted proxy
    // (Caddy on the same host, which appends the real peer); the earlier ones come from
    // the client and are forgeable — using the leftmost would let rate-limit buckets be
    // rotated at will (1 new header = 1 new window). Documented assumption: exactly
    // ONE trusted proxy in front (see docs/DEPLOY-VPS.md, Caddy -> localhost:3001).
    const parts = xff.split(',');
    const last = parts[parts.length - 1].trim();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function pruneRateMap(rate: Map<string, RateState>, now: number, maxEntries: number): void {
  for (const [ip, state] of rate) {
    if (state.reset <= now) rate.delete(ip);
  }
  while (rate.size >= maxEntries) {
    const oldest = rate.keys().next().value as string | undefined;
    if (!oldest) break;
    rate.delete(oldest);
  }
}

/**
 * true if the IP exceeded the `max` limit in the `windowMs` window (and records the request). Parameterizable
 * to serve both the panel read (30/10s) and the claim (5/10min).
 */
function isRateLimited(
  rate: Map<string, RateState>,
  ip: string,
  now: number,
  maxEntries: number,
  max: number,
  windowMs: number,
): boolean {
  const cur = rate.get(ip);
  if (!cur || cur.reset <= now) {
    if (cur) rate.delete(ip);
    pruneRateMap(rate, now, maxEntries);
    rate.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  cur.count += 1;
  return cur.count > max;
}

interface ApiCtx {
  statusApi: StatusApi;
  apiOrigin: string;
  now: () => number;
  rate: Map<string, RateState>;
  rateMaxEntries: number;
  logError: (m: string, err: unknown) => void;
}

/** Handles GET/OPTIONS /api/me/premium: restricted CORS, rate-limit, and delegates to statusApi. */
function handleApiRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: ApiCtx,
): void {
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ctx.apiOrigin,
    Vary: 'Origin',
    ...API_SECURITY_HEADERS,
  };
  // Browser preflight.
  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization',
        'Access-Control-Max-Age': '600',
      })
      .end();
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, cors).end('method not allowed');
    return;
  }
  if (
    isRateLimited(
      ctx.rate,
      clientIp(req),
      ctx.now(),
      ctx.rateMaxEntries,
      API_RATE_MAX,
      API_RATE_WINDOW_MS,
    )
  ) {
    res.writeHead(429, cors).end('{"error":"rate_limited"}');
    return;
  }
  const auth = req.headers['authorization'];
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  ctx.statusApi
    .getStatus(bearer || null)
    .then(({ code, body }) => {
      res
        .writeHead(code, { ...cors, 'Content-Type': 'application/json' })
        .end(JSON.stringify(body));
    })
    .catch((err) => {
      ctx.logError('[premium-api] failed to serve /api/me/premium', err);
      try {
        res
          .writeHead(500, { ...cors, 'Content-Type': 'application/json' })
          .end('{"error":"internal"}');
      } catch {
        /* response already sent */
      }
    });
}

interface ClaimCtx {
  statusApi: StatusApi;
  apiOrigin: string;
  db: Database.Database;
  now: () => number;
  rate: Map<string, RateState>;
  rateMaxEntries: number;
  logError: (m: string, err: unknown) => void;
}

interface ActivationCtx extends ClaimCtx {
  kofiToken: string | undefined;
  clientId: string | undefined;
}

/** Handles the explicit-consent activation path backed by a verified Discord-account email. */
function handleActivationRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: ActivationCtx,
): void {
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ctx.apiOrigin,
    Vary: 'Origin',
    ...API_SECURITY_HEADERS,
  };
  const respond = (code: number, payload: unknown): void => {
    res
      .writeHead(code, { ...cors, 'Content-Type': 'application/json' })
      .end(JSON.stringify(payload));
  };
  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      })
      .end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, cors).end('method not allowed');
    return;
  }
  if (
    isRateLimited(
      ctx.rate,
      clientIp(req),
      ctx.now(),
      ctx.rateMaxEntries,
      CLAIM_RATE_MAX,
      CLAIM_RATE_WINDOW_MS,
    )
  ) {
    respond(429, { error: 'rate_limited' });
    return;
  }

  const auth = req.headers['authorization'];
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  let body = '';
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    body += chunk;
    if (body.length > 4_000) {
      aborted = true;
      res.writeHead(413, cors).end('too large');
      req.destroy();
    }
  });
  req.on('end', () => {
    if (aborted) return;
    let parsed: { termsAccepted?: unknown; termsVersion?: unknown };
    try {
      const value = JSON.parse(body || '{}') as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        respond(400, { error: 'bad_request' });
        return;
      }
      parsed = value as { termsAccepted?: unknown; termsVersion?: unknown };
    } catch {
      respond(400, { error: 'bad_request' });
      return;
    }
    if (parsed.termsAccepted !== true) {
      respond(400, { error: 'consent_required' });
      return;
    }
    if (parsed.termsVersion !== ACTIVATION_TERMS_VERSION) {
      respond(400, { error: 'bad_terms_version' });
      return;
    }
    if (!bearer) {
      respond(401, { error: 'no_token' });
      return;
    }
    if (!ctx.kofiToken || !ctx.clientId) {
      respond(503, { error: 'kofi_unavailable' });
      return;
    }

    ctx.statusApi
      .resolveActivationIdentity(bearer, ctx.clientId)
      .then((identityResult) => {
        if (!identityResult.ok) {
          switch (identityResult.reason) {
            case 'no_email_scope':
              respond(403, { error: 'no_email_scope' });
              return;
            case 'email_missing':
            case 'email_unverified':
              respond(422, { error: identityResult.reason });
              return;
            case 'discord_unavailable':
              respond(503, { error: 'discord_unavailable' });
              return;
            case 'wrong_audience':
            case 'invalid_token':
              respond(401, { error: 'invalid_token' });
              return;
          }
        }
        const emailHash = hashKofiEmail(ctx.kofiToken!, identityResult.identity.email);
        const outcome = activateByEmailHash(
          ctx.db,
          identityResult.identity.id,
          emailHash,
          ctx.now(),
        );
        if (!outcome.ok) {
          respond(404, { error: 'not_found' });
          return;
        }
        respond(200, {
          ok: true,
          items: outcome.items,
          confirmation: outcome.confirmation,
        });
      })
      .catch((err) => {
        // Keep upstream/token/email data out of logs. The error class is sufficient for alerting.
        ctx.logError(
          '[activation] failed to process verified-email activation',
          err instanceof Error ? err.name : 'activation_error',
        );
        try {
          respond(500, { error: 'internal' });
        } catch {
          /* response already sent */
        }
      });
  });
  req.on('error', (err) =>
    ctx.logError('[activation] request error', err instanceof Error ? err.name : 'request_error'),
  );
}

/**
 * Handles POST /api/link: the buyer (logged in with Discord) pastes the receipt code and claims the
 * pending purchase. Restricted CORS, tight rate-limit (anti-brute-force for the code), validates the
 * identity on Discord (statusApi.resolveIdentity) and delegates to claimPendingGrant. Generic 404
 * so as not to give an oracle of valid codes.
 */
function handleClaimRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: ClaimCtx,
): void {
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ctx.apiOrigin,
    Vary: 'Origin',
    ...API_SECURITY_HEADERS,
  };
  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      })
      .end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, cors).end('method not allowed');
    return;
  }
  if (
    isRateLimited(
      ctx.rate,
      clientIp(req),
      ctx.now(),
      ctx.rateMaxEntries,
      CLAIM_RATE_MAX,
      CLAIM_RATE_WINDOW_MS,
    )
  ) {
    res
      .writeHead(429, { ...cors, 'Content-Type': 'application/json' })
      .end('{"error":"rate_limited"}');
    return;
  }
  const auth = req.headers['authorization'];
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  let body = '';
  let aborted = false;
  req.on('data', (chunk) => {
    // HTTP-01: defensive guard — if the request was already aborted (413), ignore additional
    // chunks (the same pattern as vote.ts). Harmless today (req.destroy() already stopped the
    // 'data' events), but protects against a future refactor that does `await` before the
    // destroy().
    if (aborted) return;
    body += chunk;
    if (body.length > 4_000) {
      aborted = true;
      res.writeHead(413, cors).end('too large');
      req.destroy();
    }
  });
  req.on('end', () => {
    if (aborted) return;
    const respond = (code: number, payload: unknown): void => {
      res
        .writeHead(code, { ...cors, 'Content-Type': 'application/json' })
        .end(JSON.stringify(payload));
    };
    let code: string | null = null;
    try {
      const parsed = JSON.parse(body || '{}') as { code?: unknown };
      if (typeof parsed.code === 'string') code = parsed.code;
    } catch {
      respond(400, { error: 'bad_request' });
      return;
    }
    if (!bearer) {
      respond(401, { error: 'no_token' });
      return;
    }
    if (!code) {
      respond(400, { error: 'bad_request' });
      return;
    }
    ctx.statusApi
      .resolveIdentity(bearer)
      .then((identity) => {
        if (!identity) {
          respond(401, { error: 'invalid_token' });
          return;
        }
        const outcome = claimPendingGrant(ctx.db, identity.id, code!, ctx.now());
        if (!outcome.ok) {
          // use_receipt_code (plan 021): the input looked like an email — ask for the receipt code
          // instead of a generic 404, so the site can show a useful message.
          if (outcome.reason === 'use_receipt_code') {
            respond(400, { error: 'use_receipt_code' });
            return;
          }
          respond(404, { error: 'not_found' });
          return;
        }
        respond(200, { ok: true, items: outcome.items });
      })
      .catch((err) => {
        ctx.logError('[claim] failed to process claim', err);
        try {
          respond(500, { error: 'internal' });
        } catch {
          /* response already sent */
        }
      });
  });
  req.on('error', (err) => ctx.logError('[claim] request error', err));
}

interface ClaimHelpCtx {
  statusApi: StatusApi;
  apiOrigin: string;
  now: () => number;
  rate: Map<string, RateState>;
  rateMaxEntries: number;
  /** Discord webhook that receives the help request. EMPTY => the endpoint answers 503 and the
   *  site falls back to its copy-this-to-support message. */
  claimHelpWebhookUrl: string;
  /** (user, ref) -> last sent. Lives for the process; see shouldSendClaimHelp. */
  claimHelpSeen: Map<string, number>;
  logInfo: (m: string) => void;
  logError: (m: string, err: unknown) => void;
}

/**
 * Handles POST /api/claim-help: the buyer could not activate and sends the email they used on
 * Ko-fi so the owner can find the order (Ko-fi's transaction search matches by email, not by the
 * receipt Ref) and grant by hand. This is NOT an activation path and can never be one — the email
 * is a lookup hint, not proof of ownership (plan 021), and nothing here grants anything. The
 * identity is validated on Discord first; only (Discord ID, email) leaves.
 */
function handleClaimHelpRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: ClaimHelpCtx,
): void {
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ctx.apiOrigin,
    Vary: 'Origin',
    ...API_SECURITY_HEADERS,
  };
  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      })
      .end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, cors).end('method not allowed');
    return;
  }
  if (
    isRateLimited(
      ctx.rate,
      clientIp(req),
      ctx.now(),
      ctx.rateMaxEntries,
      CLAIM_HELP_RATE_MAX,
      CLAIM_HELP_RATE_WINDOW_MS,
    )
  ) {
    res
      .writeHead(429, { ...cors, 'Content-Type': 'application/json' })
      .end('{"error":"rate_limited"}');
    return;
  }
  const auth = req.headers['authorization'];
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  let body = '';
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    body += chunk;
    if (body.length > 4_000) {
      aborted = true;
      res.writeHead(413, cors).end('too large');
      req.destroy();
    }
  });
  req.on('end', () => {
    if (aborted) return;
    const respond = (code: number, payload: unknown): void => {
      res
        .writeHead(code, { ...cors, 'Content-Type': 'application/json' })
        .end(JSON.stringify(payload));
    };
    let rawEmail: string | null = null;
    try {
      const parsed = JSON.parse(body || '{}') as { email?: unknown };
      if (typeof parsed.email === 'string') rawEmail = parsed.email;
    } catch {
      respond(400, { error: 'bad_request' });
      return;
    }
    if (!bearer) {
      respond(401, { error: 'no_token' });
      return;
    }
    const email = rawEmail ? sanitizeEmail(rawEmail) : '';
    // Minimal shape check: an address has an '@' with something on each side. Not full RFC
    // validation — just enough to reject a Ref or blank so the owner never gets a useless ping.
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
      respond(400, { error: 'bad_email' });
      return;
    }
    ctx.statusApi
      .resolveIdentity(bearer)
      .then(async (identity) => {
        if (!identity) {
          respond(401, { error: 'invalid_token' });
          return;
        }
        // A repeat inside the window is answered 200 without pinging again: the buyer did their
        // part, and telling them "already sent" would only make them try harder.
        if (!shouldSendClaimHelp(ctx.claimHelpSeen, identity.id, email, ctx.now())) {
          respond(200, { ok: true, deduped: true });
          return;
        }
        const sent = await sendClaimHelp(
          {
            webhookUrl: ctx.claimHelpWebhookUrl,
            fetchImpl: fetch,
            logError: ctx.logError,
          },
          identity.id,
          email,
        );
        if (!sent) {
          // The site shows a copyable message + the support link on this. Log loudly: a buyer who
          // paid is now waiting on a notification that never arrived. The email is the buyer's PII,
          // so it stays OUT of the log line — only the Discord ID is recorded.
          ctx.logError(`[claim-help] could not notify — buyer ${identity.id} is waiting`, null);
          respond(503, { error: 'not_sent' });
          return;
        }
        ctx.logInfo(`[claim-help] activation help requested by ${identity.id}`);
        respond(200, { ok: true });
      })
      .catch((err) => {
        ctx.logError('[claim-help] failed to process request', err);
        try {
          respond(500, { error: 'internal' });
        } catch {
          /* response already sent */
        }
      });
  });
  req.on('error', (err) => ctx.logError('[claim-help] request error', err));
}

interface DashboardCtx {
  dashboardApi: DashboardApi;
  apiOrigin: string;
  now: () => number;
  rate: Map<string, RateState>;
  rateMaxEntries: number;
  logError: (m: string, err: unknown) => void;
}

const DASHBOARD_GUILD_PREFIX = '/api/dashboard/guild/';
const MAX_DASHBOARD_BODY = 8_000; // a config patch is tiny

/**
 * Web dashboard routes (guild config). CORS restricted to `apiOrigin`, rate-limit and Bearer
 * required; the real AUTHORIZATION (MANAGE_GUILD + bot present) lives in dashboardApi. Routes:
 *   GET  /api/dashboard/guilds       -> manageable servers (401 if token invalid)
 *   GET  /api/dashboard/guild/<id>   -> config (whitelist)  (403 if not authorized)
 *   POST /api/dashboard/guild/<id>   -> applies patch (whitelist) (403 if not authorized)
 */
function handleDashboardRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: DashboardCtx,
): void {
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ctx.apiOrigin,
    Vary: 'Origin',
    ...API_SECURITY_HEADERS,
  };
  const path = (req.url ?? '').split('?')[0];
  const json = (code: number, body: unknown): void => {
    res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      })
      .end();
    return;
  }
  if (
    isRateLimited(
      ctx.rate,
      clientIp(req),
      ctx.now(),
      ctx.rateMaxEntries,
      API_RATE_MAX,
      API_RATE_WINDOW_MS,
    )
  ) {
    json(429, { error: 'rate_limited' });
    return;
  }
  const auth = req.headers['authorization'];
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!bearer) {
    json(401, { error: 'no_token' });
    return;
  }

  // GET /api/dashboard/guilds -> list of manageable servers (entry point; 401 on token).
  if (req.method === 'GET' && path === '/api/dashboard/guilds') {
    ctx.dashboardApi
      .listGuilds(bearer)
      .then((guilds) =>
        guilds === null ? json(401, { error: 'invalid_token' }) : json(200, { guilds }),
      )
      .catch((err) => {
        ctx.logError('[dashboard] failed to list guilds', err);
        try {
          json(500, { error: 'internal' });
        } catch {
          /* response already sent */
        }
      });
    return;
  }

  const profileMatch = path.match(/^\/api\/dashboard\/guild\/(\d{1,20})\/profile\/(\d{1,20})$/);
  if (profileMatch) {
    const [, guildId, channelId] = profileMatch;
    if (req.method === 'DELETE') {
      ctx.dashboardApi
        .deleteChannelProfile(bearer, guildId, channelId)
        .then((deleted) => {
          if (deleted === null) return json(403, { error: 'forbidden' });
          res.writeHead(204, cors).end();
        })
        .catch((err) => {
          ctx.logError('[dashboard] failed to delete channel profile', err);
          try {
            json(500, { error: 'internal' });
          } catch {
            /* response already sent */
          }
        });
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      let aborted = false;
      req.on('data', (chunk) => {
        if (aborted) return;
        body += chunk;
        if (body.length > MAX_DASHBOARD_BODY) {
          aborted = true;
          json(413, { error: 'too_large' });
          req.destroy();
        }
      });
      req.on('end', () => {
        if (aborted) return;
        let patch: unknown;
        try {
          patch = JSON.parse(body || '{}');
        } catch {
          json(400, { error: 'bad_json' });
          return;
        }
        ctx.dashboardApi
          .saveChannelProfile(bearer, guildId, channelId, patch)
          .then((result) => {
            if (result === null) return json(403, { error: 'forbidden' });
            if ('error' in result) return json(400, result);
            json(200, result);
          })
          .catch((err) => {
            ctx.logError('[dashboard] failed to save channel profile', err);
            try {
              json(500, { error: 'internal' });
            } catch {
              /* response already sent */
            }
          });
      });
      req.on('error', (err) => ctx.logError('[dashboard] profile request error', err));
      return;
    }
    json(405, { error: 'method_not_allowed' });
    return;
  }

  // /api/dashboard/guild/<id> -> GET (read) or POST (save). 403 when not authorized.
  if (path.startsWith(DASHBOARD_GUILD_PREFIX)) {
    const guildId = path.slice(DASHBOARD_GUILD_PREFIX.length);
    if (!/^\d{1,20}$/.test(guildId)) {
      json(400, { error: 'bad_guild' });
      return;
    }

    if (req.method === 'GET') {
      ctx.dashboardApi
        .getGuild(bearer, guildId)
        .then((payload) =>
          payload === null ? json(403, { error: 'forbidden' }) : json(200, payload),
        )
        .catch((err) => {
          ctx.logError('[dashboard] failed to read configuration', err);
          try {
            json(500, { error: 'internal' });
          } catch {
            /* response already sent */
          }
        });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      let aborted = false;
      req.on('data', (chunk) => {
        // HTTP-01: defensive guard (see claim above) — ignore post-abort chunks.
        if (aborted) return;
        body += chunk;
        if (body.length > MAX_DASHBOARD_BODY) {
          aborted = true;
          json(413, { error: 'too_large' });
          req.destroy();
        }
      });
      req.on('end', () => {
        if (aborted) return;
        let patch: unknown;
        try {
          patch = JSON.parse(body || '{}');
        } catch {
          json(400, { error: 'bad_json' });
          return;
        }
        ctx.dashboardApi
          .saveConfig(bearer, guildId, patch)
          .then((result) => {
            if (result === null) {
              json(403, { error: 'forbidden' });
              return;
            }
            if ('error' in result) {
              json(400, result);
              return;
            }
            json(200, result);
          })
          .catch((err) => {
            ctx.logError('[dashboard] failed to save configuration', err);
            try {
              json(500, { error: 'internal' });
            } catch {
              /* response already sent */
            }
          });
      });
      req.on('error', (err) => ctx.logError('[dashboard] request error', err));
      return;
    }

    json(405, { error: 'method_not_allowed' });
    return;
  }

  json(404, { error: 'not_found' });
}

interface AdminCtx {
  adminApi: AdminApi;
  adminPanelOrigin: string;
  now: () => number;
  /** General bucket for the authenticated admin routes. */
  rate: Map<string, RateState>;
  /** SEPARATE tight bucket for the login route — it is password brute-force, not a read. */
  loginRate: Map<string, RateState>;
  rateMaxEntries: number;
  logInfo: (m: string) => void;
  logError: (m: string, err: unknown) => void;
}

// Login is the one admin route that takes a password, so it gets the claim-grade limit (a few
// tries per 10 min) on its OWN bucket — the authenticated routes must not spend its budget.
const ADMIN_LOGIN_RATE_MAX = 6;
const ADMIN_LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ADMIN_BODY = 4_000; // a login / grant / revoke payload is tiny

/** Collects a bounded request body and calls `done` with it; 413s (and never calls done) if it
 *  grows past `maxLen`. Shared by the admin POST routes — same shape as the other handlers inline. */
function readBody(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  cors: Record<string, string>,
  maxLen: number,
  logError: (m: string, err: unknown) => void,
  tag: string,
  done: (body: string) => void,
): void {
  let body = '';
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    body += chunk;
    if (body.length > maxLen) {
      aborted = true;
      res.writeHead(413, cors).end('too large');
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!aborted) done(body);
  });
  req.on('error', (err) => logError(`${tag} request error`, err));
}

/**
 * Admin console routes (plan 037), CORS restricted to `adminPanelOrigin`:
 *   POST /api/admin/login   {user,pass} + Bearer <Discord token>  -> mints a session (tight bucket)
 *   GET  /api/admin/passes                Bearer <session>        -> active passes + pending
 *   POST /api/admin/grant   {kind,id,days,seats?}  Bearer <session> -> grant Plus/Premium
 *   POST /api/admin/revoke  {kind,id}     Bearer <session>        -> revoke
 * SECURITY: `login` is the ONLY route that accepts a Discord token; every other route requires a
 * signed SESSION for the owner (adminApi.authorize) — a bare Discord token is refused. When the
 * console is unconfigured (adminApi.enabled=false) every route 404s. 403 stays indistinct.
 */
function handleAdminRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: AdminCtx,
): void {
  // Inert-by-default: an unconfigured console reveals nothing (the page and code are public).
  if (!ctx.adminApi.enabled) {
    res.writeHead(404).end('not found');
    return;
  }
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ctx.adminPanelOrigin,
    Vary: 'Origin',
    ...API_SECURITY_HEADERS,
  };
  const path = (req.url ?? '').split('?')[0];
  const json = (code: number, body: unknown): void => {
    res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') {
    res
      .writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      })
      .end();
    return;
  }

  const auth = req.headers['authorization'];
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  // ── LOGIN: mints a session from the DISCORD token (owner-only) + its own tight bucket. No body:
  // the only input is the Bearer OAuth token, and the server checks its identity == ownerId.
  if (path === '/api/admin/login') {
    if (req.method !== 'POST') {
      json(405, { error: 'method_not_allowed' });
      return;
    }
    if (
      isRateLimited(
        ctx.loginRate,
        clientIp(req),
        ctx.now(),
        ctx.rateMaxEntries,
        ADMIN_LOGIN_RATE_MAX,
        ADMIN_LOGIN_RATE_WINDOW_MS,
      )
    ) {
      json(429, { error: 'rate_limited' });
      return;
    }
    ctx.adminApi
      .login(bearer)
      .then((r) => {
        // One indistinct 403 on ANY failure (non-owner, missing/invalid token): no oracle.
        if (!r.ok) {
          json(403, { error: 'denied' });
          return;
        }
        ctx.logInfo('[admin] owner logged in to the console');
        json(200, { token: r.token, expiresAt: r.expiresAt });
      })
      .catch((err) => {
        ctx.logError('[admin] login failed', err);
        try {
          json(500, { error: 'internal' });
        } catch {
          /* response already sent */
        }
      });
    return;
  }

  // ── Every other admin route: general rate-limit, then a VALID SESSION for the owner. A bare
  // Discord token is NOT a session and is refused here (authorize verifies the HMAC only).
  if (
    isRateLimited(
      ctx.rate,
      clientIp(req),
      ctx.now(),
      ctx.rateMaxEntries,
      API_RATE_MAX,
      API_RATE_WINDOW_MS,
    )
  ) {
    json(429, { error: 'rate_limited' });
    return;
  }
  const owner = ctx.adminApi.authorize(bearer);
  if (!owner) {
    json(403, { error: 'forbidden' });
    return;
  }

  // ── Top talkers (global, admin-only): ASYNC — identity resolution hits the Discord REST, so
  // listTopTalkers returns a Promise. The synchronous try/catch below CANNOT catch a rejected
  // promise; an escape would reach process.on('uncaughtException') -> exit(1), dropping every live
  // voice session (BUG-01). So this route carries its own .then/.catch, exactly like login above.
  if (path === '/api/admin/toptalkers' && req.method === 'GET') {
    ctx.adminApi
      .listTopTalkers()
      .then((talkers) => json(200, { talkers }))
      .catch((err) => {
        ctx.logError('[admin] toptalkers failed', err);
        try {
          json(500, { error: 'internal' });
        } catch {
          /* response already sent */
        }
      });
    return;
  }

  // A better-sqlite3 error (disk full, I/O) thrown by any synchronous store call below must become
  // a clean 500 — never escape this request listener to process.on('uncaughtException'), which
  // exits the whole bot and drops every live voice session (the sibling Ko-fi/dashboard routes all
  // guard this). The GET routes are covered by the outer try; the POST callbacks run later on the
  // 'end' event, so they carry their own guard.
  try {
    if (path === '/api/admin/passes' && req.method === 'GET') {
      json(200, ctx.adminApi.listPasses());
      return;
    }

    if (path === '/api/admin/guilds' && req.method === 'GET') {
      json(200, { guilds: ctx.adminApi.listGuilds() });
      return;
    }

    if (path === '/api/admin/grant' && req.method === 'POST') {
      readBody(req, res, cors, MAX_ADMIN_BODY, ctx.logError, '[admin]', (raw) => {
        try {
          let parsed: { kind?: unknown; id?: unknown; days?: unknown; seats?: unknown };
          try {
            parsed = JSON.parse(raw || '{}');
          } catch {
            json(400, { error: 'bad_request' });
            return;
          }
          if (parsed.kind !== 'plus' && parsed.kind !== 'premium') {
            json(400, { error: 'bad_kind' });
            return;
          }
          if (typeof parsed.id !== 'string' || typeof parsed.days !== 'number') {
            json(400, { error: 'bad_request' });
            return;
          }
          const input: AdminGrantInput =
            parsed.kind === 'plus'
              ? { kind: 'plus', id: parsed.id, days: parsed.days }
              : {
                  kind: 'premium',
                  id: parsed.id,
                  days: parsed.days,
                  // A missing/invalid seats becomes NaN -> adminApi rejects with bad_seats.
                  seats: typeof parsed.seats === 'number' ? parsed.seats : Number.NaN,
                };
          const r = ctx.adminApi.grant(input);
          if (!r.ok) {
            json(400, { error: r.error });
            return;
          }
          json(200, { ok: true, expiresAt: r.expiresAt });
        } catch (err) {
          ctx.logError('[admin] grant failed', err);
          try {
            json(500, { error: 'internal' });
          } catch {
            /* response already sent */
          }
        }
      });
      return;
    }

    if (path === '/api/admin/revoke' && req.method === 'POST') {
      readBody(req, res, cors, MAX_ADMIN_BODY, ctx.logError, '[admin]', (raw) => {
        try {
          let parsed: { kind?: unknown; id?: unknown };
          try {
            parsed = JSON.parse(raw || '{}');
          } catch {
            json(400, { error: 'bad_request' });
            return;
          }
          if (
            (parsed.kind !== 'plus' && parsed.kind !== 'premium') ||
            typeof parsed.id !== 'string'
          ) {
            json(400, { error: 'bad_request' });
            return;
          }
          const r = ctx.adminApi.revoke({ kind: parsed.kind, id: parsed.id });
          json(200, { ok: r.ok });
        } catch (err) {
          ctx.logError('[admin] revoke failed', err);
          try {
            json(500, { error: 'internal' });
          } catch {
            /* response already sent */
          }
        }
      });
      return;
    }

    json(404, { error: 'not_found' });
  } catch (err) {
    ctx.logError('[admin] request failed', err);
    try {
      json(500, { error: 'internal' });
    } catch {
      /* response already sent */
    }
  }
}

interface TopggCtx {
  secret: string;
  expectedBotId?: string;
  onUpvote?: (userId: string, eventId?: string) => unknown;
  logError: (m: string, err: unknown) => void;
}

/**
 * Handles POST /webhook/topgg (vote reward): collects the body and delegates to the PURE handler
 * handleVoteWebhook (same logic/security as the dedicated server — constant-time auth, defensive
 * parse). Only mounted when there is a `topggWebhookSecret`; without a secret votes are NOT accepted
 * (anyone would forge the reward). 64KB anti-DoS cap, like the Ko-fi webhook.
 */
function handleTopggRequest(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: TopggCtx,
): void {
  if (req.method !== 'POST') {
    res.writeHead(405).end('method not allowed');
    return;
  }
  const chunks: Buffer[] = [];
  let bodyBytes = 0;
  let aborted = false;
  req.on('data', (chunk) => {
    // HTTP-01: defensive guard (see claim above) — ignore post-abort chunks.
    if (aborted) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodyBytes += buffer.length;
    if (bodyBytes > 64_000) {
      aborted = true;
      res.writeHead(413).end('too large');
      req.destroy();
      return;
    }
    chunks.push(buffer);
  });
  req.on('end', () => {
    if (aborted) return;
    // Decode exactly once after the full byte stream has been collected. Converting each chunk
    // independently can split a multi-byte UTF-8 character and change the signed payload.
    const body = Buffer.concat(chunks, bodyBytes).toString('utf8');
    const authHeader = req.headers['authorization'];
    const signatureHeader = req.headers['x-topgg-signature'];
    const result = handleVoteWebhook({
      authHeader: typeof authHeader === 'string' ? authHeader : undefined,
      signatureHeader: typeof signatureHeader === 'string' ? signatureHeader : undefined,
      body,
      secret: ctx.secret,
      expectedBotId: ctx.expectedBotId,
      onUpvote: ctx.onUpvote,
    });
    res.writeHead(result.status, { 'Content-Type': 'application/json' }).end(result.body);
  });
  req.on('error', (err) => {
    ctx.logError('[vote] top.gg webhook request error', err);
    if (!res.headersSent) res.writeHead(400).end('bad request');
  });
}

/**
 * Starts the Premium HTTP server. Routes:
 *   - GET/OPTIONS /api/me/premium -> Premium panel (if `statusApi` present), with CORS
 *   - POST /webhook/topgg -> vote reward (if `topggWebhookSecret` present)
 *   - POST (any other path) -> Ko-fi webhook (if `token` present)
 * No-op (returns null) if there is no Ko-fi webhook, panel API, or top.gg webhook.
 */
export function startKofiWebhook(deps: KofiWebhookDeps): Server | null {
  const { db, token, port, now, logInfo, logError, statusApi, apiOrigin, dashboardApi } = deps;
  const { topggWebhookSecret, onUpvote } = deps;
  if (!token && !statusApi && !topggWebhookSecret && !deps.adminApi) {
    logInfo(
      '[premium] HTTP server disabled (no Ko-fi webhook, dashboard API, or top.gg endpoint).',
    );
    return null;
  }
  const rate = new Map<string, RateState>();
  const claimRate = new Map<string, RateState>(); // SEPARATE bucket for the claim (tight limit)
  const activationRate = new Map<string, RateState>(); // Independent from receipt-code attempts.
  // Own bucket too: help requests must not eat the claim's 5-per-10-min budget. Someone who just
  // asked for help is exactly the person about to try activating again.
  const claimHelpRate = new Map<string, RateState>();
  const claimHelpSeen = new Map<string, number>();
  // Admin console (plan 037): own general bucket + a SEPARATE tight bucket for the password login.
  const adminRate = new Map<string, RateState>();
  const adminLoginRate = new Map<string, RateState>();
  const rateMaxEntries = Math.max(1, Math.floor(deps.apiRateMaxEntries ?? API_RATE_MAX_ENTRIES));

  const server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];

    // ── Premium panel: GET/OPTIONS /api/me/premium ─────────────────────────────────
    if (statusApi && apiOrigin && path === '/api/me/premium') {
      handleApiRequest(req, res, { statusApi, apiOrigin, now, rate, rateMaxEntries, logError });
      return;
    }

    // ── Pending purchase claim: POST/OPTIONS /api/link ─────────────────────────────
    if (statusApi && apiOrigin && path === '/api/link') {
      handleClaimRequest(req, res, {
        statusApi,
        apiOrigin,
        db,
        now,
        rate: claimRate,
        rateMaxEntries,
        logError,
      });
      return;
    }

    // ── Verified Discord-email activation: POST/OPTIONS /api/activate ─────────────
    if (statusApi && apiOrigin && path === '/api/activate') {
      handleActivationRequest(req, res, {
        statusApi,
        apiOrigin,
        db,
        now,
        rate: activationRate,
        rateMaxEntries,
        logError,
        kofiToken: token,
        clientId: deps.clientId,
      });
      return;
    }

    // ── Manual activation help: POST/OPTIONS /api/claim-help ───────────────────────
    if (statusApi && apiOrigin && path === '/api/claim-help') {
      handleClaimHelpRequest(req, res, {
        statusApi,
        apiOrigin,
        now,
        rate: claimHelpRate,
        rateMaxEntries,
        claimHelpWebhookUrl: deps.claimHelpWebhookUrl ?? '',
        claimHelpSeen,
        logInfo,
        logError,
      });
      return;
    }

    // ── Dashboard web: /api/dashboard/* ────────────────────────────────────────────
    if (
      dashboardApi &&
      apiOrigin &&
      (path === '/api/dashboard/guilds' || path.startsWith(DASHBOARD_GUILD_PREFIX))
    ) {
      handleDashboardRequest(req, res, {
        dashboardApi,
        apiOrigin,
        now,
        rate,
        rateMaxEntries,
        logError,
      });
      return;
    }

    // ── Admin console: /api/admin/* ────────────────────────────────────────────────
    // Gated only on the path prefix so an unconfigured console returns a clean 404 (inside the
    // handler) instead of falling through to the Ko-fi catch-all. CORS uses adminPanelOrigin —
    // a DIFFERENT origin than the Premium panel, and applied ONLY to these routes.
    if (deps.adminApi && path.startsWith('/api/admin/')) {
      handleAdminRequest(req, res, {
        adminApi: deps.adminApi,
        adminPanelOrigin: deps.adminPanelOrigin ?? '',
        now,
        rate: adminRate,
        loginRate: adminLoginRate,
        rateMaxEntries,
        logInfo,
        logError,
      });
      return;
    }

    // ── top.gg webhook (vote reward): POST /webhook/topgg ───────────────────────────
    // Rides on the SAME public server (api.vozen.org) so as not to require a dedicated port+Caddy.
    // BEFORE the Ko-fi catch-all (which catches ANY POST) — otherwise a POST /webhook/topgg
    // would be treated as a Ko-fi payload. Only active with a secret (otherwise anyone forges votes).
    if (topggWebhookSecret && path === '/webhook/topgg') {
      handleTopggRequest(req, res, {
        secret: topggWebhookSecret,
        expectedBotId: deps.clientId,
        onUpvote,
        logError,
      });
      return;
    }

    // ── Ko-fi webhook: POST ────────────────────────────────────────────────────────
    if (req.method !== 'POST' || !token) {
      res.writeHead(404).end('not found');
      return;
    }
    let body = '';
    let aborted = false;
    req.on('data', (chunk) => {
      // HTTP-01: defensive guard (see claim above) — ignore post-abort chunks.
      if (aborted) return;
      body += chunk;
      if (body.length > 64_000) {
        aborted = true;
        res.writeHead(413).end('too large');
        req.destroy();
      }
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const event = parseKofiPayload(body);
        if (!event) {
          res.writeHead(400).end('bad payload');
          return;
        }
        // Security: we only accept payloads with OUR Ko-fi verification token.
        if (!verifyKofiToken(event, token)) {
          logError('[kofi] invalid verification token; request ignored', event.transactionId);
          res.writeHead(401).end('bad token');
          return;
        }
        const grant = mapKofiToGrant(event, now(), deps.shopMap);
        if (!grant) {
          // A Shop Order we cannot map is a PAID purchase we are about to drop on the floor.
          // Ko-fi never sends the product name for a digital item, so `direct_link_code` is the
          // only thing that says what was bought — and it is exactly what KOFI_SHOP_MAP needs.
          // Log it at ERROR with the code so the operator both notices and has the fix in hand
          // (2026-07-12: an annual order died here as one INFO line, unseen for four days).
          // We still answer 200: a retry would map no better, and a 5xx only makes Ko-fi
          // redeliver the same unmappable payload.
          if (event.type === 'Shop Order') {
            const codes = event.shopItemCodes.join(', ') || '(none sent)';
            logError(
              `[kofi] Shop Order not in KOFI_SHOP_MAP — purchase DROPPED, nothing granted. ` +
                `Add to KOFI_SHOP_MAP: ${codes} (tx=${event.transactionId ?? '?'})`,
              null,
            );
          } else {
            // Not a product at all (a plain donation): legitimately nothing to grant.
            logInfo(`[kofi] event ignored (unrecognised product, type=${event.type}).`);
          }
          res.writeHead(200).end('ok');
          return;
        }
        // HASH the email (never in plaintext) to index a possible pending grant — see hashKofiEmail.
        const emailHash = event.email && token ? hashKofiEmail(token, event.email) : null;
        // Plan 035 — only a RENEWAL of an already-claimed subscription applies itself. Everything
        // else (a first membership payment, any Shop order, even a payload carrying a Discord ID
        // in the message) pends and gets claimed, because the claim step is where the buyer picks
        // the Discord account and gives the 14-day consent that Ko-fi's checkout cannot collect.
        //
        // Renewals are the deliberate exception: that buyer already chose an account and already
        // consented, so forcing a fresh claim every month would just make a paying subscriber
        // silently lose the service they are still paying for.
        //
        // BOTH signals are required. If Ko-fi ever stops sending is_first_subscription_payment it
        // reads as false, and the missing email binding still sends the event down the pending
        // path — the failure mode is "claim it once", never "activate with no consent".
        const isRenewal = event.isSubscriptionPayment && !event.isFirstSubscriptionPayment;
        const boundDiscordId = isRenewal && emailHash ? lookupKofiSupporter(db, emailHash) : null;
        const resolved: KofiGrant = { ...grant, discordId: boundDiscordId };
        // IDEMPOTENCY: Ko-fi redelivers on timeout/non-2xx. Recording the tx + the grant are
        // ONE transaction: on a duplicate we confirm 200 without re-applying (the grant accumulates
        // expiry — see kofi_transaction in db.ts); if the grant fails, the record reverts
        // and a legitimate retry is accepted again. Without a tx id (atypical payload) it applies
        // anyway — the log remains for manual auditing.
        const applied = db.transaction(
          (): { dup: boolean; exp: number | null; pending: boolean } => {
            if (event.transactionId && !recordKofiTransaction(db, event.transactionId, now())) {
              return { dup: true, exp: null, pending: false };
            }
            const exp = applyKofiGrant(db, resolved, now());
            // Without an associable Discord ID (the Ko-fi subscription checkout has no message
            // box): instead of losing the purchase, we store it as PENDING for the buyer to
            // CLAIM on the site (Discord login + receipt code). It needs the tx id as the key
            // (the buyer has it on the receipt); without a tx id (atypical) only the log/manual grant remains.
            let pending = false;
            if (exp == null && event.transactionId) {
              pending = recordPendingGrant(
                db,
                {
                  transactionId: event.transactionId,
                  emailHash,
                  plan: grant.plan,
                  days: grant.days,
                  seats: grant.seats,
                  isSubscription: event.isSubscriptionPayment,
                },
                now(),
              );
            }
            return { dup: false, exp, pending };
          },
        )();
        if (applied.dup) {
          logInfo(`[kofi] duplicate delivery ignored (tx=${event.transactionId}).`);
          res.writeHead(200).end('ok');
          return;
        }
        const exp = applied.exp;
        if (exp == null) {
          // Since plan 035, pending IS the normal path for a new purchase — so it logs at info.
          // Leaving it at error would cry wolf on every sale and bury the one case that really
          // does need a human. PII minimization: we never record the buyer's name; the tx id is
          // enough to reconcile against the Ko-fi panel, where the name and email live.
          if (applied.pending) {
            logInfo(
              `[kofi] purchase pending, claimable on the site: ${grant.plan} ${grant.days}d, ` +
                `tx=${event.transactionId}`,
            );
          } else {
            // No tx id means no key for the buyer to claim with (atypical payload) — the purchase
            // is stuck until it is granted by hand. That is the one that warrants shouting.
            logError(
              `[kofi] purchase with no transaction id — NOT claimable, needs a MANUAL grant: ` +
                `${grant.plan} ${grant.days}d`,
              null,
            );
          }
        } else {
          logInfo(
            `[kofi] renewal applied: ${resolved.plan} ${resolved.days}d -> ${resolved.discordId} ` +
              `(until ${new Date(exp).toISOString()}).`,
          );
        }
        res.writeHead(200).end('ok');
      } catch (err) {
        // Distinguish "unprocessable payload" from "failure to PERSIST": the former already
        // responded above (400/401/200) and never reach here; a throw here is the grant
        // transaction blowing up (SQLITE_BUSY, disk full, I/O). Responding 200 would tell Ko-fi
        // "received" and it would NOT retry → paid purchase lost. We respond 5xx for
        // Ko-fi to redeliver; the kofi_transaction ledger makes the retry idempotent.
        logError('[kofi] failed to persist grant; returning 503 for Ko-fi to retry', err);
        try {
          res.writeHead(503).end('retry');
        } catch {
          /* response already sent */
        }
      }
    });
    req.on('error', (err) => logError('[kofi] webhook request error', err));
  });
  server.on('error', (err) => logError('[kofi] webhook server error', err));
  hardenServerTimeouts(server); // short timeouts (anti-slowloris)
  // Loopback-only: the outside world arrives via Caddy (reverse_proxy localhost:3001).
  // This way the guarantee doesn't depend only on the firewall (defense in depth).
  server.listen(port, '127.0.0.1', () => logInfo(`[kofi] webhook à escuta em 127.0.0.1:${port}.`));
  return server;
}
