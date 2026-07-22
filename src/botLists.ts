// Top.gg discovery integration. Opt-in: nothing starts unless TOPGG_TOKEN is configured.
//
// Preferred API (official v1): PATCH /api/v1/projects/@me/metrics.
// Legacy compatibility: POST /api/bots/{botId}/stats, used only when v1 is genuinely
// unavailable (404/405). Authentication and validation errors never fall back.

import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { log } from './logging/logger';

const TOPGG_V1_METRICS_URL = 'https://top.gg/api/v1/projects/@me/metrics';
const TOPGG_V1_COMMANDS_URL = 'https://top.gg/api/v1/projects/@me/commands';
const TOPGG_LEGACY_STATS_URL = (botId: string): string => `https://top.gg/api/bots/${botId}/stats`;

/** Interval between publications (30 min); the list does not need more frequency. */
export const BOTLIST_POST_INTERVAL_MS = 30 * 60 * 1000;
const POST_TIMEOUT_MS = 10_000;

export type TopggCommand = RESTPostAPIApplicationCommandsJSONBody;

async function topggRequest(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    log.warn('[botlist] top.gg request failed (ignored):', (err as Error).message);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Publishes the current server count. Returns false instead of throwing because a listing
 * outage must never take down the bot.
 */
export async function postTopggStats(
  botId: string,
  token: string,
  serverCount: number,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!Number.isSafeInteger(serverCount) || serverCount < 0) {
    log.warn('[botlist] refused to publish an invalid server_count.');
    return false;
  }
  const body = JSON.stringify({ server_count: serverCount });
  const v1 = await topggRequest(
    TOPGG_V1_METRICS_URL,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    },
    fetchImpl,
  );
  if (v1?.ok) {
    log.info(`[botlist] top.gg updated: ${serverCount} servers.`);
    return true;
  }
  if (!v1 || (v1.status !== 404 && v1.status !== 405)) {
    if (v1)
      log.warn(`[botlist] top.gg v1 returned HTTP ${v1.status} while publishing server_count.`);
    return false;
  }

  log.warn(`[botlist] top.gg v1 returned HTTP ${v1.status}; trying the legacy stats endpoint.`);
  const legacy = await topggRequest(
    TOPGG_LEGACY_STATS_URL(botId),
    {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body,
    },
    fetchImpl,
  );
  if (!legacy?.ok) {
    if (legacy)
      log.warn(
        `[botlist] top.gg legacy endpoint returned HTTP ${legacy.status} while publishing server_count.`,
      );
    return false;
  }
  log.info(`[botlist] top.gg updated through the legacy endpoint: ${serverCount} servers.`);
  return true;
}

/** Syncs only the caller-supplied public Discord command JSON with Top.gg v1. */
export async function syncTopggCommands(
  token: string,
  commands: readonly TopggCommand[],
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const response = await topggRequest(
    TOPGG_V1_COMMANDS_URL,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    },
    fetchImpl,
  );
  if (!response?.ok) {
    if (response)
      log.warn(`[botlist] top.gg v1 returned HTTP ${response.status} while syncing commands.`);
    return false;
  }
  log.info(`[botlist] ${commands.length} public commands synced with top.gg.`);
  return true;
}

export interface BotListDeps {
  /** Application id of the bot (= id on top.gg). */
  botId: string;
  /** Top.gg project API token. Absent/empty means the updater stays off. */
  token?: string;
  /** Returns the current server count. */
  serverCount: () => number;
  setIntervalImpl?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalImpl?: (handle: ReturnType<typeof setInterval>) => void;
  fetchImpl?: typeof fetch;
}

/** Starts an immediate and then half-hourly server-count update. */
export function startBotListUpdater(deps: BotListDeps): () => void {
  if (!deps.token) return () => {};
  const token = deps.token;
  const setIntervalImpl = deps.setIntervalImpl ?? setInterval;
  const clearIntervalImpl = deps.clearIntervalImpl ?? clearInterval;
  const post = (): void => {
    void postTopggStats(deps.botId, token, deps.serverCount(), deps.fetchImpl ?? fetch);
  };
  post();
  const handle = setIntervalImpl(post, BOTLIST_POST_INTERVAL_MS);
  (handle as unknown as { unref?: () => void }).unref?.();
  log.info('[botlist] automatic server-count publishing to top.gg is active.');
  return () => clearIntervalImpl(handle);
}
