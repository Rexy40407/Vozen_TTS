// tests/guildDeparted.test.ts
import { describe, it, expect } from 'vitest';
import { initDb } from '../src/store/db';
import {
  markGuildDeparted,
  unmarkGuildDeparted,
  purgeDepartedGuilds,
  DEPARTURE_GRACE_MS,
} from '../src/store/guildDeparted';

const DAY = 24 * 60 * 60 * 1000;

function departedAt(db: ReturnType<typeof initDb>, g: string): number | null {
  const row = db.prepare('SELECT left_at FROM guild_departed WHERE guild_id = ?').get(g) as
    { left_at: number } | undefined;
  return row ? row.left_at : null;
}

describe('guildDeparted', () => {
  it('marks the departure and unmarks on re-invite', () => {
    const db = initDb(':memory:');
    try {
      markGuildDeparted(db, 'G', 1000);
      expect(departedAt(db, 'G')).toBe(1000);
      unmarkGuildDeparted(db, 'G');
      expect(departedAt(db, 'G')).toBeNull();
    } finally {
      db.close();
    }
  });

  it('re-marking updates left_at (idempotent)', () => {
    const db = initDb(':memory:');
    try {
      markGuildDeparted(db, 'G', 1000);
      markGuildDeparted(db, 'G', 2000);
      expect(departedAt(db, 'G')).toBe(2000);
    } finally {
      db.close();
    }
  });

  it('purges only the servers outside the grace period and deletes their data + the mark', () => {
    const db = initDb(':memory:');
    try {
      const now = 1_000_000_000_000;
      // OLD left 31 days ago (outside the grace) — should be purged.
      db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run('OLD');
      db.prepare('INSERT INTO talk_stats (guild_id, user_id) VALUES (?,?)').run('OLD', 'U');
      markGuildDeparted(db, 'OLD', now - 31 * DAY);
      // FRESH left 5 days ago (within the grace) — should NOT be touched.
      db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run('FRESH');
      markGuildDeparted(db, 'FRESH', now - 5 * DAY);

      const purged = purgeDepartedGuilds(db, now);

      expect(purged).toEqual(['OLD']);
      // OLD: data and mark deleted.
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM guild_config WHERE guild_id='OLD'").get(),
      ).toEqual({ n: 0 });
      expect(db.prepare("SELECT COUNT(*) AS n FROM talk_stats WHERE guild_id='OLD'").get()).toEqual(
        {
          n: 0,
        },
      );
      expect(departedAt(db, 'OLD')).toBeNull();
      // FRESH: intact.
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM guild_config WHERE guild_id='FRESH'").get(),
      ).toEqual({ n: 1 });
      expect(departedAt(db, 'FRESH')).toBe(now - 5 * DAY);
    } finally {
      db.close();
    }
  });

  it('the exported grace period is 30 days', () => {
    expect(DEPARTURE_GRACE_MS).toBe(30 * DAY);
  });
});
