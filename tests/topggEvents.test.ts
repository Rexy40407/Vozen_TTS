import { describe, expect, it } from 'vitest';
import { initDb } from '../src/store/db';
import {
  claimTopggEvent,
  purgeExpiredTopggEvents,
  TOPGG_EVENT_RETENTION_MS,
} from '../src/store/topggEvents';

describe('Top.gg v1 event ledger', () => {
  it('atomically admits only the first delivery and prunes old protocol metadata', () => {
    const db = initDb(':memory:');
    try {
      expect(claimTopggEvent(db, 'evt-1', 1_000)).toBe(true);
      expect(claimTopggEvent(db, 'evt-1', 1_001)).toBe(false);
      expect(claimTopggEvent(db, 'evt-2', 2_000)).toBe(true);
      expect(purgeExpiredTopggEvents(db, TOPGG_EVENT_RETENTION_MS + 1_001)).toBe(1);
      expect(claimTopggEvent(db, 'evt-1', TOPGG_EVENT_RETENTION_MS + 1_002)).toBe(true);
    } finally {
      db.close();
    }
  });
});
