import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config/index';

const REQUIRED = {
  DISCORD_TOKEN: 'tok-123',
  CLIENT_ID: 'client-123',
};

function setEnv(env: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('loadConfig', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    setEnv({
      DISCORD_TOKEN: undefined,
      CLIENT_ID: undefined,
      PIPER_PATH: undefined,
      MODELS_DIR: undefined,
      DB_PATH: undefined,
      DEFAULT_VOICE: undefined,
      DEFAULT_SPEED: undefined,
      QUEUE_CAP: undefined,
      MAX_CHARS: undefined,
      RATE_PER_MIN: undefined,
      TTS_ENGINE: undefined,
      OPENAI_API_KEY: undefined,
      PRESENCE_TEXT: undefined,
      HEALTH_PORT: undefined,
      TOPGG_WEBHOOK_PORT: undefined,
      TOPGG_WEBHOOK_SECRET: undefined,
      VOTE_REDEMPTION_SECRET: undefined,
      GTTS_CHUNK_CONCURRENCY: undefined,
      BOT_SHARDS: undefined,
      MULTILINGUAL_SEGMENTS: undefined,
      NOISE_SCALE: undefined,
      NOISE_W: undefined,
      SENTENCE_SILENCE: undefined,
      // we also clear the discord.js reserved env so the regression test
      // starts from a known state (only one test sets it on purpose).
      SHARDS: undefined,
      PREMIUM_API_ORIGIN: undefined,
      PREMIUM_API_ENABLED: undefined,
    });
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('throws when DISCORD_TOKEN is missing', () => {
    setEnv({ ...REQUIRED, DISCORD_TOKEN: undefined });
    expect(() => loadConfig()).toThrow(/DISCORD_TOKEN/);
  });

  it('throws when CLIENT_ID is missing', () => {
    setEnv({ ...REQUIRED, CLIENT_ID: undefined });
    expect(() => loadConfig()).toThrow(/CLIENT_ID/);
  });

  it('returns required fields when present', () => {
    setEnv(REQUIRED);
    const cfg = loadConfig();
    expect(cfg.token).toBe('tok-123');
    expect(cfg.clientId).toBe('client-123');
  });

  it('GTTS_CHUNK_CONCURRENCY: default 3; "5" -> 5; invalid/0 -> fallback 3', () => {
    setEnv(REQUIRED); // absent => default 3
    expect(loadConfig().gttsChunkConcurrency).toBe(3);
    setEnv({ ...REQUIRED, GTTS_CHUNK_CONCURRENCY: '5' });
    expect(loadConfig().gttsChunkConcurrency).toBe(5);
    for (const bad of ['0', 'abc', '-1']) {
      setEnv({ ...REQUIRED, GTTS_CHUNK_CONCURRENCY: bad });
      expect(loadConfig().gttsChunkConcurrency, `valor=${bad}`).toBe(3); // numEnvPositive falls back
    }
  });

  it('SEC-02: premiumApiOrigin default points to the current site (vozen.org)', () => {
    setEnv(REQUIRED); // absent => default
    expect(loadConfig().premiumApiOrigin).toBe('https://vozen.org');
    // an explicit override still wins (production sets it in .env)
    setEnv({ ...REQUIRED, PREMIUM_API_ORIGIN: 'https://exemplo.test' });
    expect(loadConfig().premiumApiOrigin).toBe('https://exemplo.test');
  });

  it('applies string defaults when optionals missing', () => {
    setEnv(REQUIRED);
    const cfg = loadConfig();
    expect(cfg.piperPath).toBe('piper');
    expect(cfg.modelsDir).toBe('./models');
    expect(cfg.dbPath).toBe('./tts.db');
    expect(cfg.defaultVoice).toBe('en_US-amy-medium');
  });

  it('applies numeric defaults when optionals missing', () => {
    setEnv(REQUIRED);
    const cfg = loadConfig();
    expect(cfg.defaultSpeed).toBe(1);
    expect(cfg.messageLeadMs).toBe(200); // 0.20s of silence before speaking
    expect(cfg.queueCap).toBe(20);
    expect(cfg.maxChars).toBe(300);
    expect(cfg.ratePerMin).toBe(8);
  });

  it('parses numeric env overrides', () => {
    setEnv({
      ...REQUIRED,
      DEFAULT_SPEED: '1.5',
      QUEUE_CAP: '10',
      MAX_CHARS: '500',
      RATE_PER_MIN: '3',
    });
    const cfg = loadConfig();
    expect(cfg.defaultSpeed).toBe(1.5);
    expect(cfg.queueCap).toBe(10);
    expect(cfg.maxChars).toBe(500);
    expect(cfg.ratePerMin).toBe(3);
  });

  it('falls back to default when numeric env is not a number', () => {
    setEnv({ ...REQUIRED, MAX_CHARS: 'abc' });
    const cfg = loadConfig();
    expect(cfg.maxChars).toBe(300);
  });

  it('uses string overrides', () => {
    setEnv({ ...REQUIRED, DEFAULT_VOICE: 'pt_PT-tugão-medium' });
    const cfg = loadConfig();
    expect(cfg.defaultVoice).toBe('pt_PT-tugão-medium');
  });

  // P7.3 — regional DEFAULT_VOICE: a locale value (pt_PT, pt_BR, de_DE...)
  // is accepted as-is via env, without touching the code's factory default.
  // (The beforeEach clears DEFAULT_VOICE between tests, so the "factory
  //  default" is proven by the 'applies string defaults' test above.)
  it('accepts a regional DEFAULT_VOICE via env (pt_BR)', () => {
    setEnv({ ...REQUIRED, DEFAULT_VOICE: 'pt_BR-faber-medium' });
    expect(loadConfig().defaultVoice).toBe('pt_BR-faber-medium');
  });

  it('the factory default for DEFAULT_VOICE stays en_US-amy-medium (non-regional)', () => {
    setEnv(REQUIRED);
    expect(loadConfig().defaultVoice).toBe('en_US-amy-medium');
  });

  it('defaults ttsEngine to piper and leaves openaiApiKey undefined', () => {
    setEnv(REQUIRED);
    const cfg = loadConfig();
    expect(cfg.ttsEngine).toBe('piper');
    expect(cfg.openaiApiKey).toBeUndefined();
  });

  it('reads TTS_ENGINE=neural and OPENAI_API_KEY', () => {
    setEnv({ ...REQUIRED, TTS_ENGINE: 'neural', OPENAI_API_KEY: 'sk-abc' });
    const cfg = loadConfig();
    expect(cfg.ttsEngine).toBe('neural');
    expect(cfg.openaiApiKey).toBe('sk-abc');
  });

  it('falls back to piper on invalid TTS_ENGINE', () => {
    setEnv({ ...REQUIRED, TTS_ENGINE: 'bogus' });
    const cfg = loadConfig();
    expect(cfg.ttsEngine).toBe('piper');
  });

  // P9.3 — optional PRESENCE_TEXT: absent/empty => undefined (buildPresence uses
  // its own brand default); present => exact override passed to buildPresence.
  it('leaves presenceText undefined when PRESENCE_TEXT missing', () => {
    setEnv(REQUIRED);
    expect(loadConfig().presenceText).toBeUndefined();
  });

  it('reads PRESENCE_TEXT override from env', () => {
    setEnv({ ...REQUIRED, PRESENCE_TEXT: 'type it, hear it. • /invite' });
    expect(loadConfig().presenceText).toBe('type it, hear it. • /invite');
  });

  // P9.7 — optional HEALTH_PORT: absent/empty => undefined (no server);
  // set => number. An invalid value falls back to undefined (defensive).
  it('leaves healthPort undefined when HEALTH_PORT missing', () => {
    setEnv(REQUIRED);
    expect(loadConfig().healthPort).toBeUndefined();
  });

  it('parses HEALTH_PORT as a number when set', () => {
    setEnv({ ...REQUIRED, HEALTH_PORT: '8080' });
    expect(loadConfig().healthPort).toBe(8080);
  });

  it('leaves healthPort undefined on invalid HEALTH_PORT', () => {
    setEnv({ ...REQUIRED, HEALTH_PORT: 'abc' });
    expect(loadConfig().healthPort).toBeUndefined();
  });

  // P11.5 — optional TOPGG_WEBHOOK_PORT: absent/empty => undefined (no webhook
  // server); set => number; invalid => undefined (defensive, same as
  // HEALTH_PORT). Optional TOPGG_WEBHOOK_SECRET: absent/empty => undefined.
  it('leaves topggWebhookPort/Secret undefined when env missing', () => {
    setEnv(REQUIRED);
    const cfg = loadConfig();
    expect(cfg.topggWebhookPort).toBeUndefined();
    expect(cfg.topggWebhookSecret).toBeUndefined();
  });

  it('parses TOPGG_WEBHOOK_PORT as a number when set', () => {
    setEnv({ ...REQUIRED, TOPGG_WEBHOOK_PORT: '8081' });
    expect(loadConfig().topggWebhookPort).toBe(8081);
  });

  it('leaves topggWebhookPort undefined on invalid TOPGG_WEBHOOK_PORT', () => {
    setEnv({ ...REQUIRED, TOPGG_WEBHOOK_PORT: 'abc' });
    expect(loadConfig().topggWebhookPort).toBeUndefined();
  });

  it('reads TOPGG_WEBHOOK_SECRET from env', () => {
    setEnv({
      ...REQUIRED,
      TOPGG_WEBHOOK_SECRET: 's3cr3t',
      VOTE_REDEMPTION_SECRET: '0123456789abcdef0123456789abcdef',
    });
    const cfg = loadConfig();
    expect(cfg.topggWebhookSecret).toBe('s3cr3t');
    expect(cfg.voteRedemptionSecret).toBe('0123456789abcdef0123456789abcdef');
  });

  it('refuses to start a vote endpoint with a missing lifetime-ledger secret', () => {
    setEnv({ ...REQUIRED, TOPGG_WEBHOOK_SECRET: 's3cr3t' });
    expect(() => loadConfig()).toThrow(/invalid security configuration/i);
  });

  // P11.4 — optional BOT_SHARDS: absent/empty => undefined (single-process
  // default); present => RAW string passed to resolveShardCount in the launcher. The
  // config only carries the value; the interpretation (auto/N/single) lives in
  // src/sharding.ts. NB: the env is BOT_SHARDS, NOT `SHARDS` — the latter collides with
  // a reserved env read by the discord.js Client and would break `npm start`.
  it('leaves shards undefined when BOT_SHARDS missing', () => {
    setEnv(REQUIRED);
    expect(loadConfig().shards).toBeUndefined();
  });

  it('leaves shards undefined when BOT_SHARDS is empty', () => {
    setEnv({ ...REQUIRED, BOT_SHARDS: '' });
    expect(loadConfig().shards).toBeUndefined();
  });

  it('reads BOT_SHARDS raw value from env', () => {
    setEnv({ ...REQUIRED, BOT_SHARDS: 'auto' });
    expect(loadConfig().shards).toBe('auto');
  });

  it('reads numeric BOT_SHARDS as the raw string', () => {
    setEnv({ ...REQUIRED, BOT_SHARDS: '4' });
    expect(loadConfig().shards).toBe('4');
  });

  // P11.4 (regression) — the discord.js reserved env `SHARDS` must NOT influence
  // config.shards. If a user sets SHARDS by mistake, our opt-in
  // (BOT_SHARDS) still wins — and it stays undefined, i.e. single-process.
  it('ignores the reserved SHARDS env (only BOT_SHARDS controls sharding)', () => {
    setEnv({ ...REQUIRED, SHARDS: 'auto', BOT_SHARDS: undefined });
    expect(loadConfig().shards).toBeUndefined();
  });

  // MULTILINGUAL_SEGMENTS — per-segment multilingual synthesis. It is now ON
  // by default: without the env (or with an "empty"/non-'false' value), it is true —
  // Vozen mixes voices per language just like a real person. The env can FORCE a
  // GLOBAL shutdown with the exact value 'false' (case-insensitive). Only 'false'
  // disables; anything else (absent, empty, 'true', typo) stays ON.
  it('multilingualSegments defaults to TRUE when MULTILINGUAL_SEGMENTS missing', () => {
    setEnv(REQUIRED);
    expect(loadConfig().multilingualSegments).toBe(true);
  });

  it('multilingualSegments TRUE when MULTILINGUAL_SEGMENTS empty', () => {
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: '' });
    expect(loadConfig().multilingualSegments).toBe(true);
  });

  it('reads MULTILINGUAL_SEGMENTS=true as true', () => {
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: 'true' });
    expect(loadConfig().multilingualSegments).toBe(true);
  });

  it('MULTILINGUAL_SEGMENTS=false forces it OFF (global kill-switch)', () => {
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: 'false' });
    expect(loadConfig().multilingualSegments).toBe(false);
  });

  it('MULTILINGUAL_SEGMENTS=false is case-insensitive (FALSE / False -> off)', () => {
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: 'FALSE' });
    expect(loadConfig().multilingualSegments).toBe(false);
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: 'False' });
    expect(loadConfig().multilingualSegments).toBe(false);
  });

  it('MULTILINGUAL_SEGMENTS with a non-false value (e.g. "1"/"yes") stays ON (only "false" disables)', () => {
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: '1' });
    expect(loadConfig().multilingualSegments).toBe(true);
    setEnv({ ...REQUIRED, MULTILINGUAL_SEGMENTS: 'yes' });
    expect(loadConfig().multilingualSegments).toBe(true);
  });

  // Piper quality params (noiseScale/noiseW/sentenceSilence). Defaults =
  // ORGANIC preset (0.75 / 0.95 / 0.4) chosen in A/B by the operator: more
  // natural sound. Optional numeric env (numEnv: invalid/absent => fallback to default).
  it('applies organic synth-quality defaults when env missing (0.75 / 0.95 / 0.4)', () => {
    setEnv(REQUIRED);
    const cfg = loadConfig();
    expect(cfg.noiseScale).toBe(0.75);
    expect(cfg.noiseW).toBe(0.95);
    expect(cfg.sentenceSilence).toBe(0.4);
  });

  it('parses NOISE_SCALE / NOISE_W / SENTENCE_SILENCE overrides from env', () => {
    // Env still wins over the organic default (values != the defaults
    // to prove unambiguously that the override wins).
    setEnv({ ...REQUIRED, NOISE_SCALE: '0.5', NOISE_W: '0.9', SENTENCE_SILENCE: '0.3' });
    const cfg = loadConfig();
    expect(cfg.noiseScale).toBe(0.5);
    expect(cfg.noiseW).toBe(0.9);
    expect(cfg.sentenceSilence).toBe(0.3);
  });

  it('falls back to organic defaults when synth-quality env is not a number', () => {
    setEnv({ ...REQUIRED, NOISE_SCALE: 'abc', NOISE_W: '', SENTENCE_SILENCE: 'xyz' });
    const cfg = loadConfig();
    expect(cfg.noiseScale).toBe(0.75);
    expect(cfg.noiseW).toBe(0.95);
    expect(cfg.sentenceSilence).toBe(0.4);
  });
});
