import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands';
import { initDb } from '../src/store/db';
import type Database from 'better-sqlite3';
import type { BotDeps } from '../src/bot/deps';

const GUILD = 'g-file';
const USER = 'u-file';
let fixtureDir = '';
let audioPath = '';

function makeDeps(db: Database.Database, synth: ReturnType<typeof vi.fn>): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, users: { cache: new Map() } },
    players: new Map(),
    db,
    engine: { synth },
    config: { defaultSpeed: 1, defaultVoice: 'en_US-amy-medium' },
    availableModels: ['en_US-amy-medium'],
    limiters: new Map(),
  } as unknown as BotDeps;
}

function interaction(text: string, guildId: string | null = GUILD) {
  const edits: unknown[] = [];
  return {
    commandName: 'tts-file',
    guildId,
    user: { id: USER },
    locale: 'en-US',
    replied: false,
    deferred: false,
    isRepliable: () => true,
    deferReply: async function (this: { deferred: boolean }) {
      this.deferred = true;
    },
    editReply: async (payload: unknown) => {
      edits.push(payload);
    },
    edits,
    options: {
      getString: (name: string) => (name === 'text' ? text : null),
      getNumber: () => null,
    },
  };
}

describe('/tts-file', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = initDb(':memory:');
    fixtureDir = await mkdtemp(join(tmpdir(), 'vozen-tts-file-test-'));
    audioPath = join(fixtureDir, 'cached.wav');
    await writeFile(audioPath, 'not real audio');
  });
  afterEach(async () => {
    db.close();
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('does not need a voice player, sends a private temporary copy and cleans it after delivery', async () => {
    const synth = vi.fn(async () => audioPath);
    const i = interaction('Hello export');
    await handleInteraction(i as any, makeDeps(db, synth));

    expect(synth).toHaveBeenCalledOnce();
    const delivered = i.edits.find(
      (value) => typeof value === 'object' && value && 'files' in value,
    ) as {
      files: Array<{ attachment: string }>;
    };
    expect(delivered.files[0]!.attachment).not.toBe(audioPath);
    expect(existsSync(delivered.files[0]!.attachment)).toBe(false);
  });

  it('denies excessive input before the provider is called', async () => {
    const synth = vi.fn(async () => audioPath);
    await handleInteraction(interaction('a'.repeat(501)) as any, makeDeps(db, synth));
    expect(synth).not.toHaveBeenCalled();
  });

  it('works as a private User App command without reading guild state', async () => {
    const synth = vi.fn(async () => audioPath);
    const i = interaction('Private DM export', null);
    await handleInteraction(i as any, makeDeps(db, synth));

    expect(synth).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Private DM export', effect: undefined }),
    );
    expect(JSON.stringify(i.edits)).toContain('vozen-audio.wav');
  });
});
