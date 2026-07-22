import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { bumpTalk } from '../src/store/talkStats';
import { bumpTalkUsage, getDominantTalkUsage, voiceLocale } from '../src/store/talkUsage';
import { setUserVoice } from '../src/store/userVoice';

describe('talkUsage — aggregate language/engine counters', () => {
  let db: Database.Database;
  beforeEach(() => (db = initDb(':memory:')));
  afterEach(() => db.close());

  it('extracts the locale from a voice id', () => {
    expect(voiceLocale('pt_PT-tugao-medium')).toBe('pt_PT');
    expect(voiceLocale('')).toBe('unknown');
  });

  it('returns independent most-used language and engine across exact usage rows', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    for (let i = 0; i < 4; i += 1) bumpTalk(db, 'G', 'U', now);

    // Portuguese wins 3-1; Piper also wins 3-1, independently of the pair distribution.
    bumpTalkUsage(db, 'G', 'U', 'pt_PT-a-medium', 'piper');
    bumpTalkUsage(db, 'G', 'U', 'pt_PT-a-medium', 'piper');
    bumpTalkUsage(db, 'G', 'U', 'en_US-amy-medium', 'piper');
    bumpTalkUsage(db, 'G', 'U', 'pt_PT-a-medium', 'kokoro');

    expect(getDominantTalkUsage(db, ['U']).get('U')).toEqual({
      language: 'pt_PT',
      engine: 'piper',
      samples: 4,
      source: 'measured',
    });
  });

  it('never lets inferred historical messages drown out real measurements', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    for (let i = 0; i < 5; i += 1) bumpTalk(db, 'G', 'U', now);
    setUserVoice(db, 'G', 'U', 'fr_FR-siwis-medium', 1, 'gcloud');

    // The five old talk_stats rows do not say which voice/engine was used. Even though the current
    // setting is French/Google HD, it must not contaminate the two real Portuguese/Piper samples.
    bumpTalkUsage(db, 'G', 'U', 'pt_PT-a-medium', 'piper');
    bumpTalkUsage(db, 'G', 'U', 'pt_PT-a-medium', 'piper');

    expect(getDominantTalkUsage(db, ['U']).get('U')).toEqual({
      language: 'pt_PT',
      engine: 'piper',
      samples: 2,
      source: 'measured',
    });
  });

  it('labels the effective current setting as configured until real samples exist', () => {
    bumpTalk(db, 'G', 'U', new Date('2026-07-19T12:00:00Z'));
    setUserVoice(db, 'G', 'U', 'fr_FR-siwis-medium', 1, 'gcloud');

    expect(
      getDominantTalkUsage(db, ['U'], {
        resolveConfiguredEngine: () => 'google',
      }).get('U'),
    ).toEqual({
      language: 'fr_FR',
      engine: 'google',
      samples: 0,
      source: 'configured',
    });
  });

  it('treats empty user/guild models as missing, like prepareSpeech does', () => {
    bumpTalk(db, 'G', 'U', new Date('2026-07-19T12:00:00Z'));
    db.prepare('INSERT INTO guild_config (guild_id, default_voice) VALUES (?, ?)').run('G', '');

    expect(
      getDominantTalkUsage(db, ['U'], {
        defaultModel: 'pt_PT-google-medium',
        availableModels: ['pt_PT-google-medium'],
      }).get('U'),
    ).toEqual({
      language: 'pt_PT',
      engine: 'google',
      samples: 0,
      source: 'configured',
    });
  });

  it('returns nulls for a requested user with no messages', () => {
    expect(getDominantTalkUsage(db, ['missing']).get('missing')).toEqual({
      language: null,
      engine: null,
      samples: 0,
      source: 'none',
    });
  });
});
