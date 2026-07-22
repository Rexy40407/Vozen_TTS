// src/bot/gatewayWatch.ts
//
// Observability + recovery of the Discord GATEWAY.
//
// Root cause of the recurring "Failed to load options": the bot stayed "online" but
// STOPPED receiving interactions (zombie gateway) — idle event-loop (0% CPU), no
// interaction reaching the handler, and NOTHING in the log because discord.js does not
// log shard problems unless these events are listened to. Here:
//   1. we bind the shard listeners (disconnect/reconnecting/resume/ready/error) —
//      the disconnect close CODE tells WHY (e.g. 4014 = disallowed intents);
//   2. a periodic heartbeat (WS status) — "silence" is no longer ambiguous;
//   3. a watchdog: if the gateway is NOT-Ready in a sustained way, we exit with
//      a code != 0 so the supervisor (start-prod.mjs) restarts FRESH — the most
//      reliable way to recover from a zombie session.
//
// The watchdog decision lives in a PURE function (evaluateGateway) to be testable
// without timers or a real Client.

import { type Client, Events, Status } from 'discord.js';

export interface GatewayDecision {
  healthy: boolean;
  /** Instant (ms) when it became unhealthy, or null if healthy. */
  unhealthySince: number | null;
  /** How long (ms) it has been unhealthy (0 if healthy). */
  downMs: number;
  /** true => it has been down for longer than the limit: restart. */
  shouldRestart: boolean;
}

/**
 * Pure watchdog decision. `statusReady` = the WS is Ready. Returns the new
 * `unhealthySince` (to re-inject on the next call) and whether to restart.
 */
export function evaluateGateway(
  statusReady: boolean,
  unhealthySince: number | null,
  now: number,
  maxDownMs: number,
): GatewayDecision {
  if (statusReady) {
    return { healthy: true, unhealthySince: null, downMs: 0, shouldRestart: false };
  }
  const since = unhealthySince ?? now;
  const downMs = now - since;
  return { healthy: false, unhealthySince: since, downMs, shouldRestart: downMs > maxDownMs };
}

export interface GatewayWatchDeps {
  client: Client;
  logInfo: (m: string) => void;
  logWarn: (m: string) => void;
  logError: (m: string, e?: unknown) => void;
  reportError: (e: unknown, ctx: string) => void;
  exit: () => void;
  now?: () => number;
  /** Watchdog cadence (default 60s). */
  checkMs?: number;
  /** Time NOT-Ready before restarting (default 120s). */
  maxDownMs?: number;
  /** Every how many healthy checks a heartbeat is logged (default 5 => ~5min). */
  healthyLogEvery?: number;
}

/** Binds the shard listeners + the heartbeat/watchdog. Returns a stop() (for tests). */
export function bindGatewayWatch(deps: GatewayWatchDeps): { stop: () => void } {
  const {
    client,
    logInfo,
    logWarn,
    logError,
    reportError,
    exit,
    now = () => Date.now(),
    checkMs = 60_000,
    maxDownMs = 120_000,
    healthyLogEvery = 5,
  } = deps;

  // ── Shard listeners: make the gateway VISIBLE in the log ──────────────────────
  client.on(Events.ShardDisconnect, (event, id) => {
    // event.code is the WebSocket close code — the most important clue.
    logWarn(
      `[gateway] shard ${id} desligou (código ${event?.code ?? '?'}) — o discord.js vai reconectar.`,
    );
  });
  client.on(Events.ShardReconnecting, (id) => logWarn(`[gateway] shard ${id} a reconectar…`));
  client.on(Events.ShardResume, (id, replayed) =>
    logInfo(`[gateway] shard ${id} retomado (${replayed} eventos recuperados).`),
  );
  client.on(Events.ShardReady, (id) => logInfo(`[gateway] shard ${id} pronto.`));
  client.on(Events.ShardError, (err, id) => {
    logError(`[gateway] shard ${id} error`, err);
    reportError(err, 'shardError');
  });
  client.on(Events.Warn, (m) => logWarn(`[gateway] aviso: ${m}`));

  // ── Heartbeat + watchdog ──────────────────────────────────────────────────────
  let unhealthySince: number | null = null;
  let healthyTicks = 0;
  const timer = setInterval(() => {
    const ready = client.ws.status === Status.Ready;
    const decision = evaluateGateway(ready, unhealthySince, now(), maxDownMs);
    unhealthySince = decision.unhealthySince;
    if (decision.healthy) {
      // Log the healthy heartbeat only occasionally (to avoid filling the log).
      if (healthyTicks % healthyLogEvery === 0) {
        logInfo(
          `[gateway] saudável: Ready, ping ${Math.round(client.ws.ping)}ms, ${client.guilds.cache.size} servidor(es).`,
        );
      }
      healthyTicks++;
      return;
    }
    healthyTicks = 0;
    logWarn(
      `[gateway] NÃO-Ready (status ${client.ws.status}) há ${Math.round(decision.downMs / 1000)}s.`,
    );
    if (decision.shouldRestart) {
      logError(
        '[gateway] gateway remained unavailable beyond the limit; exiting for a clean supervisor restart.',
      );
      exit();
    }
  }, checkMs);
  timer.unref?.();

  return { stop: () => clearInterval(timer) };
}
