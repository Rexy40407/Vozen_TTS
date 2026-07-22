/**
 * P11.4 — SHARDING launcher (opt-in). It is NOT the default entrypoint.
 *
 * The usual entrypoint remains `src/index.ts` (a single process). This file is an
 * ALTERNATIVE startup, reachable via `npm run start:sharded`
 * (= `node dist/shard.js`), intended to scale near ~1000+ guilds, where Discord
 * requires multiple gateway shards (≈1 shard / 1000 guilds).
 *
 * Decision (delegated to resolveShardCount, from config.shards / env
 * BOT_SHARDS — NOT `SHARDS`, which is reserved by discord.js; see src/config):
 *   - WITHOUT sharding (null): runs the bot single-process DIRECTLY, with a
 *     LAZY `require('./index')` — so `start:sharded` works even without
 *     BOT_SHARDS set, without forcing anyone to switch scripts.
 *   - WITH sharding ('auto' | N): creates a ShardingManager that spawns N
 *     child processes, each running `index.js` (the SAME usual entrypoint).
 *
 * CRITICAL INVARIANT (avoids infinite spawn): the ShardingManager is only built
 * HERE. `index.ts` never builds a manager — the children run index.js and
 * connect to Discord as normal bots. That is why `require('./index')` can only
 * happen in the single-process branch, and the ShardingManager points at index.js, NOT
 * at this file.
 */
import path from 'node:path';
import { ShardingManager } from 'discord.js';
import { loadConfig } from './config/index';
import { log } from './logging/logger';
import { resolveShardCount } from './sharding';

/**
 * Actual startup. Separated from the `require.main` guard so tests can
 * import this module without triggering login/spawn (import-safe module).
 */
export function runShardLauncher(): void {
  const config = loadConfig();
  const totalShards = resolveShardCount(config.shards);

  if (totalShards === null) {
    // WITHOUT sharding: runs the bot single-process. LAZY require — importing
    // ./index at the top would execute main() (Discord login) always, including in
    // the sharding branch, which we do NOT want.
    log.info('[shard] BOT_SHARDS is unset or disabled; running as a single process.');
    require('./index');
    return;
  }

  // WITH sharding. The target is index.js (each child's entrypoint), resolved from
  // __dirname to be robust to the cwd: at runtime this file lives in
  // dist/, so __dirname/index.js => dist/index.js regardless of where the
  // process was launched. The token is required for totalShards:'auto' (the manager
  // asks Discord for the recommended count).
  const file = path.join(__dirname, 'index.js');
  const manager = new ShardingManager(file, {
    token: config.token,
    totalShards,
  });

  manager.on('shardCreate', (shard) => {
    log.info(`[shard] shard #${shard.id} launched.`);
  });

  log.info(`[shard] sharding active (totalShards=${totalShards}); spawning...`);
  manager.spawn().catch((err) => {
    log.error('[shard] failed to spawn shards', err);
    process.exit(1);
  });
}

// Only starts when executed directly (`node dist/shard.js`). A test that
// imports this module does NOT trigger startup.
if (require.main === module) {
  runShardLauncher();
}
