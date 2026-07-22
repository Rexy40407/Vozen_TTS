/**
 * P11.4 — Opt-in SHARDING scaffold.
 *
 * `resolveShardCount` is a PURE and deterministic function: it translates the raw value of
 * the `BOT_SHARDS` env into the startup decision, without side effects. It is the single
 * point of truth about "is there sharding or not", so that the launcher (src/shard.ts) and
 * the tests share exactly the same logic.
 *
 * (The env is called BOT_SHARDS and NOT `SHARDS`: the latter is reserved and read directly
 * by the discord.js Client — see the note in src/config/index.ts.)
 *
 * Golden rule: the single-process path (historical default) is the safe one, so EVERYTHING
 * that is not unambiguously a request for sharding falls to `null`.
 *
 *   - null    => NO sharding. Runs a single process (the usual behavior). Happens for
 *                absent / empty / "1" / "0" / invalid.
 *   - 'auto'  => let the ShardingManager ask Discord for the recommended count
 *                (≈1 shard / 1000 guilds).
 *   - N (>=2) => fixed shard count.
 *
 * Robustness notes (mirror `engineEnv` in config):
 *   - Trims before interpreting (tolerates spaces from the env/.env).
 *   - Uses `Number(...)` + `Number.isInteger`, NOT `parseInt`: "2abc" must fall to null, and
 *     `parseInt("2abc")` would return 2 (silently wrong).
 */
export function resolveShardCount(raw: string | undefined): number | 'auto' | null {
  if (raw === undefined) return null;
  const value = raw.trim();
  if (value === '') return null;
  if (value.toLowerCase() === 'auto') return 'auto';
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2) return null;
  return n;
}
