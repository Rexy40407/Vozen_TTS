import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

// Minimal mock of @discordjs/voice — not used in /voice set|reset, but the import
// from index.ts resolves it (same pattern as commandsVoiceList.test.ts).
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { getUserVoice } from '../src/store/userVoice';
import { engineLabel } from '../src/tts/engineLabels';
import { grantUserPremium, grantGuildPremium } from '../src/store/premium';
import type Database from 'better-sqlite3';

const GUILD = 'g-vset';
const USER = 'u-vset';

function makeDeps(db: Database.Database): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map<string, unknown>(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: '' },
    availableModels: ['en_US-amy-medium', 'pt_PT-tugao-medium'],
    limiters: new Map(),
  } as unknown as BotDeps;
}

function makeVoiceInteraction(opts: {
  sub: string;
  model?: string;
  speed?: number | null;
  engine?: 'google' | 'piper' | 'kokoro' | 'gcloud';
}) {
  const replies: string[] = [];
  return {
    commandName: 'voice',
    guildId: GUILD,
    user: { id: USER },
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content: string }) => {
      replies.push(messageText(o));
    },
    options: {
      getSubcommandGroup: (_required = false) => null,
      getSubcommand: () => opts.sub,
      // name-aware: 'engine' returns the engine option; any other ('model') the model.
      getString: (name: string, _required = false) =>
        name === 'engine' ? (opts.engine ?? null) : (opts.model ?? null),
      getNumber: (_name: string) => (opts.speed === undefined ? null : opts.speed),
    },
  };
}

describe('/voice set — beginner-friendly copy', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('confirms with the voice FRIENDLY NAME and keeps the raw copy-pasteable id', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium' });
    await handleInteraction(i as any, makeDeps(db));

    expect(i.replies).toHaveLength(1);
    const out = i.replies[0];
    // Friendly name (language + voice) instead of the raw id as the title.
    expect(out).toContain('English (US) — Amy');
    // The raw id remains present (copy-pasteable to reuse / share).
    expect(out).toContain('en_US-amy-medium');
    // Behavior unchanged: the voice was actually saved.
    expect(getUserVoice(db, GUILD, USER)?.model).toBe('en_US-amy-medium');
  });

  it('includes the NEXT STEP for the beginner to hear the voice (via /tts)', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'pt_PT-tugao-medium' });
    await handleInteraction(i as any, makeDeps(db));

    const out = i.replies[0];
    // Points to /tts (always works, without depending on auto-read being configured).
    expect(out).toContain('/tts');
  });

  it('no engine -> stores the legacy `google` value and calls it the DEFAULT, not "Google"', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium' });
    await handleInteraction(i as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('google');
    // The stored id stays 'google' for DB compatibility, but it means "the operator's
    // configured default" (local Piper unless changed) — so the reply must not claim
    // Google TTS. Same label the /voice config panel shows: one source of truth.
    expect(i.replies[0]).toContain(engineLabel('google', 'en'));
    expect(i.replies[0]).not.toContain('engine: **Google**');
  });

  it('engine:piper -> saves piper and confirms', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'piper' });
    await handleInteraction(i as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('piper');
    expect(i.replies[0]).toContain('Piper');
  });

  it('changing only the voice PRESERVES the previously chosen engine (does not reset to google)', async () => {
    // 1) choose Piper.
    await handleInteraction(
      makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'piper' }) as any,
      makeDeps(db),
    );
    // 2) change only the voice (no engine) -> stays Piper.
    await handleInteraction(
      makeVoiceInteraction({ sub: 'set', model: 'pt_PT-tugao-medium' }) as any,
      makeDeps(db),
    );
    expect(getUserVoice(db, GUILD, USER)?.model).toBe('pt_PT-tugao-medium');
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('piper');
  });
});

// Gap closed (P: friendly errors): the `speed` builder has NO min/max, so Discord does
// NOT reject a value outside 0.5–2.0 client-side. Before, the handler did a silent clamp
// (5.0 -> 2.0) and replied "success" at 2× — a silent surprise. The beginner should get a
// friendly error with the allowed range and NOTHING is saved (not clamp-with-warning:
// rejection). Boundaries 0.5 and 2.0 remain valid.
// Premium gate for the Google HD engine (gcloud): only those with Vozen Plus (user) or
// Vozen Premium (server) may CHOOSE it. Without Premium -> locked message + NOTHING saved
// (the voice doesn't get stuck on a paid engine). Same pattern as the premium effects.
describe('/voice set — Google HD engine gate (gcloud)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('gcloud WITHOUT Premium -> locked message and does NOT save the voice', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'gcloud' });
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies).toHaveLength(1);
    expect(i.replies[0]).toContain('Google HD');
    expect(i.replies[0]).toMatch(/🔒|Premium/);
    // Nothing saved: the paid choice was refused.
    expect(getUserVoice(db, GUILD, USER)).toBeNull();
  });

  it('gcloud WITH Vozen Plus (user) -> saves gcloud and confirms "Google HD"', async () => {
    grantUserPremium(db, USER, 30, 'test', Date.now());
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'gcloud' });
    await handleInteraction(i as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('gcloud');
    expect(i.replies[0]).toContain('Google HD');
  });

  it('gcloud WITH server Premium (guild) -> saves gcloud', async () => {
    grantGuildPremium(db, GUILD, 30, 'test', Date.now());
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'gcloud' });
    await handleInteraction(i as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('gcloud');
  });
});

describe('/voice set — Kokoro Premium gate', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('Kokoro WITHOUT Premium -> locked message and does NOT save the voice', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'kokoro' });
    await handleInteraction(i as any, makeDeps(db));
    expect(i.replies[0]).toContain('Kokoro');
    expect(i.replies[0]).toMatch(/Premium/);
    expect(getUserVoice(db, GUILD, USER)).toBeNull();
  });

  it('Kokoro WITH Vozen Plus -> saves Kokoro', async () => {
    grantUserPremium(db, USER, 30, 'test', Date.now());
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'kokoro' });
    await handleInteraction(i as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('kokoro');
  });

  it('Kokoro WITH server Premium -> saves Kokoro', async () => {
    grantGuildPremium(db, GUILD, 30, 'test', Date.now());
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', engine: 'kokoro' });
    await handleInteraction(i as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.engine).toBe('kokoro');
  });
});

describe('/voice set — speed out of range (0.5–2.0)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('speed above 2.0 replies error with the range and does NOT save the voice', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', speed: 5 });
    await handleInteraction(i as any, makeDeps(db));

    expect(i.replies).toHaveLength(1);
    const out = i.replies[0];
    // Friendly message indicates the allowed range.
    expect(out).toContain('0.5');
    expect(out).toContain('2.0');
    // No invalid state saved (not clamp-with-warning: rejection).
    expect(getUserVoice(db, GUILD, USER)).toBeNull();
  });

  it('speed below 0.5 replies error and does NOT save the voice', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', speed: 0.1 });
    await handleInteraction(i as any, makeDeps(db));

    expect(i.replies).toHaveLength(1);
    expect(getUserVoice(db, GUILD, USER)).toBeNull();
  });

  it('boundaries 0.5 and 2.0 remain valid (save the voice)', async () => {
    const lo = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', speed: 0.5 });
    await handleInteraction(lo as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.speed).toBe(0.5);

    const hi = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', speed: 2.0 });
    await handleInteraction(hi as any, makeDeps(db));
    expect(getUserVoice(db, GUILD, USER)?.speed).toBe(2.0);
  });

  it('no speed (omitted) saves with the defaultSpeed — valid path unchanged', async () => {
    const i = makeVoiceInteraction({ sub: 'set', model: 'en_US-amy-medium', speed: null });
    await handleInteraction(i as any, makeDeps(db));

    expect(getUserVoice(db, GUILD, USER)?.speed).toBe(1.0);
  });
});

describe('/voice reset — beginner-friendly copy', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('confirms the reset and points to /voice set / /voice list to choose another', async () => {
    const i = makeVoiceInteraction({ sub: 'reset' });
    await handleInteraction(i as any, makeDeps(db));

    expect(i.replies).toHaveLength(1);
    const out = i.replies[0];
    expect(out).toContain('/voice set');
    expect(out).toContain('/voice list');
  });
});
