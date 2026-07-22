// src/premium/adminApi.ts
//
// Logic layer for the Vozen admin console (plan 037). Mirrors statusApi/dashboardApi: the HTTP
// wiring lives in kofiWebhook.ts and delegates every decision here, so the security-critical
// choices are unit-tested without a socket. This is the money surface AND, because the page and
// code are public, the whole security boundary — every method fails closed.
//
// Auth model (Discord-owner only):
//   login()     — a Discord OAuth token whose identity == ownerId. Only that one account may enter;
//                 anyone else (even with the link) is refused. Mints a signed session. Same model as
//                 the /account page and the Helper panel — the owner's Discord IS the gate.
//   authorize() — verifies the SIGNED SESSION only (never a raw Discord token) and re-checks
//                 == ownerId. Every mutating route goes through this.
//   grant()/revoke() reuse the tested grantUserPremium/grantGuildPass and the adminPasses revokes.

import type Database from 'better-sqlite3';
import type { TtsEngineKind } from '../config/index';
import { grantGuildPass, grantUserPremium } from '../store/premium';
import {
  listActivePremium,
  revokeGuildPass,
  revokeUserPremium,
  type AdminPassesView,
} from '../store/adminPasses';
import { listAllUnclaimedPending, type PendingGrant } from '../store/kofiPending';
import { buildServerStats } from '../store/serverStats';
import { getGuildStreak } from '../store/guildTalkStreak';
import { getDominantTalkUsage } from '../store/talkUsage';
import { LOCALE_NAMES } from '../language/voiceMap';
import { engineLabel } from '../tts/engineLabels';
import { resolveUserEngine } from '../tts/resolveEngine';
import { signAdminSession, verifyAdminSession } from './adminAuth';
import type { DiscordAuthorization } from './statusApi';

export interface AdminApiDeps {
  db: Database.Database;
  now: () => number;
  /** Reuse statusApi.resolveAuthorization — validates a Discord token against /oauth2/@me,
   *  returning BOTH the user id and the OAuth application (client) id that minted it. */
  resolveAuthorization: (token: string) => Promise<DiscordAuthorization | null>;
  /** HMAC key for the signed session. Absent => inert. */
  adminSessionSecret?: string;
  /** Only this Discord identity may log in (reuses OWNER_ID). Absent => inert. */
  ownerId?: string;
  /** The console's own OAuth application (client) id. A login token must have been minted by
   *  THIS app; an identify token from any other application is refused. Absent => inert. */
  adminClientId?: string;
  logInfo: (m: string) => void;
  /** Session lifetime; default 8h. */
  sessionTtlSec?: number;
  /** Runtime voice fallback/catalogue, used to mirror prepareSpeech for current-state rows. */
  defaultVoice?: string;
  availableModels?: readonly string[];
  defaultEngine?: TtsEngineKind;
  /** Live snapshot of the bot's guilds (from client.guilds.cache). Absent => the servers tab is
   *  empty. Only id/name/icon/memberCount leave — the stats come from data already in the db. */
  resolveGuilds?: () => AdminGuildBrief[];
  /** Resolve Discord identities (display name + avatar URL) for the global top-talkers card.
   *  Batched; the implementation is best-effort per user (an unfetchable id yields null fields).
   *  Absent => the card renders ids only. Only id/name/avatar leave, for users already surfaced
   *  by the public /top-speakers-style aggregate. */
  resolveUsers?: (ids: string[]) => Promise<AdminUserBrief[]>;
}

/** What the bot's guild cache gives us for a server (no message content, just identity + size). */
export interface AdminGuildBrief {
  id: string;
  name: string;
  /** Full CDN URL of the server icon, or null. */
  icon: string | null;
  memberCount: number;
  /** When the bot joined this server (ms epoch), or null if the gateway didn't report it. */
  joinedTimestamp: number | null;
}

/** A server row for the admin console: identity + aggregate usage already stored (talk_stats). */
export interface AdminGuildRow extends AdminGuildBrief {
  /** Total messages Vozen has read in this server. */
  messages: number;
  /** People with at least one message read. */
  speakers: number;
  /** Top talkers (userId + count) — the same data as the public /top-speakers, per server. */
  topSpeakers: { userId: string; count: number }[];
  /** Consecutive-day server talk streak, LIVE as of now (0 if dead). Admin console only. */
  streak: number;
  /** All-time best server streak. */
  bestStreak: number;
}

/** A Discord identity for the top-talkers card: id plus optional display name and avatar URL. */
export interface AdminUserBrief {
  id: string;
  username: string | null;
  /** Full CDN avatar URL, or null. */
  avatar: string | null;
}

/** One row of the global top-talkers card: an identity + total messages read across ALL servers. */
export interface AdminTopTalker extends AdminUserBrief {
  total: number;
  /** Most-used base voice language across all counted messages/guilds. */
  language: string | null;
  /** Most-used resolved engine, already formatted for the Portuguese owner console. */
  engine: string | null;
  /** Number of real queued-message observations behind language/engine. */
  usageSamples: number;
  /** Distinguishes measured usage from the honest current-configuration fallback. */
  usageSource: 'measured' | 'configured' | 'none';
}

export type AdminGrantInput =
  | { kind: 'plus'; id: string; days: number }
  | { kind: 'premium'; id: string; days: number; seats: number };

export type AdminRevokeInput = { kind: 'plus' | 'premium'; id: string };

export interface AdminLoginOk {
  ok: true;
  token: string;
  expiresAt: number;
}
export interface AdminFail {
  ok: false;
}
export interface AdminGrantOk {
  ok: true;
  expiresAt: number;
}
export interface AdminGrantErr {
  ok: false;
  error: string;
}

export interface AdminPassesResult extends AdminPassesView {
  pending: PendingGrant[];
}

export interface AdminApi {
  /** True iff the session secret and owner id are configured; when false, EVERY method fails closed. */
  enabled: boolean;
  /** Logs in with a Discord OAuth token whose identity must equal the owner id. */
  login(discordToken: string | null): Promise<AdminLoginOk | AdminFail>;
  /** Returns the owner id iff `sessionToken` is a valid session for the owner; else null. */
  authorize(sessionToken: string | null): string | null;
  listPasses(): AdminPassesResult;
  /** The bot's servers with their aggregate usage, busiest first. Empty without resolveGuilds. */
  listGuilds(): AdminGuildRow[];
  /** The 10 users with the most messages read across ALL servers (global, not per-guild),
   *  busiest first, with resolved identity where available. */
  listTopTalkers(): Promise<AdminTopTalker[]>;
  grant(input: AdminGrantInput): AdminGrantOk | AdminGrantErr;
  revoke(input: AdminRevokeInput): { ok: boolean };
}

const SNOWFLAKE = /^\d{1,20}$/;
/** ~10 years — a generous manual grant, still bounded so a typo can't set a century. */
const MAX_DAYS = 3650;
const MAX_SEATS = 100;
/** Top talkers shown per server in the console. */
const TOP_SPEAKERS = 5;
/** Users shown in the global top-talkers card. */
const TOP_TALKERS = 10;

const validId = (id: unknown): id is string => typeof id === 'string' && SNOWFLAKE.test(id);
const validDays = (d: unknown): d is number =>
  typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= MAX_DAYS;
const validSeats = (s: unknown): s is number =>
  typeof s === 'number' && Number.isInteger(s) && s >= 1 && s <= MAX_SEATS;

export function createAdminApi(deps: AdminApiDeps): AdminApi {
  // SEC: the HMAC session secret must be strong. A short key on the money surface is forgeable,
  // so it FAILS CLOSED (was warn-and-continue): a weak secret disables the console rather than
  // arming it with weak signatures. `openssl rand -hex 32` gives 64 hex chars.
  const secretStrong =
    typeof deps.adminSessionSecret === 'string' && deps.adminSessionSecret.length >= 32;
  const enabled = Boolean(secretStrong && deps.ownerId && deps.adminClientId);
  if (deps.adminSessionSecret && !secretStrong) {
    deps.logInfo(
      '[admin] ADMIN_SESSION_SECRET is shorter than 32 chars — the admin console is DISABLED (fail-closed). Generate a strong one: `openssl rand -hex 32`.',
    );
  }
  const ttl = deps.sessionTtlSec ?? 2 * 3600; // short window; a leaked token expires fast (SEC S6)

  async function login(discordToken: string | null): Promise<AdminLoginOk | AdminFail> {
    // Destructure + guard so TS narrows the optionals to strings without non-null assertions.
    const { adminSessionSecret, ownerId, adminClientId } = deps;
    if (!adminSessionSecret || !ownerId || !adminClientId || !discordToken) return { ok: false };
    const auth = await deps.resolveAuthorization(discordToken);
    // Bind the token to BOTH the owner's account AND the console's own OAuth app. An identify
    // token that resolves to the owner but was minted by ANY OTHER application (a different app
    // the owner ever authorized, or one captured elsewhere) is refused — this closes the
    // access-token substitution path. `identify` is the lowest-friction scope, so the owner-id
    // check alone was not a real second gate.
    if (!auth || auth.userId !== ownerId || auth.applicationId !== adminClientId) {
      return { ok: false };
    }
    const now = deps.now();
    const token = signAdminSession(ownerId, adminSessionSecret, now, ttl);
    return { ok: true, token, expiresAt: (Math.floor(now / 1000) + ttl) * 1000 };
  }

  function authorize(sessionToken: string | null): string | null {
    const { adminSessionSecret, ownerId } = deps;
    if (!enabled || !adminSessionSecret || !ownerId || !sessionToken) return null;
    const uid = verifyAdminSession(sessionToken, adminSessionSecret, deps.now());
    // Re-check == ownerId even though the session is only ever minted for the owner: defense in
    // depth against a future path that mints a session for anyone.
    if (!uid || uid !== ownerId) return null;
    return uid;
  }

  function listPasses(): AdminPassesResult {
    const now = deps.now();
    return { ...listActivePremium(deps.db, now), pending: listAllUnclaimedPending(deps.db) };
  }

  function listGuilds(): AdminGuildRow[] {
    if (!deps.resolveGuilds) return [];
    const now = new Date(deps.now());
    return deps
      .resolveGuilds()
      .map((g) => {
        // Stats come ONLY from talk_stats (already stored, already public via /top-speakers) — no
        // new collection. buildServerStats is pure over the db.
        const s = buildServerStats(deps.db, g.id, now, TOP_SPEAKERS);
        const gs = getGuildStreak(deps.db, g.id, now);
        return {
          id: g.id,
          name: g.name,
          icon: g.icon,
          memberCount: g.memberCount,
          joinedTimestamp: g.joinedTimestamp,
          messages: s.totalMessages,
          speakers: s.activeSpeakers,
          topSpeakers: s.topSpeakers.map((t) => ({ userId: t.userId, count: t.count })),
          streak: gs.streak,
          bestStreak: gs.bestStreak,
        };
      })
      .sort((a, b) => b.messages - a.messages);
  }

  async function listTopTalkers(): Promise<AdminTopTalker[]> {
    // Global aggregate over talk_stats (counts already stored, already public per-server via
    // /top-speakers). Language/engine come from aggregate counters only — never message content.
    const rows = deps.db
      .prepare(
        `SELECT user_id, SUM(spoken_count) AS total FROM talk_stats
         GROUP BY user_id ORDER BY total DESC, user_id ASC LIMIT ?`,
      )
      .all(TOP_TALKERS) as { user_id: string; total: number }[];
    const dominant = getDominantTalkUsage(
      deps.db,
      rows.map((r) => r.user_id),
      {
        defaultModel: deps.defaultVoice,
        availableModels: deps.availableModels,
        resolveConfiguredEngine: (guildId, userId, storedEngine) =>
          resolveUserEngine(deps.db, guildId, userId, storedEngine, deps.now()).engine ?? 'google',
      },
    );
    const base: AdminTopTalker[] = rows.map((r) => {
      const usage = dominant.get(r.user_id);
      const locale = usage?.language ?? null;
      return {
        id: r.user_id,
        total: r.total,
        username: null,
        avatar: null,
        language: locale ? (LOCALE_NAMES[locale] ?? locale.replace('_', '-')) : null,
        engine: usage?.engine ? engineLabel(usage.engine, 'pt', deps.defaultEngine) : null,
        usageSamples: usage?.samples ?? 0,
        usageSource: usage?.source ?? 'none',
      };
    });
    if (!deps.resolveUsers || base.length === 0) return base;
    // Identity resolution is best-effort: a whole-batch failure (REST down) degrades to ids-only
    // rather than failing the card; a single unresolved user simply keeps its null fields below.
    let briefs: AdminUserBrief[];
    try {
      briefs = await deps.resolveUsers(base.map((b) => b.id));
    } catch {
      return base;
    }
    const byId = new Map(briefs.map((b) => [b.id, b]));
    return base.map((b) => {
      const info = byId.get(b.id);
      return info ? { ...b, username: info.username ?? null, avatar: info.avatar ?? null } : b;
    });
  }

  function grant(input: AdminGrantInput): AdminGrantOk | AdminGrantErr {
    if (!validId(input.id)) return { ok: false, error: 'bad_id' };
    if (!validDays(input.days)) return { ok: false, error: 'bad_days' };
    const now = deps.now();
    if (input.kind === 'plus') {
      const exp = grantUserPremium(deps.db, input.id, input.days, 'manual', now);
      deps.logInfo(`[admin] grant plus ${input.id} ${input.days}d`);
      return { ok: true, expiresAt: exp };
    }
    if (!validSeats(input.seats)) return { ok: false, error: 'bad_seats' };
    const exp = grantGuildPass(deps.db, input.id, input.seats, input.days, 'manual', now);
    deps.logInfo(`[admin] grant premium ${input.id} ${input.days}d seats=${input.seats}`);
    return { ok: true, expiresAt: exp };
  }

  function revoke(input: AdminRevokeInput): { ok: boolean } {
    // SEC-01: validate the id like grant() does — a non-snowflake never reaches the store or the
    // log line (the log is the console's only forensic record; an unvalidated id could forge lines).
    if (!validId(input.id)) return { ok: false };
    const ok =
      input.kind === 'plus'
        ? revokeUserPremium(deps.db, input.id)
        : revokeGuildPass(deps.db, input.id);
    deps.logInfo(`[admin] revoke ${input.kind} ${input.id} -> ${ok}`);
    return { ok };
  }

  return { enabled, login, authorize, listPasses, listGuilds, listTopTalkers, grant, revoke };
}
