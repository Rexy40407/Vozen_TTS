import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { getGuildConfig, setGuildConfig } from '../src/store/guildConfig';

// Toggle admin do soundboard (/config soundboard). Campo guild_config `soundboard`,
// LIGADO por defeito; um admin pode desligar o /sound no servidor.
const G = '111111111111111111';

describe('guild_config.soundboard — toggle do soundboard', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('LIGADO por defeito', () => {
    expect(getGuildConfig(db, G).soundboard).toBe(true);
  });

  it('desliga e persiste', () => {
    setGuildConfig(db, G, { soundboard: false });
    expect(getGuildConfig(db, G).soundboard).toBe(false);
  });

  it('volta a ligar', () => {
    setGuildConfig(db, G, { soundboard: false });
    setGuildConfig(db, G, { soundboard: true });
    expect(getGuildConfig(db, G).soundboard).toBe(true);
  });
});
