import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { getUserVoice, setUserVoice, resetUserVoice } from '../src/store/userVoice';
import {
  getGuildConfig,
  setGuildConfig,
  resetGuildConfig,
  GUILD_CONFIG_COLUMNS,
} from '../src/store/guildConfig';
import { getBlocklist, addBlockword, removeBlockword } from '../src/store/blocklist';
import { rememberKofiSupporter, lookupKofiSupporter } from '../src/store/premium';
import {
  getUserPronunciations,
  addUserPronunciation,
  getServerPronunciations,
  addServerPronunciation,
  removeServerPronunciation,
  SERVER_PRON_LIMIT,
} from '../src/store/pronunciation';
import { isOptedOut, setOptOut, setOptIn } from '../src/store/optout';
import { getNickname, setNickname, clearNickname } from '../src/store/nickname';
import { getVoiceEffect, setVoiceEffect, clearVoiceEffect } from '../src/store/voiceEffect';

const G = 'guild-1';
const U = 'user-1';

describe('store', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('userVoice', () => {
    it('returns null when no voice is set', () => {
      expect(getUserVoice(db, G, U)).toBeNull();
    });

    it('sets and gets a user voice (engine default google)', () => {
      setUserVoice(db, G, U, 'pt_PT-tugão-medium', 1.2);
      expect(getUserVoice(db, G, U)).toEqual({
        model: 'pt_PT-tugão-medium',
        speed: 1.2,
        engine: 'google',
      });
    });

    it('overwrites an existing voice (upsert)', () => {
      setUserVoice(db, G, U, 'a', 1);
      setUserVoice(db, G, U, 'b', 1.5);
      expect(getUserVoice(db, G, U)).toEqual({ model: 'b', speed: 1.5, engine: 'google' });
    });

    it('stores and reads the piper engine', () => {
      setUserVoice(db, G, U, 'a', 1, 'piper');
      expect(getUserVoice(db, G, U)?.engine).toBe('piper');
      // Saving again with 'google' switches the engine.
      setUserVoice(db, G, U, 'a', 1, 'google');
      expect(getUserVoice(db, G, U)?.engine).toBe('google');
    });

    it('isolates voices per guild', () => {
      setUserVoice(db, G, U, 'a', 1);
      expect(getUserVoice(db, 'guild-2', U)).toBeNull();
    });

    it('resets a user voice back to null', () => {
      setUserVoice(db, G, U, 'a', 1);
      resetUserVoice(db, G, U);
      expect(getUserVoice(db, G, U)).toBeNull();
    });
  });

  describe('guildConfig', () => {
    it('returns defaults when guild has no row', () => {
      expect(getGuildConfig(db, G)).toEqual({
        ttsChannelId: null,
        autoread: false,
        defaultVoice: '', // empty = guild did not set a default voice
        maxChars: 300,
        ratePerMin: 8,
        enabled: true,
        ttsRoleId: null,
        locale: 'en', // default: English as the interface language
        xsaid: true, // announce who spoke ON by default
        autojoin: false, // join the call on its own OFF by default
        readBots: false, // do NOT read other bots by default
        textInVoice: false, // do NOT read text-in-voice chat by default
        greetOnJoin: true, // greet whoever joins the call ON by default
        greetLocale: 'en', // English as the greeting language by default
        antispam: false, // spam filter OFF by default
        stayInCall: false, // 24/7 in-call OFF by default
        streakAnnounce: true, // streak 🔥 announcement ON by default
        soundboard: true, // /sound ON by default
        votePromos: false, // alternating Top.gg/support reminders OFF by default; admins opt in
        priorityRoleId: null,
        blockedRoleId: null,
        translationEnabled: false,
        translationDailyCharLimit: 10000,
        translationPerUserDailyCharLimit: 2000,
      });
    });

    it('ttsRoleId defaults to null', () => {
      expect(getGuildConfig(db, G).ttsRoleId).toBeNull();
    });

    it('persists and reads ttsRoleId', () => {
      setGuildConfig(db, G, { ttsRoleId: 'role-42' });
      expect(getGuildConfig(db, G).ttsRoleId).toBe('role-42');
    });

    it('can clear ttsRoleId back to null', () => {
      setGuildConfig(db, G, { ttsRoleId: 'role-42' });
      setGuildConfig(db, G, { ttsRoleId: null });
      expect(getGuildConfig(db, G).ttsRoleId).toBeNull();
    });

    it('a ttsRoleId patch does not lose other fields', () => {
      setGuildConfig(db, G, { maxChars: 500, autoread: true });
      setGuildConfig(db, G, { ttsRoleId: 'role-7' });
      const cfg = getGuildConfig(db, G);
      expect(cfg.ttsRoleId).toBe('role-7');
      expect(cfg.maxChars).toBe(500);
      expect(cfg.autoread).toBe(true);
    });

    it('persists a partial patch and keeps other defaults', () => {
      setGuildConfig(db, G, { ttsChannelId: 'chan-1', autoread: true });
      expect(getGuildConfig(db, G)).toEqual({
        ttsChannelId: 'chan-1',
        autoread: true,
        defaultVoice: '', // empty = guild did not set a default voice
        maxChars: 300,
        ratePerMin: 8,
        enabled: true,
        ttsRoleId: null,
        locale: 'en', // default: English as the interface language
        xsaid: true, // announce who spoke ON by default
        autojoin: false, // join the call on its own OFF by default
        readBots: false, // do NOT read other bots by default
        textInVoice: false, // do NOT read text-in-voice chat by default
        greetOnJoin: true, // greet whoever joins the call ON by default
        greetLocale: 'en', // English as the greeting language by default
        antispam: false, // spam filter OFF by default
        stayInCall: false, // 24/7 in-call OFF by default
        streakAnnounce: true, // streak 🔥 announcement ON by default
        soundboard: true, // /sound ON by default
        votePromos: false, // alternating Top.gg/support reminders OFF by default; admins opt in
        priorityRoleId: null,
        blockedRoleId: null,
        translationEnabled: false,
        translationDailyCharLimit: 10000,
        translationPerUserDailyCharLimit: 2000,
      });
    });

    it('locale defaults to "en"', () => {
      expect(getGuildConfig(db, G).locale).toBe('en');
    });

    it('persists and reads locale (pt)', () => {
      setGuildConfig(db, G, { locale: 'pt' });
      expect(getGuildConfig(db, G).locale).toBe('pt');
    });

    it('a locale patch does not lose other fields', () => {
      setGuildConfig(db, G, { maxChars: 500, autoread: true });
      setGuildConfig(db, G, { locale: 'pt' });
      const cfg = getGuildConfig(db, G);
      expect(cfg.locale).toBe('pt');
      expect(cfg.maxChars).toBe(500);
      expect(cfg.autoread).toBe(true);
    });

    it('merges successive patches without losing earlier values', () => {
      setGuildConfig(db, G, { maxChars: 500 });
      setGuildConfig(db, G, { enabled: false });
      const cfg = getGuildConfig(db, G);
      expect(cfg.maxChars).toBe(500);
      expect(cfg.enabled).toBe(false);
    });

    it('round-trips boolean and null fields correctly', () => {
      setGuildConfig(db, G, { autoread: false, enabled: true, ttsChannelId: null });
      const cfg = getGuildConfig(db, G);
      expect(cfg.autoread).toBe(false);
      expect(cfg.enabled).toBe(true);
      expect(cfg.ttsChannelId).toBeNull();
    });

    it('can clear ttsChannelId back to null', () => {
      setGuildConfig(db, G, { ttsChannelId: 'chan-1' });
      setGuildConfig(db, G, { ttsChannelId: null });
      expect(getGuildConfig(db, G).ttsChannelId).toBeNull();
    });

    // ── Descriptor ↔ rest parity (plan 014): these tests blow up if someone
    // adds/removes a field without syncing the 5 sources of truth.
    it('descriptor: props match the GuildConfig keys, with no duplicate columns', () => {
      // getGuildConfig(absent) returns the DEFAULTS object -> its keys are the
      // exact set of GuildConfig props.
      const configKeys = Object.keys(getGuildConfig(db, 'no-such-guild')).sort();
      const descriptorProps = GUILD_CONFIG_COLUMNS.map((c) => c.prop).sort();
      expect(descriptorProps).toEqual(configKeys);
      const columns = GUILD_CONFIG_COLUMNS.map((c) => c.column);
      expect(new Set(columns).size).toBe(columns.length); // no repeated columns
    });

    it('descriptor: columns match the CREATE TABLE (table_info)', () => {
      const info = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
      const actual = new Set(info.map((c) => c.name));
      const expected = new Set(['guild_id', ...GUILD_CONFIG_COLUMNS.map((c) => c.column)]);
      expect(actual).toEqual(expected);
    });

    it('descriptor: each column DEFAULT matches the CREATE TABLE (dflt_value) — catches drift', () => {
      // The names test above does not see the DEFAULTs; rate_per_min once diverged
      // (db.ts=8 vs descriptor=5). Comparing the defaults closes that gap.
      const info = db.pragma('table_info(guild_config)') as Array<{
        name: string;
        dflt_value: string | number | null;
      }>;
      const byName = new Map(info.map((c) => [c.name, c.dflt_value]));
      const declaredDefault = (sqlType: string): string | null => {
        const m = sqlType.match(/DEFAULT\s+(.+?)\s*$/i);
        return m ? m[1].trim() : null;
      };
      for (const col of GUILD_CONFIG_COLUMNS) {
        const actual = byName.get(col.column);
        const normalized = actual == null ? null : String(actual);
        expect(normalized).toBe(declaredDefault(col.sqlType));
      }
    });

    it('round-trip of ALL fields with non-default values', () => {
      const full = {
        ttsChannelId: 'c1',
        autoread: true,
        defaultVoice: 'pt_PT-x',
        maxChars: 999,
        ratePerMin: 42,
        enabled: false,
        ttsRoleId: 'r1',
        locale: 'pt',
        xsaid: false,
        autojoin: true,
        readBots: true,
        textInVoice: true,
        greetOnJoin: false,
        greetLocale: 'pt',
        antispam: true,
        stayInCall: true,
        streakAnnounce: false,
        soundboard: false,
        votePromos: true,
        priorityRoleId: 'priority-role',
        blockedRoleId: 'blocked-role',
        translationEnabled: true,
        translationDailyCharLimit: 20000,
        translationPerUserDailyCharLimit: 3000,
      };
      setGuildConfig(db, G, full);
      expect(getGuildConfig(db, G)).toEqual(full);
    });

    it('migrates an old DB (only the 8 original columns) — backfill of the new defaults', () => {
      const dir = mkdtempSync(join(tmpdir(), 'voxi-mig-'));
      const path = join(dir, 'old.db');
      // DB in the pre-locale format: guild_id … tts_role_id (the 8 originals), without the 7 new ones.
      const raw = new BetterSqlite3(path);
      raw.exec(`
        CREATE TABLE guild_config (
          guild_id       TEXT PRIMARY KEY,
          tts_channel_id TEXT,
          autoread       INTEGER NOT NULL DEFAULT 0,
          default_voice  TEXT NOT NULL DEFAULT 'en_US-amy-medium',
          max_chars      INTEGER NOT NULL DEFAULT 300,
          rate_per_min   INTEGER NOT NULL DEFAULT 5,
          enabled        INTEGER NOT NULL DEFAULT 1,
          tts_role_id    TEXT
        );
      `);
      raw
        .prepare(
          `INSERT INTO guild_config
             (guild_id, tts_channel_id, autoread, default_voice, max_chars, rate_per_min, enabled, tts_role_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('old-g', 'chan-old', 1, 'pt_PT-x', 777, 9, 0, 'role-old');
      raw.close();

      const migrated = initDb(path);
      try {
        // Old values preserved; new columns = defaults (backfill via ADD COLUMN).
        expect(getGuildConfig(migrated, 'old-g')).toEqual({
          ttsChannelId: 'chan-old',
          autoread: true,
          defaultVoice: 'pt_PT-x',
          maxChars: 777,
          ratePerMin: 9,
          enabled: false,
          ttsRoleId: 'role-old',
          locale: 'en',
          xsaid: true,
          autojoin: false,
          readBots: false,
          textInVoice: false,
          greetOnJoin: true,
          greetLocale: 'en',
          antispam: false,
          stayInCall: false,
          streakAnnounce: true,
          soundboard: true,
          votePromos: false,
          priorityRoleId: null,
          blockedRoleId: null,
          translationEnabled: false,
          translationDailyCharLimit: 10000,
          translationPerUserDailyCharLimit: 2000,
        });
        // All descriptor columns now exist after the migration.
        const info = migrated.pragma('table_info(guild_config)') as Array<{ name: string }>;
        const names = new Set(info.map((c) => c.name));
        for (const col of GUILD_CONFIG_COLUMNS) expect(names.has(col.column)).toBe(true);
        expect(names.has('guild_id')).toBe(true);
      } finally {
        migrated.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('migrates the removed Piper pt_PT (tugao) voice -> pt_PT-google-medium (user_voice + guild default)', () => {
      const dir = mkdtempSync(join(tmpdir(), 'voxi-ptpt-'));
      const path = join(dir, 'ptpt.db');
      const raw = new BetterSqlite3(path);
      raw.exec(`
        CREATE TABLE user_voice (
          guild_id    TEXT NOT NULL,
          user_id     TEXT NOT NULL,
          voice_model TEXT NOT NULL,
          speed       REAL NOT NULL,
          engine      TEXT NOT NULL DEFAULT 'google',
          PRIMARY KEY (guild_id, user_id)
        );
        CREATE TABLE guild_config (
          guild_id      TEXT PRIMARY KEY,
          default_voice TEXT NOT NULL DEFAULT 'en_US-amy-medium'
        );
      `);
      raw
        .prepare(
          'INSERT INTO user_voice (guild_id, user_id, voice_model, speed, engine) VALUES (?, ?, ?, ?, ?)',
        )
        .run('g', 'u', 'pt_PT-tugao-medium', 1, 'piper');
      raw
        .prepare('INSERT INTO guild_config (guild_id, default_voice) VALUES (?, ?)')
        .run('g2', 'pt_PT-tugao-medium');
      raw.close();

      const migrated = initDb(path);
      try {
        // The Piper pt_PT voice was removed from the options; saved prefs migrate to the
        // Google pt-PT voice (same language, default engine). Idempotent (no-op afterward).
        expect(getUserVoice(migrated, 'g', 'u')?.model).toBe('pt_PT-google-medium');
        expect(getGuildConfig(migrated, 'g2').defaultVoice).toBe('pt_PT-google-medium');
      } finally {
        migrated.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('blocklist', () => {
    it('returns empty array when nothing is blocked', () => {
      expect(getBlocklist(db, G)).toEqual([]);
    });

    it('adds and gets a word', () => {
      addBlockword(db, G, 'badword');
      expect(getBlocklist(db, G)).toEqual(['badword']);
    });

    it('is idempotent when adding the same word twice', () => {
      addBlockword(db, G, 'dup');
      addBlockword(db, G, 'dup');
      expect(getBlocklist(db, G)).toEqual(['dup']);
    });

    it('removes a word', () => {
      addBlockword(db, G, 'a');
      addBlockword(db, G, 'b');
      removeBlockword(db, G, 'a');
      expect(getBlocklist(db, G)).toEqual(['b']);
    });

    it('isolates blocklists per guild', () => {
      addBlockword(db, G, 'a');
      expect(getBlocklist(db, 'guild-2')).toEqual([]);
    });

    it('adds and gets accented words (salázar, café)', () => {
      addBlockword(db, G, 'salázar');
      addBlockword(db, G, 'café');
      const list = getBlocklist(db, G);
      expect(list).toContain('salázar');
      expect(list).toContain('café');
    });

    it('removes an accented word correctly', () => {
      addBlockword(db, G, 'café');
      addBlockword(db, G, 'salázar');
      removeBlockword(db, G, 'café');
      const list = getBlocklist(db, G);
      expect(list).not.toContain('café');
      expect(list).toContain('salázar');
    });

    it('case-sensitive handling: "Café" and "café" are distinct entries (no COLLATE NOCASE)', () => {
      // The schema does not declare COLLATE NOCASE, so the upper/lower-case distinction
      // is preserved — "Café" and "café" coexist as separate entries.
      addBlockword(db, G, 'café');
      addBlockword(db, G, 'Café');
      const list = getBlocklist(db, G);
      expect(list).toContain('café');
      expect(list).toContain('Café');
      expect(list.length).toBe(2);
    });
  });

  describe('server pronunciation (/server-pronunciation, cap 3)', () => {
    it('adds, sorts by term, and isolates per guild', () => {
      expect(getServerPronunciations(db, G)).toEqual([]);
      expect(addServerPronunciation(db, G, 'zz', 'ultimo', SERVER_PRON_LIMIT)).toBe('ok');
      expect(addServerPronunciation(db, G, 'aa', 'primeiro', SERVER_PRON_LIMIT)).toBe('ok');
      expect(getServerPronunciations(db, G)).toEqual([
        { term: 'aa', replacement: 'primeiro' },
        { term: 'zz', replacement: 'ultimo' },
      ]);
      expect(getServerPronunciations(db, 'guild-2')).toEqual([]);
    });

    it('re-adding edits (upsert) and does not count toward the cap', () => {
      addServerPronunciation(db, G, 'gg', 'good game', SERVER_PRON_LIMIT);
      addServerPronunciation(db, G, 'gg', 'gigi', SERVER_PRON_LIMIT);
      expect(getServerPronunciations(db, G)).toEqual([{ term: 'gg', replacement: 'gigi' }]);
    });

    it('cap 3: accepts 3, blocks the 4th', () => {
      for (let n = 1; n <= SERVER_PRON_LIMIT; n++) {
        expect(addServerPronunciation(db, G, `t${n}`, 'r', SERVER_PRON_LIMIT)).toBe('ok');
      }
      expect(addServerPronunciation(db, G, 'extra', 'x', SERVER_PRON_LIMIT)).toBe('limit');
      expect(getServerPronunciations(db, G)).toHaveLength(SERVER_PRON_LIMIT);
    });

    it('remove: true when it existed, false when it did not', () => {
      addServerPronunciation(db, G, 'gg', 'good game', SERVER_PRON_LIMIT);
      expect(removeServerPronunciation(db, G, 'gg')).toBe(true);
      expect(removeServerPronunciation(db, G, 'gg')).toBe(false);
      expect(getServerPronunciations(db, G)).toHaveLength(0);
    });
  });

  describe('optout', () => {
    it('isOptedOut is false when nothing was set', () => {
      expect(isOptedOut(db, G, U)).toBe(false);
    });

    it('setOptOut marks the user and isOptedOut becomes true', () => {
      setOptOut(db, G, U);
      expect(isOptedOut(db, G, U)).toBe(true);
    });

    it('setOptOut is idempotent (marking twice does not blow up)', () => {
      setOptOut(db, G, U);
      setOptOut(db, G, U);
      expect(isOptedOut(db, G, U)).toBe(true);
    });

    it('setOptIn clears the opt-out and isOptedOut goes back to false', () => {
      setOptOut(db, G, U);
      setOptIn(db, G, U);
      expect(isOptedOut(db, G, U)).toBe(false);
    });

    it('isolates the opt-out per guild', () => {
      setOptOut(db, G, U);
      expect(isOptedOut(db, 'guild-2', U)).toBe(false);
    });

    it('isolates the opt-out per user', () => {
      setOptOut(db, G, U);
      expect(isOptedOut(db, G, 'user-2')).toBe(false);
    });
  });

  describe('guildConfig — successive patches', () => {
    it('three successive patches do not lose earlier fields', () => {
      setGuildConfig(db, G, { ttsChannelId: 'chan-1' });
      setGuildConfig(db, G, { maxChars: 500, ratePerMin: 10 });
      setGuildConfig(db, G, { enabled: false });
      const cfg = getGuildConfig(db, G);
      expect(cfg.ttsChannelId).toBe('chan-1'); // from the 1st patch
      expect(cfg.maxChars).toBe(500); // from the 2nd patch
      expect(cfg.ratePerMin).toBe(10); // from the 2nd patch
      expect(cfg.enabled).toBe(false); // from the 3rd patch
      expect(cfg.defaultVoice).toBe(''); // empty = guild did not set a default voice
    });

    it('a patch that replaces defaultVoice does not lose other fields', () => {
      setGuildConfig(db, G, { autoread: true, maxChars: 400 });
      setGuildConfig(db, G, { defaultVoice: 'pt_PT-tugão-medium' });
      const cfg = getGuildConfig(db, G);
      expect(cfg.autoread).toBe(true);
      expect(cfg.maxChars).toBe(400);
      expect(cfg.defaultVoice).toBe('pt_PT-tugão-medium');
    });
  });

  describe('nickname (xsaid)', () => {
    it('no nickname -> null', () => {
      expect(getNickname(db, G, 'u1')).toBeNull();
    });

    it('persists, overwrites and clears', () => {
      setNickname(db, G, 'u1', 'Zé');
      expect(getNickname(db, G, 'u1')).toBe('Zé');
      setNickname(db, G, 'u1', 'Zezinho');
      expect(getNickname(db, G, 'u1')).toBe('Zezinho');
      clearNickname(db, G, 'u1');
      expect(getNickname(db, G, 'u1')).toBeNull();
    });

    it('is per-(guild,user)', () => {
      setNickname(db, G, 'u1', 'A');
      expect(getNickname(db, 'outra-guild', 'u1')).toBeNull();
      expect(getNickname(db, G, 'u2')).toBeNull();
    });
  });

  describe('voiceEffect', () => {
    it('no effect -> none; persists, overwrites and clears', () => {
      expect(getVoiceEffect(db, G, 'u1')).toBe('none');
      setVoiceEffect(db, G, 'u1', 'robot');
      expect(getVoiceEffect(db, G, 'u1')).toBe('robot');
      setVoiceEffect(db, G, 'u1', 'deep');
      expect(getVoiceEffect(db, G, 'u1')).toBe('deep');
      setVoiceEffect(db, G, 'u1', 'none'); // deletes the row
      expect(getVoiceEffect(db, G, 'u1')).toBe('none');
    });

    it('is per-(guild,user)', () => {
      setVoiceEffect(db, G, 'u1', 'echo');
      expect(getVoiceEffect(db, 'outra', 'u1')).toBe('none');
      expect(getVoiceEffect(db, G, 'u2')).toBe('none');
    });
  });
});

describe('initDb — open error', () => {
  it('throws with a clear message when the path is invalid', () => {
    // better-sqlite3 does NOT create intermediate directories: a path whose parent
    // does not exist fails reliably (portable, unlike permission-denied).
    const bad = join(tmpdir(), `nope-${Date.now()}-${Math.random().toString(36).slice(2)}`, 'x.db');
    expect(() => initDb(bad)).toThrow(/Failed to open the database/);
    // The message includes the path for diagnostics.
    expect(() => initDb(bad)).toThrow(bad);
  });

  it('throws with a clear message when the file is not a valid DB', () => {
    // An existing file that is not SQLite: new Database() passes (lazy validation)
    // and the error only surfaces in db.exec ("file is not a database"). The widened
    // try turns that into the same clear message instead of a raw stack trace.
    const dir = mkdtempSync(join(tmpdir(), 'baddb-'));
    const file = join(dir, 'not-a-db.sqlite');
    writeFileSync(file, 'isto nao e uma base de dados sqlite, e texto qualquer\n');
    try {
      expect(() => initDb(file)).toThrow(/Failed to open the database/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('initDb — tts_role_id migration on an old-schema DB', () => {
  it('adds the tts_role_id column to a DB without it and the get returns null', () => {
    // initDb opens by path, so the migration has to be tested on a real file
    // (not :memory:). We create a DB with the OLD schema (without tts_role_id),
    // insert a row, close it; then run initDb and confirm the column.
    const dir = mkdtempSync(join(tmpdir(), 'migdb-'));
    const file = join(dir, 'old-schema.sqlite');
    try {
      const old = new BetterSqlite3(file);
      old.exec(`
        CREATE TABLE guild_config (
          guild_id       TEXT PRIMARY KEY,
          tts_channel_id TEXT,
          autoread       INTEGER NOT NULL DEFAULT 0,
          default_voice  TEXT NOT NULL DEFAULT 'en_US-amy-medium',
          max_chars      INTEGER NOT NULL DEFAULT 300,
          rate_per_min   INTEGER NOT NULL DEFAULT 5,
          enabled        INTEGER NOT NULL DEFAULT 1
        );
      `);
      old
        .prepare(
          `INSERT INTO guild_config (guild_id, tts_channel_id, autoread, default_voice, max_chars, rate_per_min, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('g-old', 'chan-old', 1, 'en_US-amy-medium', 300, 5, 1);
      old.close();

      // Before the migration the column does not exist.
      const before = new BetterSqlite3(file);
      const colsBefore = before.pragma('table_info(guild_config)') as Array<{ name: string }>;
      expect(colsBefore.some((c) => c.name === 'tts_role_id')).toBe(false);
      before.close();

      // initDb runs the idempotent migration.
      const db = initDb(file);
      const colsAfter = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
      expect(colsAfter.some((c) => c.name === 'tts_role_id')).toBe(true);

      // The old row is still there and ttsRoleId comes back as null (new column, no value).
      expect(getGuildConfig(db, 'g-old').ttsRoleId).toBeNull();
      expect(getGuildConfig(db, 'g-old').ttsChannelId).toBe('chan-old');

      // Idempotent: running initDb again on the same file does not blow up.
      db.close();
      const db2 = initDb(file);
      const cols2 = db2.pragma('table_info(guild_config)') as Array<{ name: string }>;
      expect(cols2.filter((c) => c.name === 'tts_role_id')).toHaveLength(1);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('initDb — drops the removed user_clone table (biometric purge)', () => {
  const hasUserClone = (db: Database.Database): boolean =>
    (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_clone'")
        .all() as unknown[]
    ).length > 0;

  it('DROPs a pre-existing user_clone table on init (voice-clone feature removed)', () => {
    // An old production DB may still carry the user_clone table (the removed voice-clone
    // feature). initDb must DROP it so the stored biometric consent records are purged.
    const dir = mkdtempSync(join(tmpdir(), 'dropclone-'));
    const file = join(dir, 'old-clone.sqlite');
    try {
      const old = new BetterSqlite3(file);
      old.exec(`
        CREATE TABLE user_clone (
          user_id     TEXT PRIMARY KEY,
          sample_path TEXT NOT NULL,
          consent_at  INTEGER NOT NULL,
          enabled     INTEGER NOT NULL DEFAULT 0
        );
      `);
      old
        .prepare(
          'INSERT INTO user_clone (user_id, sample_path, consent_at, enabled) VALUES (?, ?, ?, ?)',
        )
        .run('u-old', '/x/u-old.wav', 111, 1);
      expect(hasUserClone(old)).toBe(true);
      old.close();

      // initDb runs the idempotent DROP TABLE migration -> the table is gone.
      const db = initDb(file);
      expect(hasUserClone(db)).toBe(false);

      // Idempotent: running again on a DB that no longer has the table does not blow up.
      db.close();
      const db2 = initDb(file);
      expect(hasUserClone(db2)).toBe(false);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('initDb — locale migration on an old-schema DB', () => {
  it('adds the locale column to a DB without it and the get returns "en"', () => {
    // Same pattern as the tts_role_id test: DB with the OLD schema (without locale),
    // a row inserted, closed; then initDb runs the idempotent migration and
    // the old rows now read locale='en' (not null).
    const dir = mkdtempSync(join(tmpdir(), 'migloc-'));
    const file = join(dir, 'old-schema.sqlite');
    try {
      const old = new BetterSqlite3(file);
      old.exec(`
        CREATE TABLE guild_config (
          guild_id       TEXT PRIMARY KEY,
          tts_channel_id TEXT,
          autoread       INTEGER NOT NULL DEFAULT 0,
          default_voice  TEXT NOT NULL DEFAULT 'en_US-amy-medium',
          max_chars      INTEGER NOT NULL DEFAULT 300,
          rate_per_min   INTEGER NOT NULL DEFAULT 5,
          enabled        INTEGER NOT NULL DEFAULT 1,
          tts_role_id    TEXT
        );
      `);
      old
        .prepare(
          `INSERT INTO guild_config (guild_id, tts_channel_id, autoread, default_voice, max_chars, rate_per_min, enabled, tts_role_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('g-old', 'chan-old', 1, 'en_US-amy-medium', 300, 5, 1, null);
      old.close();

      // Before the migration the column does not exist.
      const before = new BetterSqlite3(file);
      const colsBefore = before.pragma('table_info(guild_config)') as Array<{ name: string }>;
      expect(colsBefore.some((c) => c.name === 'locale')).toBe(false);
      before.close();

      // initDb runs the idempotent migration.
      const db = initDb(file);
      const colsAfter = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
      expect(colsAfter.some((c) => c.name === 'locale')).toBe(true);

      // The old row is still there and locale comes back as 'en' (the new column's default).
      expect(getGuildConfig(db, 'g-old').locale).toBe('en');
      expect(getGuildConfig(db, 'g-old').ttsChannelId).toBe('chan-old');

      // Idempotent: running initDb again on the same file does not blow up.
      db.close();
      const db2 = initDb(file);
      const cols2 = db2.pragma('table_info(guild_config)') as Array<{ name: string }>;
      expect(cols2.filter((c) => c.name === 'locale')).toHaveLength(1);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── cache write-through (plan 010) ──────────────────────────────────────────
describe('store — cache write-through', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  // The strongest proof: every setter must make the NEXT get return the new value.
  // If invalidation were missing, the get would serve the old cached value and these would fail.
  it('every setter invalidates — the next get reflects the write', () => {
    // guild_config
    getGuildConfig(db, G);
    setGuildConfig(db, G, { maxChars: 111 });
    expect(getGuildConfig(db, G).maxChars).toBe(111);
    resetGuildConfig(db, G);
    expect(getGuildConfig(db, G).maxChars).toBe(300); // default

    // blocklist
    getBlocklist(db, G);
    addBlockword(db, G, 'spam');
    expect(getBlocklist(db, G)).toContain('spam');
    removeBlockword(db, G, 'spam');
    expect(getBlocklist(db, G)).not.toContain('spam');

    // PERSONAL pronunciation (the guild one was removed in the v4 plan)
    getUserPronunciations(db, U);
    addUserPronunciation(db, U, 'gg', 'good game', 3);
    expect(getUserPronunciations(db, U)).toEqual([{ term: 'gg', replacement: 'good game' }]);

    // user_voice
    getUserVoice(db, G, U);
    setUserVoice(db, G, U, 'en_US-amy-medium', 1);
    expect(getUserVoice(db, G, U)?.model).toBe('en_US-amy-medium');
    resetUserVoice(db, G, U);
    expect(getUserVoice(db, G, U)).toBeNull();

    // nickname
    getNickname(db, G, U);
    setNickname(db, G, U, 'Zé');
    expect(getNickname(db, G, U)).toBe('Zé');
    clearNickname(db, G, U);
    expect(getNickname(db, G, U)).toBeNull();

    // optout
    isOptedOut(db, G, U);
    setOptOut(db, G, U);
    expect(isOptedOut(db, G, U)).toBe(true);
    setOptIn(db, G, U);
    expect(isOptedOut(db, G, U)).toBe(false);

    // voice effect
    getVoiceEffect(db, G, U);
    setVoiceEffect(db, G, U, 'robot');
    expect(getVoiceEffect(db, G, U)).toBe('robot');
    clearVoiceEffect(db, G, U);
    expect(getVoiceEffect(db, G, U)).toBe('none');
  });

  it('NEGATIVE caching: a get with no row does not re-query on the 2nd get, but set invalidates', () => {
    const spy = vi.spyOn(db, 'prepare');
    getNickname(db, G, U); // miss -> SELECT
    getNickname(db, G, U); // hit -> no new SELECT
    const selects = spy.mock.calls.filter((c) =>
      String(c[0]).includes('FROM user_nickname'),
    ).length;
    expect(selects).toBe(1); // only one SELECT despite two gets (null was cached)
    spy.mockRestore();
    setNickname(db, G, U, 'Ana');
    expect(getNickname(db, G, U)).toBe('Ana');
  });

  it('isolation between db instances (WeakMap): db1 does not contaminate db2', () => {
    const db2 = initDb(':memory:');
    try {
      setNickname(db, G, U, 'só-no-db1');
      getNickname(db, G, U);
      expect(getNickname(db2, G, U)).toBeNull();
    } finally {
      db2.close();
    }
  });

  it('returned object is NOT aliased to the cached one (shallow copy)', () => {
    setGuildConfig(db, G, { maxChars: 250 });
    const a = getGuildConfig(db, G);
    a.maxChars = 999; // caller mutation
    expect(getGuildConfig(db, G).maxChars).toBe(250); // the cached one did not change
  });
});

describe('store — kofi_supporter migration (cleartext email -> email_hash)', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('renames the email->email_hash column on an old DB and the store keeps working', () => {
    dir = mkdtempSync(join(tmpdir(), 'vozen-kofimig-'));
    const file = join(dir, 'old.db');
    // Simulates an OLD DB: kofi_supporter with the email column IN CLEARTEXT (`email`).
    const seed = new BetterSqlite3(file);
    seed.exec(
      'CREATE TABLE kofi_supporter (email TEXT PRIMARY KEY, discord_id TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
    seed.close();
    // initDb applies the idempotent migration -> the column is now named email_hash.
    const db = initDb(file);
    const cols = (db.pragma('table_info(kofi_supporter)') as Array<{ name: string }>).map(
      (c) => c.name,
    );
    expect(cols).toContain('email_hash');
    expect(cols).not.toContain('email');
    // And the store (which now writes/reads email_hash) works without blowing up ("no such column").
    const hash = 'deadbeef'.repeat(8); // 64 hex, shaped like a hash
    rememberKofiSupporter(db, hash, '123456789012345678', 1);
    expect(lookupKofiSupporter(db, hash)).toBe('123456789012345678');
    db.close();
  });
});
