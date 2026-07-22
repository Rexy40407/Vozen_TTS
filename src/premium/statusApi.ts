// src/premium/statusApi.ts
//
// READ API for premium status, used by the site's Premium Panel (login with Discord).
// The site is static (GitHub Pages) and uses OAuth2 implicit (scope `identify`): it gets a
// Discord access_token and calls GET /api/me/premium with `Authorization: Bearer <token>`.
// Here we do NOT trust any ID coming from the client — we ask Discord "whose token is
// this?" (/users/@me) and only then read that user's SQLite. This makes it impossible to see
// someone else's status. Short cache (token->identity) to avoid hitting Discord on every
// refresh. Logic isolated from the HTTP server (mounted in kofiWebhook.ts) to be testable.

import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { buildPremiumStatus } from '../store/premium';

/** Minimal identity we pull from Discord's /users/@me. */
export interface DiscordIdentity {
  id: string;
  username: string;
  avatar: string | null;
}

/** Token audience from /oauth2/@me: WHICH user AND WHICH OAuth application minted the token.
 *  The admin console binds on BOTH, so an identify token for the owner minted by any other
 *  application is refused (access-token substitution defence). */
export interface DiscordAuthorization {
  userId: string;
  applicationId: string;
  scopes: string[];
}

export interface DiscordActivationIdentity {
  id: string;
  email: string;
}

export type ActivationIdentityFailure =
  | 'invalid_token'
  | 'wrong_audience'
  | 'no_email_scope'
  | 'email_missing'
  | 'email_unverified'
  | 'discord_unavailable';

export type ActivationIdentityResult =
  | { ok: true; identity: DiscordActivationIdentity }
  | { ok: false; reason: ActivationIdentityFailure };

export interface StatusApiDeps {
  db: Database.Database;
  now: () => number;
  /** Discord application that is allowed to mint tokens for this panel. */
  expectedClientId: string;
  /** Injectable for tests; in production it is Node's global fetch. */
  fetchImpl: typeof fetch;
  /** Resolves a server's name by ID (bot's guild cache). Absent => ID only. */
  resolveGuildName?: (guildId: string) => string | null;
  /** TTL of the token->identity cache (ms). Default 60s. */
  identityTtlMs?: number;
  /** Defensive limit against slow spam of different tokens. Default 512. */
  identityCacheMaxEntries?: number;
  logError?: (m: string, err: unknown) => void;
}

export interface StatusResponse {
  code: number;
  body: unknown;
}

export interface StatusApi {
  getStatus(token: string | null): Promise<StatusResponse>;
  resolveIdentity(token: string): Promise<DiscordIdentity | null>;
  resolveAuthorization(token: string): Promise<DiscordAuthorization | null>;
  resolveActivationIdentity(
    token: string,
    expectedClientId: string,
  ): Promise<ActivationIdentityResult>;
}

const DISCORD_ME = 'https://discord.com/api/v10/users/@me';
// /oauth2/@me additionally reveals the token's `application.id` (the client that minted it) —
// what /users/@me cannot. The admin login uses it to bind the token's audience.
const DISCORD_OAUTH_ME = 'https://discord.com/api/v10/oauth2/@me';

// Ceiling on the Discord validation: without this a slow/hung discord.com would hold the
// panel's HTTP request open (and, under spam, pile up). On abort we fall into the catch => 401.
const DISCORD_FETCH_TIMEOUT_MS = 5_000;

/**
 * Creates the panel API. Keeps a token->identity cache (short TTL) — avoids hitting
 * Discord on every panel refresh and limits the damage of invalid-token spam (an invalid
 * token is also cached as `null` for the TTL).
 */
export function createStatusApi(deps: StatusApiDeps): StatusApi {
  const ttl = deps.identityTtlMs ?? 60_000;
  const maxCacheEntries = Math.max(1, Math.floor(deps.identityCacheMaxEntries ?? 512));
  const cache = new Map<string, { identity: DiscordIdentity | null; exp: number }>();

  // OAuth tokens are credentials. Never retain them in an in-memory cache key where a heap dump
  // or accidental diagnostics could disclose a bearer token.
  const tokenCacheKey = (token: string): string =>
    createHash('sha256').update(token).digest('base64url');

  function pruneCache(now: number): void {
    for (const [key, value] of cache) {
      if (value.exp <= now) cache.delete(key);
    }
    while (cache.size >= maxCacheEntries) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  async function fetchDiscordJson(
    url: string,
    token: string,
  ): Promise<
    { ok: true; body: unknown } | { ok: false; reason: 'invalid_token' | 'discord_unavailable' }
  > {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), DISCORD_FETCH_TIMEOUT_MS);
    try {
      const res = await deps.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      if (!res.ok) {
        return {
          ok: false,
          reason:
            res.status === 401 || res.status === 403 ? 'invalid_token' : 'discord_unavailable',
        };
      }
      return { ok: true, body: await res.json() };
    } catch (err) {
      // Do not pass arbitrary upstream error messages to the logger: a fetch implementation may
      // include request headers or response data in them. The error class is enough operationally.
      deps.logError?.(
        '[premium-api] Discord authorization request failed',
        err instanceof Error ? err.name : 'fetch_error',
      );
      return { ok: false, reason: 'discord_unavailable' };
    } finally {
      clearTimeout(timer);
    }
  }

  async function resolveIdentity(token: string): Promise<DiscordIdentity | null> {
    const now = deps.now();
    const cacheKey = tokenCacheKey(token);
    const hit = cache.get(cacheKey);
    if (hit && hit.exp > now) return hit.identity;
    if (hit) cache.delete(cacheKey);
    pruneCache(now);

    let identity: DiscordIdentity | null = null;
    const authorization = await fetchDiscordJson(DISCORD_OAUTH_ME, token);
    if (authorization.ok) {
      const oauth = authorization.body as {
        application?: { id?: unknown };
        user?: { id?: unknown };
        scopes?: unknown;
      };
      const oauthUserId = oauth.user?.id;
      const scopes = Array.isArray(oauth.scopes)
        ? oauth.scopes.filter((scope): scope is string => typeof scope === 'string')
        : [];
      if (
        oauth.application?.id === deps.expectedClientId &&
        typeof oauthUserId === 'string' &&
        scopes.includes('identify')
      ) {
        const user = await fetchDiscordJson(DISCORD_ME, token);
        if (user.ok) {
          const u = user.body as {
            id?: unknown;
            username?: unknown;
            global_name?: unknown;
            avatar?: unknown;
          };
          if (typeof u.id === 'string' && u.id === oauthUserId) {
            const name =
              (typeof u.global_name === 'string' && u.global_name) ||
              (typeof u.username === 'string' && u.username) ||
              u.id;
            identity = {
              id: u.id,
              username: name,
              avatar: typeof u.avatar === 'string' ? u.avatar : null,
            };
          }
        }
      }
    }
    // Cache even the `null` (invalid token) to avoid repeating the fetch under spam.
    pruneCache(now);
    cache.set(cacheKey, { identity, exp: now + ttl });
    return identity;
  }

  async function getStatus(token: string | null): Promise<StatusResponse> {
    if (!token) return { code: 401, body: { error: 'no_token' } };
    const identity = await resolveIdentity(token);
    if (!identity) return { code: 401, body: { error: 'invalid_token' } };

    const status = buildPremiumStatus(deps.db, identity.id, deps.now());
    const pass = status.pass
      ? {
          seats: status.pass.seats,
          used: status.pass.used,
          expiresAt: status.pass.expiresAt,
          active: status.pass.active,
          servers: status.pass.guilds.map((id) => ({
            id,
            name: deps.resolveGuildName?.(id) ?? null,
          })),
        }
      : null;

    return {
      code: 200,
      body: {
        user: { id: identity.id, username: identity.username, avatar: identity.avatar },
        plus: status.plus,
        pass,
      },
    };
  }

  /** Validates the token against /oauth2/@me and returns WHICH user + WHICH OAuth application it
   *  belongs to. Unlike /users/@me this exposes the token's `application.id`, letting the admin
   *  console refuse a token minted for the owner by any OTHER application. Not cached: admin
   *  logins are rare and a stale audience must never be reused. Fails closed (null) on any error. */
  async function resolveAuthorization(token: string): Promise<DiscordAuthorization | null> {
    const result = await fetchDiscordJson(DISCORD_OAUTH_ME, token);
    if (!result.ok) return null;
    const o = result.body as {
      application?: { id?: unknown };
      user?: { id?: unknown };
      scopes?: unknown;
    };
    const userId = o.user?.id;
    const applicationId = o.application?.id;
    if (typeof userId === 'string' && typeof applicationId === 'string') {
      return {
        userId,
        applicationId,
        scopes: Array.isArray(o.scopes)
          ? o.scopes.filter((s): s is string => typeof s === 'string')
          : [],
      };
    }
    return null;
  }

  /** Resolves the verified Discord-account email for the activation request only. This path is
   * deliberately uncached: the email is used transiently by the caller to derive an HMAC and is
   * never retained in the token identity cache. */
  async function resolveActivationIdentity(
    token: string,
    expectedClientId: string,
  ): Promise<ActivationIdentityResult> {
    const authorization = await fetchDiscordJson(DISCORD_OAUTH_ME, token);
    if (!authorization.ok) return authorization;
    const oauth = authorization.body as {
      application?: { id?: unknown };
      user?: { id?: unknown };
      scopes?: unknown;
    };
    const applicationId = oauth.application?.id;
    const oauthUserId = oauth.user?.id;
    if (typeof applicationId !== 'string' || typeof oauthUserId !== 'string') {
      return { ok: false, reason: 'invalid_token' };
    }
    if (applicationId !== expectedClientId) return { ok: false, reason: 'wrong_audience' };
    const scopes = Array.isArray(oauth.scopes)
      ? oauth.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [];
    if (!scopes.includes('identify')) return { ok: false, reason: 'invalid_token' };
    if (!scopes.includes('email')) return { ok: false, reason: 'no_email_scope' };

    const identity = await fetchDiscordJson(DISCORD_ME, token);
    if (!identity.ok) return identity;
    const user = identity.body as { id?: unknown; email?: unknown; verified?: unknown };
    if (typeof user.id !== 'string' || user.id !== oauthUserId) {
      return { ok: false, reason: 'invalid_token' };
    }
    if (typeof user.email !== 'string' || !user.email.trim()) {
      return { ok: false, reason: 'email_missing' };
    }
    if (user.verified !== true) return { ok: false, reason: 'email_unverified' };
    return { ok: true, identity: { id: user.id, email: user.email } };
  }

  return { getStatus, resolveIdentity, resolveAuthorization, resolveActivationIdentity };
}
