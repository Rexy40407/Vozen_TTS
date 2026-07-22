import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  getBirthday,
  setBirthday,
  clearBirthday,
  isValidBirthday,
  isBirthdayToday,
} from '../src/store/birthday';
import { buildGreeting, BIRTHDAY_WISHES } from '../src/voice/greeting';

const G = 'guild-1';
const U = 'user-1';

describe('isValidBirthday — day/month combination', () => {
  it('accepts real dates, including 29/02', () => {
    expect(isValidBirthday(1, 1)).toBe(true);
    expect(isValidBirthday(12, 31)).toBe(true);
    expect(isValidBirthday(2, 29)).toBe(true); // leap-year birthdays
  });

  it('rejects days that are impossible for the month', () => {
    expect(isValidBirthday(2, 30)).toBe(false);
    expect(isValidBirthday(4, 31)).toBe(false); // April has 30
    expect(isValidBirthday(6, 31)).toBe(false);
  });

  it('rejects out-of-range month/day and non-integers', () => {
    expect(isValidBirthday(0, 10)).toBe(false);
    expect(isValidBirthday(13, 10)).toBe(false);
    expect(isValidBirthday(5, 0)).toBe(false);
    expect(isValidBirthday(5, 1.5)).toBe(false);
  });
});

describe('isBirthdayToday — compares month/day with the given date', () => {
  it('true only when month AND day match', () => {
    const now = new Date(2026, 6, 5); // July 5 (0-based month=6 -> July)
    expect(isBirthdayToday({ month: 7, day: 5 }, now)).toBe(true);
    expect(isBirthdayToday({ month: 7, day: 6 }, now)).toBe(false);
    expect(isBirthdayToday({ month: 8, day: 5 }, now)).toBe(false);
  });
});

describe('store birthday', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('no birthday -> null', () => {
    expect(getBirthday(db, G, U)).toBeNull();
  });

  it('persists, overwrites and clears', () => {
    setBirthday(db, G, U, 3, 14);
    expect(getBirthday(db, G, U)).toEqual({ month: 3, day: 14 });
    setBirthday(db, G, U, 12, 25);
    expect(getBirthday(db, G, U)).toEqual({ month: 12, day: 25 });
    clearBirthday(db, G, U);
    expect(getBirthday(db, G, U)).toBeNull();
  });

  it('is per-(guild,user)', () => {
    setBirthday(db, G, U, 1, 1);
    expect(getBirthday(db, 'outra', U)).toBeNull();
    expect(getBirthday(db, G, 'u2')).toBeNull();
  });
});

describe('buildGreeting — birthday wishes on the birthday', () => {
  const base = {
    name: 'Alex',
    availableModels: ['en_US-amy-medium', 'pt_PT-tugao-medium'],
    defaultVoice: 'en_US-amy-medium',
    defaultSpeed: 1,
  };

  it('birthday:true uses the birthday wish instead of "Hello"', () => {
    const en = buildGreeting({ ...base, locale: 'en', birthday: true });
    expect(en.text).toBe('Happy birthday Alex');
    const pt = buildGreeting({ ...base, locale: 'pt', birthday: true });
    expect(pt.text).toBe('Feliz aniversário Alex');
    expect(pt.model.startsWith('pt_')).toBe(true);
  });

  it('birthday:false/omitted keeps the normal greeting', () => {
    expect(buildGreeting({ ...base, locale: 'en' }).text).toBe('Hello Alex');
  });

  it('a language without birthday wishes falls back to English', () => {
    expect(BIRTHDAY_WISHES.xx).toBeUndefined();
    const out = buildGreeting({ ...base, locale: 'xx', birthday: true });
    expect(out.text).toBe('Happy birthday Alex');
  });
});
