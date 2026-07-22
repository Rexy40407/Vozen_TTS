// tests/dataLifecycle.test.ts
//
// Compliance (GDPR / Discord Policy §5(b)): the per-server purge and the per-user
// erase must cover ALL tables holding that entity's data, and must NOT
// touch the retained financial/entitlement records. The `rot-guard` test FAILS if
// someone adds a new table with guild_id/user_id without categorizing it — it's the net
// that keeps the purge/erase complete as the schema grows.
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  purgeGuild,
  eraseUser,
  GUILD_PURGE_TABLES,
  GUILD_RETAINED_TABLES,
  USER_ERASE_TABLES,
  USER_RETAINED_TABLES,
  USER_ERASE_BESPOKE,
  LIFECYCLE_REVIEWED_EXEMPT,
} from '../src/store/dataLifecycle';
import { purgeOldGcloudUsage } from '../src/store/gcloudUsage';
import { getUserPronunciations } from '../src/store/pronunciation';
import { isDetectionOn, setDetection } from '../src/store/langDetect';

function count(db: Database.Database, table: string, col: string, id: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).get(id) as { n: number }
  ).n;
}

/** Inserts 1 row in each guild-scoped table for a guildId (minimal columns + defaults). */
function seedGuild(db: Database.Database, g: string, u: string): void {
  db.prepare('INSERT INTO user_voice (guild_id, user_id, voice_model, speed) VALUES (?,?,?,?)').run(
    g,
    u,
    'en_US-amy-medium',
    1,
  );
  db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(g);
  db.prepare('INSERT INTO blocklist (guild_id, word) VALUES (?,?)').run(g, 'palavrao');
  db.prepare('INSERT INTO pronunciation (guild_id, term, replacement) VALUES (?,?,?)').run(
    g,
    'gg',
    'good game',
  );
  db.prepare('INSERT INTO tts_optout (guild_id, user_id) VALUES (?,?)').run(g, u);
  db.prepare('INSERT INTO tts_lang_detect_on (guild_id, user_id) VALUES (?,?)').run(g, u);
  db.prepare('INSERT INTO user_nickname (guild_id, user_id, nickname) VALUES (?,?,?)').run(
    g,
    u,
    'Zé',
  );
  db.prepare('INSERT INTO game_score (guild_id, user_id) VALUES (?,?)').run(g, u);
  db.prepare('INSERT INTO user_birthday (guild_id, user_id, month, day) VALUES (?,?,?,?)').run(
    g,
    u,
    3,
    14,
  );
  db.prepare('INSERT INTO talk_stats (guild_id, user_id) VALUES (?,?)').run(g, u);
  db.prepare(
    'INSERT INTO talk_usage (guild_id, user_id, language, engine, spoken_count) VALUES (?,?,?,?,?)',
  ).run(g, u, 'en_US', 'google', 1);
  db.prepare('INSERT INTO guild_talk_streak (guild_id) VALUES (?)').run(g);
  db.prepare('INSERT INTO vote_promo_state (guild_id, last_post_at) VALUES (?,?)').run(g, 1);
  db.prepare('INSERT INTO user_effect (guild_id, user_id, effect) VALUES (?,?,?)').run(
    g,
    u,
    'echo',
  );
  db.prepare('INSERT INTO voice_presence (guild_id, channel_id, updated_at) VALUES (?,?,?)').run(
    g,
    'C',
    1,
  );
  db.prepare('INSERT INTO stt_consent (user_id, guild_id, consent_at) VALUES (?,?,?)').run(u, g, 1);
  db.prepare(
    'INSERT INTO translation_mapping (guild_id, source_channel_id, destination_channel_id, target_locale) VALUES (?,?,?,?)',
  ).run(g, `source-${g}`, `destination-${g}`, 'pt');
  db.prepare(
    'INSERT INTO translation_preference (guild_id, user_id, locale, opted_out) VALUES (?,?,?,?)',
  ).run(g, u, 'pt', 0);
  db.prepare('INSERT INTO translation_daily_usage (day, guild_id, chars) VALUES (?,?,?)').run(
    '2026-07-22',
    g,
    1,
  );
  db.prepare(
    'INSERT INTO translation_user_daily_usage (day, guild_id, user_id, chars) VALUES (?,?,?,?)',
  ).run('2026-07-22', g, u, 1);
  db.prepare('INSERT INTO channel_profile (guild_id, channel_id, auto_read) VALUES (?,?,?)').run(
    g,
    `profile-${g}`,
    1,
  );
  // Retained (financial/entitlement) — must NOT be touched by the purge.
  db.prepare('INSERT INTO premium_guild (guild_id, expires_at, source) VALUES (?,?,?)').run(
    g,
    9_999_999_999_999,
    'kofi',
  );
  db.prepare(
    'INSERT INTO discord_premium_entitlement (kind, target_id, expires_at) VALUES (?,?,?)',
  ).run('guild', g, 9_999_999_999_999);
  db.prepare(
    'INSERT INTO premium_pass_activation (user_id, guild_id, activated_at) VALUES (?,?,?)',
  ).run(u, g, 1);
}

describe('purgeGuild', () => {
  it('deletes all guild-scoped data of ONE server, leaves the others and the financial records', () => {
    const db = initDb(':memory:');
    try {
      seedGuild(db, 'G', 'U');
      seedGuild(db, 'OTHER', 'U');

      purgeGuild(db, 'G');

      // All purge tables: G deleted, OTHER intact.
      for (const t of GUILD_PURGE_TABLES) {
        if (t === 'guild_departed') continue; // not seeded here
        expect(count(db, t, 'guild_id', 'G')).toBe(0);
        expect(count(db, t, 'guild_id', 'OTHER')).toBe(1);
      }
      // Retained: NOT deleted (server's financial record + paid licence).
      expect(count(db, 'premium_guild', 'guild_id', 'G')).toBe(1);
      expect(count(db, 'premium_pass_activation', 'guild_id', 'G')).toBe(1);
      expect(count(db, 'discord_premium_entitlement', 'target_id', 'G')).toBe(1);
    } finally {
      db.close();
    }
  });

  it('invalidates the tts_lang_detect_on cache (otherwise serves the purged opt-in as still ON)', () => {
    const db = initDb(':memory:');
    try {
      setDetection(db, 'G', 'U', true);
      // Populates the in-memory cache (key `G:U`) with ON.
      expect(isDetectionOn(db, 'G', 'U')).toBe(true);
      // The guild purge deletes the row AND must invalidate the guild's cache.
      purgeGuild(db, 'G');
      // Without GUILD_KEYED coverage, this returns the cached ON (purged opt-in persisting).
      expect(isDetectionOn(db, 'G', 'U')).toBe(false);
    } finally {
      db.close();
    }
  });
});

describe('eraseUser', () => {
  it('invalidates the pronunciation_user cache (otherwise serves deleted pronunciations after the erase)', () => {
    const db = initDb(':memory:');
    try {
      db.prepare('INSERT INTO pronunciation_user (user_id, term, replacement) VALUES (?,?,?)').run(
        'U',
        'nginx',
        'engine x',
      );
      // Populates the in-memory cache (key `pronunciation_user`).
      expect(getUserPronunciations(db, 'U')).toHaveLength(1);
      // The erase deletes the rows AND must invalidate the user's cache.
      eraseUser(db, 'U');
      // Without the fix, this returns the cached entry (deleted data persisting — GDPR failure).
      expect(getUserPronunciations(db, 'U')).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('invalidates the tts_lang_detect_on cache (otherwise serves the erased opt-in as still ON)', () => {
    const db = initDb(':memory:');
    try {
      setDetection(db, 'G', 'U', true);
      // Populates the in-memory cache (key `G:U`) with ON.
      expect(isDetectionOn(db, 'G', 'U')).toBe(true);
      // The erase deletes the row AND must invalidate the user's cache.
      eraseUser(db, 'U');
      // Without the fix, this returns the cached ON (erased opt-in persisting — GDPR failure).
      expect(isDetectionOn(db, 'G', 'U')).toBe(false);
    } finally {
      db.close();
    }
  });

  it('deletes the user personal data in ALL servers, retains the financial', () => {
    const db = initDb(':memory:');
    try {
      // U has data in 2 servers.
      seedGuild(db, 'G1', 'U');
      seedGuild(db, 'G2', 'U');
      // Global user-scoped tables.
      db.prepare('INSERT INTO user_abbreviation (user_id, term, replacement) VALUES (?,?,?)').run(
        'U',
        'idk',
        'i dont know',
      );
      db.prepare('INSERT INTO pronunciation_user (user_id, term, replacement) VALUES (?,?,?)').run(
        'U',
        'nginx',
        'engine x',
      );
      // User identifiers stored under ANOTHER name (bespoke erase).
      db.prepare(
        'INSERT INTO kofi_supporter (email_hash, discord_id, updated_at) VALUES (?,?,?)',
      ).run('hash-de-U', 'U', 1);
      db.prepare('INSERT INTO gcloud_usage (scope, key, month, chars) VALUES (?,?,?,?)').run(
        'user',
        'U',
        '2026-07',
        100,
      );
      // SERVER usage (guild scope) — NOT U's personal data, stays retained.
      db.prepare('INSERT INTO gcloud_usage (scope, key, month, chars) VALUES (?,?,?,?)').run(
        'guild',
        'G1',
        '2026-07',
        50,
      );
      // User's financial/entitlement (RETAINED).
      db.prepare('INSERT INTO premium_user (user_id, expires_at, source) VALUES (?,?,?)').run(
        'U',
        9_999_999_999_999,
        'kofi',
      );
      db.prepare(
        'INSERT INTO discord_premium_entitlement (kind, target_id, expires_at) VALUES (?,?,?)',
      ).run('user', 'U', 9_999_999_999_999);
      db.prepare(
        'INSERT INTO premium_pass (user_id, seats, expires_at, source) VALUES (?,?,?,?)',
      ).run('U', 3, 9_999_999_999_999, 'kofi');
      db.prepare(
        `INSERT INTO kofi_activation_consent
           (transaction_id, confirmation_id, discord_id, accepted_at, terms_version, method)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('TX-U', 'CONF-U', 'U', 1, '2026-07-19', 'discord_email');

      eraseUser(db, 'U');

      // Erase tables: zero rows of U (in any server).
      for (const t of USER_ERASE_TABLES) {
        expect(count(db, t, 'user_id', 'U')).toBe(0);
      }
      // Bespoke: U's Ko-fi link (discord_id) and personal usage (key) were deleted;
      // the SERVER usage (guild scope) stays retained (not U's personal data).
      expect(count(db, 'kofi_supporter', 'discord_id', 'U')).toBe(0);
      expect(count(db, 'gcloud_usage', 'key', 'U')).toBe(0);
      expect(count(db, 'gcloud_usage', 'key', 'G1')).toBe(1);
      // Retained: intact.
      expect(count(db, 'premium_user', 'user_id', 'U')).toBe(1);
      expect(count(db, 'premium_pass', 'user_id', 'U')).toBe(1);
      expect(count(db, 'discord_premium_entitlement', 'target_id', 'U')).toBe(1);
      expect(count(db, 'kofi_activation_consent', 'discord_id', 'U')).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('rot-guard: categorization vs real schema', () => {
  it('EVERY table with guild_id is categorized (purge OR retained) and the same for user_id', () => {
    const db = initDb(':memory:');
    try {
      const tables = (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all() as { name: string }[]
      ).map((r) => r.name);

      for (const t of tables) {
        const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(
          (c) => c.name,
        );
        if (cols.includes('guild_id')) {
          expect(
            [...GUILD_PURGE_TABLES, ...GUILD_RETAINED_TABLES],
            `tabela '${t}' tem guild_id mas não está em GUILD_PURGE_TABLES nem GUILD_RETAINED_TABLES`,
          ).toContain(t);
        }
        if (cols.includes('user_id')) {
          expect(
            [...USER_ERASE_TABLES, ...USER_RETAINED_TABLES],
            `tabela '${t}' tem user_id mas não está em USER_ERASE_TABLES nem USER_RETAINED_TABLES`,
          ).toContain(t);
        }
        // EXTENDED: a user ID stored under ANOTHER name (discord_id, key,
        // created_by…) escaped both the old guard AND the deletion. Any identifier-shaped
        // column (besides user_id/guild_id, already covered above) requires the table to
        // be categorized in one of the 4 lists OR explicitly handled/exempted.
        const idCols = cols.filter(
          (c) =>
            c !== 'user_id' &&
            c !== 'guild_id' &&
            (/_(id|by)$/.test(c) || c === 'key' || c === 'discord_id'),
        );
        if (idCols.length > 0) {
          expect(
            [
              ...GUILD_PURGE_TABLES,
              ...GUILD_RETAINED_TABLES,
              ...USER_ERASE_TABLES,
              ...USER_RETAINED_TABLES,
              ...USER_ERASE_BESPOKE,
              ...LIFECYCLE_REVIEWED_EXEMPT,
            ],
            `tabela '${t}' tem coluna(s)-identificador [${idCols.join(', ')}] mas não está categorizada, ` +
              'tratada por bespoke-erase, nem isenta — decide erase/retenção e adiciona à lista certa',
          ).toContain(t);
        }
      }
    } finally {
      db.close();
    }
  });

  it('the purge/retention lists are disjoint and only reference existing tables', () => {
    const db = initDb(':memory:');
    try {
      const exists = new Set(
        (
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .all() as { name: string }[]
        ).map((r) => r.name),
      );
      const all = [
        ...GUILD_PURGE_TABLES,
        ...GUILD_RETAINED_TABLES,
        ...USER_ERASE_TABLES,
        ...USER_RETAINED_TABLES,
        ...USER_ERASE_BESPOKE,
        ...LIFECYCLE_REVIEWED_EXEMPT,
      ];
      for (const t of all) expect(exists, `lista refere tabela inexistente '${t}'`).toContain(t);
      // Per-axis disjointness: no table is both purged and retained at the same time.
      for (const t of GUILD_PURGE_TABLES) expect(GUILD_RETAINED_TABLES).not.toContain(t);
      for (const t of USER_ERASE_TABLES) expect(USER_RETAINED_TABLES).not.toContain(t);
    } finally {
      db.close();
    }
  });
});

describe('purgeOldGcloudUsage — monthly retention', () => {
  it('deletes months BEFORE the cutoff and keeps the cutoff and the later ones', () => {
    const db = initDb(':memory:');
    try {
      db.prepare('INSERT INTO gcloud_usage (scope, key, month, chars) VALUES (?,?,?,?)').run(
        'user',
        'U',
        '2026-04',
        10,
      );
      db.prepare('INSERT INTO gcloud_usage (scope, key, month, chars) VALUES (?,?,?,?)').run(
        'user',
        'U',
        '2026-07',
        20,
      );
      const removed = purgeOldGcloudUsage(db, '2026-06');
      expect(removed).toBe(1); // only the month '2026-04'
      expect(count(db, 'gcloud_usage', 'month', '2026-04')).toBe(0);
      expect(count(db, 'gcloud_usage', 'month', '2026-07')).toBe(1);
    } finally {
      db.close();
    }
  });
});
