import { describe, expect, it } from 'vitest';
import { initDb } from '../src/store/db';
import {
  addVoiceFavorite,
  listRecentVoices,
  listVoiceFavorites,
  recordRecentVoice,
  removeVoiceFavorite,
} from '../src/store/voiceLibrary';

describe('personal voice library', () => {
  it('keeps bounded unique favourites and removes them explicitly', () => {
    const db = initDb(':memory:');
    expect(addVoiceFavorite(db, 'user-1', 'en_US-amy-medium', 100)).toBe(true);
    expect(addVoiceFavorite(db, 'user-1', 'en_US-amy-medium', 200)).toBe(true);
    expect(listVoiceFavorites(db, 'user-1')).toEqual(['en_US-amy-medium']);
    expect(removeVoiceFavorite(db, 'user-1', 'en_US-amy-medium')).toBe(true);
    expect(listVoiceFavorites(db, 'user-1')).toEqual([]);
    db.close();
  });

  it('orders recent voices by last use and keeps only ten', () => {
    const db = initDb(':memory:');
    for (let index = 0; index < 12; index += 1) {
      recordRecentVoice(db, 'user-1', `voice-${index}`, 100 + index);
    }
    recordRecentVoice(db, 'user-1', 'voice-5', 1_000);
    expect(listRecentVoices(db, 'user-1')).toHaveLength(10);
    expect(listRecentVoices(db, 'user-1')[0]).toBe('voice-5');
    expect(listRecentVoices(db, 'user-1')).not.toContain('voice-0');
    db.close();
  });
});
