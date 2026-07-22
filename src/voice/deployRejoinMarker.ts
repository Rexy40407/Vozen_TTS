// One-shot marker written by the deploy workflow or by a clean SIGTERM/SIGINT shutdown.
// It lets calls resume after a planned update or administrator restart, without making
// a crash silently rejoin old calls.

import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEPLOY_REJOIN_MARKER = '.vozen-rejoin-after-deploy';
const MAX_MARKER_AGE_MS = 10 * 60_000;
export type PlannedRejoinScope = 'all' | Set<string>;

/** Writes the exact calls live at a clean administrator-initiated shutdown. */
export function writePlannedRejoinMarker(
  guildIds: Iterable<string>,
  dir: string = process.cwd(),
): boolean {
  const uniqueGuildIds = [...new Set(guildIds)].filter((id) => id.length > 0);
  if (uniqueGuildIds.length === 0) return false;
  try {
    writeFileSync(join(dir, DEPLOY_REJOIN_MARKER), JSON.stringify({ guildIds: uniqueGuildIds }), {
      mode: 0o600,
    });
    return true;
  } catch {
    // Rejoining is a convenience. Never prevent a clean shutdown if disk I/O fails.
    return false;
  }
}

/**
 * Consumes a fresh deploy marker exactly once. Old markers are removed but do not
 * authorize a rejoin: a failed or abandoned deploy must not affect a later restart.
 */
export function consumePlannedRejoinMarker(
  dir: string = process.cwd(),
  now: number = Date.now(),
): PlannedRejoinScope | null {
  const marker = join(dir, DEPLOY_REJOIN_MARKER);
  try {
    if (!existsSync(marker)) return null;
    const age = now - statSync(marker).mtimeMs;
    const fresh = age >= 0 && age <= MAX_MARKER_AGE_MS;
    const raw = readFileSync(marker, 'utf8').trim();
    rmSync(marker, { force: true });
    if (!fresh) return null;
    // The deploy workflow's `touch` is an all-calls fallback. A clean bot shutdown
    // overwrites it with the exact calls that were live at the time of the signal.
    if (!raw) return 'all';
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { guildIds?: unknown }).guildIds)
    ) {
      return null;
    }
    const guildIds = (parsed as { guildIds: unknown[] }).guildIds;
    if (!guildIds.every((id) => typeof id === 'string' && id.length > 0)) return null;
    return new Set(guildIds as string[]);
  } catch {
    // A marker is only an availability convenience. Never block bot startup for it.
    return null;
  }
}

/** Backwards-compatible helper for callers that only need to know whether a marker exists. */
export function consumeDeployRejoinMarker(
  dir: string = process.cwd(),
  now: number = Date.now(),
): boolean {
  return consumePlannedRejoinMarker(dir, now) !== null;
}
