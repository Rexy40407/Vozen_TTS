import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  getUserPronunciations,
  addUserPronunciation,
  removeUserPronunciation,
  getServerPronunciations,
  addServerPronunciation,
  USER_PRON_LIMIT_FREE,
  USER_PRON_LIMIT_PREMIUM,
  SERVER_PRON_LIMIT,
} from '../src/store/pronunciation';
import { applyPronunciation } from '../src/textCleaning/pronunciation';

const A = 'user-a';
const B = 'user-b';
const G = 'guild-1';

describe('personal pronunciations — limits and isolation', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('Free: accepts 3, blocks the 4th', () => {
    for (let n = 1; n <= USER_PRON_LIMIT_FREE; n++) {
      expect(addUserPronunciation(db, A, `t${n}`, `r${n}`, USER_PRON_LIMIT_FREE)).toBe('ok');
    }
    expect(addUserPronunciation(db, A, 'extra', 'x', USER_PRON_LIMIT_FREE)).toBe('limit');
    expect(getUserPronunciations(db, A)).toHaveLength(USER_PRON_LIMIT_FREE);
  });

  it('EDITING an existing term does not count towards the limit', () => {
    for (let n = 1; n <= USER_PRON_LIMIT_FREE; n++) {
      addUserPronunciation(db, A, `t${n}`, `r${n}`, USER_PRON_LIMIT_FREE);
    }
    // At the cap, but t1 already exists -> it's an UPDATE, passes.
    expect(addUserPronunciation(db, A, 't1', 'novo', USER_PRON_LIMIT_FREE)).toBe('ok');
    expect(getUserPronunciations(db, A).find((e) => e.term === 't1')?.replacement).toBe('novo');
  });

  it('Premium: accepts 50, blocks the 51st', () => {
    for (let n = 1; n <= USER_PRON_LIMIT_PREMIUM; n++) {
      expect(addUserPronunciation(db, A, `t${n}`, 'r', USER_PRON_LIMIT_PREMIUM)).toBe('ok');
    }
    expect(addUserPronunciation(db, A, 'extra', 'x', USER_PRON_LIMIT_PREMIUM)).toBe('limit');
  });

  it('user A pronunciations do not appear to user B (individual)', () => {
    addUserPronunciation(db, A, 'gg', 'good game', USER_PRON_LIMIT_FREE);
    expect(getUserPronunciations(db, B)).toHaveLength(0);
    // ...and so B's message is never touched by A's dictionary:
    const textOfB = applyPronunciation('gg wp', getUserPronunciations(db, B));
    expect(textOfB).toBe('gg wp');
  });

  it('remove: true when it existed, false when not', () => {
    addUserPronunciation(db, A, 'gg', 'good game', USER_PRON_LIMIT_FREE);
    expect(removeUserPronunciation(db, A, 'gg')).toBe(true);
    expect(removeUserPronunciation(db, A, 'gg')).toBe(false);
    expect(getUserPronunciations(db, A)).toHaveLength(0);
  });

  it('precedence: the author PERSONAL pronunciation beats the SERVER one', () => {
    addUserPronunciation(db, A, 'sql', 'sequel', USER_PRON_LIMIT_FREE);
    addServerPronunciation(db, G, 'sql', 'ess-cue-ell', SERVER_PRON_LIMIT);
    // Pipeline order: [author personal, server]. Author A's wins.
    const dictA = [...getUserPronunciations(db, A), ...getServerPronunciations(db, G)];
    expect(applyPronunciation('i love sql', dictA)).toBe('i love sequel');
    // A user WITHOUT their own rule (B) picks up the server one.
    const dictB = [...getUserPronunciations(db, B), ...getServerPronunciations(db, G)];
    expect(applyPronunciation('i love sql', dictB)).toBe('i love ess-cue-ell');
  });
});
