// src/vote.ts
//
// OPTIONAL top.gg webhook to record bot votes (P11.5).
//
// Design (mirrors src/health.ts):
//  - `handleVoteWebhook(...)` is a PURE function (no network, no port opened):
//    validates the v1 HMAC signature or legacy Authorization secret, parses the payload and
//    returns { status, body }. Increments the `votes` metric on a valid upvote,
//    a la AudioCache.get (which also touches the metrics singleton inside the
//    unit). Testable without network.
//  - `startVoteWebhookServer(config)` creates an http.Server that collects the POST
//    body and calls the handler — but ONLY if `config.topggWebhookPort` is
//    defined. Without a port, returns undefined and opens nothing (default = no
//    server), exactly like the health endpoint.
//
// Security:
//  - v1 verifies x-topgg-signature over the raw body with HMAC-SHA256 and rejects
//    timestamps older than five minutes. Legacy v0 compares Authorization in constant time.
//  - Without a `secret` configured, the webhook does NOT start (SEC-01): without
//    authentication, anyone who discovers the port could forge votes.
//
// New listings send nested `vote.create` / `webhook.test` events. Legacy
// `upvote` / `test` payloads remain supported during migration.

import http from 'node:http';
import type { Server } from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { log } from './logging/logger';
import { metrics } from './metrics';
import type { AppConfig } from './config/index';
import { hardenServerTimeouts } from './http/serverHardening';

export interface VoteWebhookInput {
  /** Value of the request's Authorization header (or undefined if absent). */
  authHeader: string | undefined;
  /** Top.gg v1 signature header (`t=...,v1=...`), if present. */
  signatureHeader?: string;
  /** Raw request body (top.gg JSON string). */
  body: string;
  /** Expected secret. If undefined/empty, auth is NOT verified. */
  secret: string | undefined;
  /** Injectable clock for v1 replay protection. */
  now?: () => number;
  /** Discord application id this endpoint is allowed to reward. */
  expectedBotId?: string;
  /**
   * Reward: called with the voter's id on EVERY valid upvote (same condition as the
   * `votes` metric). The caller wires the perk grant here (see index.ts). A throw
   * returns 500 so Top.gg retries the delivery.
   */
  onUpvote?: (userId: string, eventId?: string) => unknown;
}

export interface VoteData {
  /** Discord id of the voter. */
  user: string;
  /** v1 (`vote.create`/`webhook.test`) or legacy (`upvote`/`test`) event type. */
  type: string;
  /** Discord id of the voted bot, if present. */
  bot?: string;
  /** Stable Top.gg vote id on v1 deliveries. */
  eventId?: string;
}

export const TOPGG_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Compares the auth header with the secret in constant time.
 *
 * `authHeader !== secret` short-circuits at the first differing byte, so the
 * response time reveals how many bytes match — a timing side-channel on an
 * authentication path. We use `crypto.timingSafeEqual`.
 *
 * `timingSafeEqual` THROWS if the buffers have different lengths; so we hash
 * both sides to a 32-byte SHA-256 (fixed length) before comparing. Bonus: the
 * digest also doesn't leak the secret's length.
 */
function authMatches(authHeader: string | undefined, secret: string): boolean {
  const a = createHash('sha256')
    .update(authHeader ?? '')
    .digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Verifies a Top.gg v1 HMAC over the untouched request body and rejects stale replays. */
function signatureMatches(
  signatureHeader: string | undefined,
  body: string,
  secret: string,
  now: number,
): boolean {
  if (!signatureHeader) return false;
  const parts = new Map(
    signatureHeader.split(',').map((part) => {
      const idx = part.indexOf('=');
      return idx === -1
        ? [part.trim(), '']
        : [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
    }),
  );
  const timestampRaw = parts.get('t');
  const receivedHex = parts.get('v1');
  if (
    !timestampRaw ||
    !receivedHex ||
    !/^\d+$/.test(timestampRaw) ||
    !/^[a-f0-9]{64}$/i.test(receivedHex)
  ) {
    return false;
  }
  const timestampMs = Number(timestampRaw) * 1000;
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > TOPGG_SIGNATURE_TOLERANCE_MS
  ) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(`${timestampRaw}.${body}`).digest();
  const received = Buffer.from(receivedHex, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export interface VoteWebhookResult {
  status: number;
  /** JSON body of the response. */
  body: string;
  /** Vote data, present only on a successful parse (200). */
  vote?: VoteData;
}

/**
 * PURE handler for the top.gg webhook.
 *
 * Order (auth BEFORE any parse, as in a gateway):
 *  1. If `secret` is defined and the authHeader doesn't match (constant-time
 *     comparison) => 401 (does NOT count a vote).
 *  2. Parse the JSON body. Invalid/malformed body => 400 (no crash).
 *  3. Success => 200 + vote data. If type === "upvote", increments `votes`.
 *     type === "test" => 200 but does NOT count (it's a test ping from the dashboard).
 */
export function handleVoteWebhook(input: VoteWebhookInput): VoteWebhookResult {
  const { authHeader, signatureHeader, body, secret, onUpvote, expectedBotId } = input;

  // 1. Auth — only when a secret is configured (literal reading of the contract).
  //    Constant-time comparison (timingSafeEqual) so as not to leak the secret via
  //    timing — see authMatches().
  if (secret !== undefined && secret !== '') {
    const authenticated = signatureHeader
      ? signatureMatches(signatureHeader, body, secret, input.now?.() ?? Date.now())
      : authMatches(authHeader, secret);
    if (!authenticated) {
      return { status: 401, body: JSON.stringify({ status: 'unauthorized' }) };
    }
  }

  // 2. Defensive parse — malformed input can NEVER crash.
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, body: JSON.stringify({ status: 'invalid_json' }) };
  }
  // Require a JSON object (not null, not array, not primitive). The top.gg payload
  // is always an object { user, type, ... }; an array/number/string isn't
  // actionable => 400.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 400, body: JSON.stringify({ status: 'invalid_payload' }) };
  }

  const obj = parsed as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : '';
  let user = typeof obj.user === 'string' ? obj.user : '';
  let bot = typeof obj.bot === 'string' ? obj.bot : undefined;
  let eventId: string | undefined;

  // New projects receive v1 nested events; legacy v0 stays supported.
  if (type === 'vote.create' || type === 'webhook.test') {
    const data =
      obj.data !== null && typeof obj.data === 'object' && !Array.isArray(obj.data)
        ? (obj.data as Record<string, unknown>)
        : {};
    const v1User =
      data.user !== null && typeof data.user === 'object' && !Array.isArray(data.user)
        ? (data.user as Record<string, unknown>)
        : {};
    const project =
      data.project !== null && typeof data.project === 'object' && !Array.isArray(data.project)
        ? (data.project as Record<string, unknown>)
        : {};
    user = typeof v1User.platform_id === 'string' ? v1User.platform_id : '';
    bot = typeof project.platform_id === 'string' ? project.platform_id : undefined;
    eventId = typeof data.id === 'string' ? data.id : undefined;
  }

  // A valid upvote needs a `user` (the voter). Without it, the payload isn't
  // actionable: we accept (200) but don't count — avoids inflating the metric with
  // empty pings. type "test" also falls here (doesn't count), and that's the desired.
  const vote: VoteData = {
    user,
    type,
    ...(bot !== undefined ? { bot } : {}),
    ...(eventId !== undefined ? { eventId } : {}),
  };

  // Defense in depth: even a correctly signed delivery must target this exact
  // Discord application. This prevents cross-project secret/config mistakes from
  // rewarding a vote for another listing.
  if ((type === 'upvote' || type === 'vote.create') && expectedBotId && bot !== expectedBotId) {
    return { status: 400, body: JSON.stringify({ status: 'wrong_project' }), vote };
  }

  if ((type === 'upvote' || type === 'vote.create') && user !== '') {
    try {
      // A v1 event id is supplied to the caller's durable ledger. Returning false
      // means this exact delivery was already processed, so it is a successful no-op.
      const processed = onUpvote?.(user, eventId);
      if (processed === false) {
        return { status: 200, body: JSON.stringify({ status: 'duplicate' }), vote };
      }
    } catch {
      return { status: 500, body: JSON.stringify({ status: 'reward_failed' }), vote };
    }
    metrics.inc('votes');
  }

  return { status: 200, body: JSON.stringify({ status: 'ok' }), vote };
}

/**
 * OPTIONAL startup of the top.gg webhook server (mirrors startHealthServer).
 *  - If `config.topggWebhookPort` is undefined (default), starts NOTHING and
 *    returns undefined.
 *  - Otherwise, creates an http.Server that accepts POST /webhook/topgg,
 *    collects the body, calls `handleVoteWebhook` (with the secret from config) and
 *    responds. Any other route/method => 404. Returns the Server handle.
 *
 * DEDICATED port (TOPGG_WEBHOOK_PORT), separate from HEALTH_PORT on purpose —
 * so as not to mix a public uptime endpoint with an authenticated webhook
 * endpoint.
 */
export function startVoteWebhookServer(
  config: Pick<AppConfig, 'clientId' | 'topggWebhookPort' | 'topggWebhookSecret'>,
  onUpvote?: (userId: string, eventId?: string) => unknown,
): Server | undefined {
  const port = config.topggWebhookPort;
  if (port === undefined) return undefined;

  const secret = config.topggWebhookSecret;
  if (secret === undefined || secret === '') {
    // SEC-01: without a secret, anyone who discovers the port could forge votes.
    log.error(
      `[vote] TOPGG_WEBHOOK_PORT definido (${port}) mas TOPGG_WEBHOOK_SECRET vazio — ` +
        'the webhook will not start. Set TOPGG_WEBHOOK_SECRET to enable authenticated vote rewards.',
    );
    return undefined;
  }

  const server = http.createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method !== 'POST' || path !== '/webhook/topgg') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_found' }));
      return;
    }

    // Collect the POST body with a defensive cap: a giant body shouldn't exhaust
    // memory. The top.gg payload is small; 64KB is generous.
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX = 64 * 1024;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'payload_too_large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      const body = Buffer.concat(chunks).toString('utf8');
      const authHeader = req.headers['authorization'];
      const signatureHeader = req.headers['x-topgg-signature'];
      const result = handleVoteWebhook({
        authHeader: typeof authHeader === 'string' ? authHeader : undefined,
        signatureHeader: typeof signatureHeader === 'string' ? signatureHeader : undefined,
        body,
        secret,
        expectedBotId: config.clientId,
        onUpvote,
      });
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(result.body);
    });
    req.on('error', (err) => {
      log.error('[vote] failed to read the webhook body', err);
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'bad_request' }));
      }
    });
  });

  server.on('error', (err) => {
    log.error(`[vote] top.gg webhook server error (port ${port})`, err);
  });

  hardenServerTimeouts(server); // short timeouts (anti-slowloris)

  // Loopback-only (defense in depth): public exposure is done via a reverse proxy on
  // the same host (Caddy), never with the raw port on the internet.
  server.listen(port, '127.0.0.1', () => {
    log.info(`[vote] top.gg webhook server listening on 127.0.0.1:${port} (POST /webhook/topgg).`);
  });

  return server;
}
