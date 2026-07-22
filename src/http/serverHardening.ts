// src/http/serverHardening.ts
//
// Defensive timeouts shared by the bot's internal HTTP servers (Ko-fi webhook
// + premium API, top.gg webhook, health). Without these, Node's defaults are wide
// (requestTimeout 5min, headersTimeout 60s) and a slow client can hold sockets
// (slowloris). The legitimate endpoints are small and Caddy terminates the TLS in front, so
// short values are safe. A single place for all servers to use.

import type { Server } from 'node:http';

/** Timeouts (ms). headersTimeout ≤ requestTimeout; short keepAlive to free up sockets. */
export const SERVER_TIMEOUTS = {
  keepAlive: 5000,
  headers: 10000,
  request: 20000,
} as const;

/** Applies the defensive timeouts to an http.Server (call right after createServer). */
export function hardenServerTimeouts(server: Server): void {
  server.keepAliveTimeout = SERVER_TIMEOUTS.keepAlive;
  server.headersTimeout = SERVER_TIMEOUTS.headers;
  server.requestTimeout = SERVER_TIMEOUTS.request;
}
