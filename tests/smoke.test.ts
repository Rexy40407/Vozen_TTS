// tests/smoke.test.ts
//
// P10.4 — SMOKE / BOOT TEST WITHOUT A TOKEN.
//
// Replicates the startup sequence of src/index.ts (main()) UP TO immediately
// BEFORE `client.login` — without EVER connecting to Discord or doing any network.
// The goal is to catch early an assembly problem in the real deps (config -> db ->
// engine -> presence -> command builders) that today would only show up in a live
// verification (with real token/Piper/network). The test IS the deliverable: if the
// assembly blows up, this is exactly what it is meant to catch.
//
// What we deliberately DO NOT do (would touch sockets/token):
//   - We do NOT import ../src/index (the module's bottom runs main() -> client.login
//     -> network, and process.exit(1) on failure would kill vitest). We assemble from
//     the individual modules.
//   - We do NOT call createClient/bindEvents/installSignalHandlers/startHealthServer/
//     startVoteWebhookServer or registerCommands (rest.put = network).
//   - We do NOT call engine.synth (Piper spawn) — we only assert the contract exists.
//
// Hermetic: minimal env defined here (restores process.env at the end, like config.test.ts).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadConfig } from '../src/config/index';
import { initDb } from '../src/store/db';
import { AudioCache } from '../src/tts/cache';
import { createEngine, selectEngine } from '../src/tts/factory';
import { buildPresence } from '../src/bot/presence';
import { commandDefs } from '../src/commands/index';
import { MultiSegmentEngine } from '../src/tts/multiSegment';
import type Database from 'better-sqlite3';

// Local replica of the 3 lines of discoverModels (private in index.ts, not exported —
// we do not refactor index.ts just to expose it, that would be scope creep). Empty dir => [].
function discoverModels(modelsDir: string): string[] {
  if (!existsSync(modelsDir)) return [];
  return readdirSync(modelsDir)
    .filter((f) => f.endsWith('.onnx'))
    .map((f) => path.basename(f, '.onnx'))
    .sort();
}

// Minimal env for a valid, hermetic 'piper' (default) boot. We clear the optionals
// so as not to inherit a .env/ambient env (e.g. TTS_ENGINE=neural without a key would
// make createEngine throw) — same rationale as config.test.ts.
function setSmokeEnv(modelsDir: string): void {
  const env: Record<string, string | undefined> = {
    DISCORD_TOKEN: 'x',
    CLIENT_ID: '123',
    PIPER_PATH: 'piper-dummy',
    MODELS_DIR: modelsDir,
    DB_PATH: ':memory:',
    // optionals cleared -> boot on the default path (piper, no extra servers)
    TTS_ENGINE: undefined,
    OPENAI_API_KEY: undefined,
    MULTILINGUAL_SEGMENTS: undefined,
    PRESENCE_TEXT: undefined,
    HEALTH_PORT: undefined,
    TOPGG_WEBHOOK_PORT: undefined,
    TOPGG_WEBHOOK_SECRET: undefined,
    BOT_SHARDS: undefined,
    SHARDS: undefined,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('smoke: boot without a token (assembles real deps without connecting to Discord)', () => {
  const saved = { ...process.env };
  let cacheDir: string;
  let modelsDir: string;
  let db: Database.Database | undefined;

  beforeEach(() => {
    // Hermetic cache dir via mkdtemp: we do NOT replicate main()'s join(dirname(dbPath),
    // 'audio-cache') because with DB_PATH=':memory:' it gave './audio-cache' at the
    // repo root. modelsDir is an EMPTY temp -> discoverModels returns [].
    cacheDir = mkdtempSync(path.join(tmpdir(), 'smoke-cache-'));
    modelsDir = mkdtempSync(path.join(tmpdir(), 'smoke-models-'));
    setSmokeEnv(modelsDir);
  });

  afterEach(() => {
    try {
      db?.close();
    } catch {
      // ignore
    }
    db = undefined;
    rmSync(cacheDir, { recursive: true, force: true });
    rmSync(modelsDir, { recursive: true, force: true });
    process.env = { ...saved };
  });

  it('assembles config -> db -> engine -> presence -> command builders without throwing', () => {
    // The entire assembly runs inside expect(...).not.toThrow so that ANY
    // startup blow-up is the test's failure mode (what it is meant to catch).
    expect(() => {
      // 1) config (loadConfig requires real DISCORD_TOKEN + CLIENT_ID in the env)
      const config = loadConfig();
      expect(config.token).toBe('x');
      expect(config.clientId).toBe('123');
      expect(config.ttsEngine).toBe('piper');

      // 2) in-memory db (same call as main(), without touching the disk)
      db = initDb(':memory:');
      expect(db.open).toBe(true);
      // trivial query: the initial schema was applied (table exists)
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guild_config'")
        .get() as { name?: string } | undefined;
      expect(row?.name).toBe('guild_config');

      // 3) cache + model discovery (empty temp dir -> [])
      const cache = new AudioCache(cacheDir);
      const availableModels = discoverModels(config.modelsDir);
      expect(Array.isArray(availableModels)).toBe(true);
      expect(availableModels).toEqual([]);

      // 4) real TTS engine (piper) + selectEngine (flag ON by default -> wraps
      // the base in a MultiSegmentEngine, which mixes voices per language)
      const baseEngine = createEngine(config, cache);
      const engine = selectEngine(baseEngine, config, availableModels, cache);
      expect(typeof engine.synth).toBe('function');
      // multilingualSegments ON by default -> selectEngine wraps the base
      expect(config.multilingualSegments).toBe(true);
      expect(engine).toBeInstanceOf(MultiSegmentEngine);

      // 5) presence (pure function) -> has activities
      const presence = buildPresence(config);
      expect(presence.activities?.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('the command builders build (commandDefs non-empty, valid .toJSON)', () => {
    // Importing commandDefs already runs the SlashCommandBuilders + .toJSON() at
    // module load; if any builder were invalid, that import would have thrown.
    // Here we confirm the basic artifact exists and has the expected shape, without
    // registering anything with the Discord API (registerCommands does rest.put = network).
    expect(commandDefs.length).toBeGreaterThan(0);
    for (const def of commandDefs) {
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);
      // Slash commands (type absent/1) have a description; context-menu ones (USER=2,
      // MESSAGE=3) do NOT — the description is forbidden on those. We accept both.
      const isContextMenu = def.type === 2 || def.type === 3;
      // `description` only exists on the slash branch of the union; TS does not narrow by
      // def.type, so we access it structurally (the context-menu one does not have it).
      const description = (def as { description?: string }).description;
      if (isContextMenu) {
        expect(description ?? '').toBe('');
      } else {
        expect(typeof description).toBe('string');
      }
    }
  });

  // Bug-hunt 2026-07: guild-dependent commands (voice/config/store) must NOT be
  // invocable in DMs (there guildId is null -> SqliteError guild_id NOT NULL / misleading
  // responses). The text-only commands (invite/vote/help/uptime/bot-stats) STAY
  // available in DMs. InteractionContextType.Guild === 0.
  // Regression (duplicates seen in Discord): UNIQUE command names in the set.
  // NB: the real duplicate was global+per-guild (double registration), but this test
  // ensures commandDefs itself never introduces two commands with the same name.
  it('there are no commands with duplicate names', () => {
    const names = commandDefs.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('registers explicit contexts for guild commands, DMs and reviewed User Apps', () => {
    const USER_APP = new Set([
      'invite',
      'vote',
      'help',
      'uptime',
      'bot-stats',
      'tts-file',
      'translate',
      'Translate',
      'Transcribe voice message',
    ]);
    for (const def of commandDefs) {
      const contexts = (def as { contexts?: number[] }).contexts;
      if (USER_APP.has(def.name)) {
        expect(contexts).toEqual([0, 1, 2]);
        expect(def.integration_types).toEqual([0, 1]);
      } else if (def.name === 'redeem') {
        expect(contexts).toEqual([0, 1]);
        expect(def.integration_types).toEqual([0]);
      } else {
        expect(contexts).toEqual([0]);
        expect(def.integration_types).toEqual([0]);
      }
    }
  });
});
