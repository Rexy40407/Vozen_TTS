import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  grantSttConsent,
  hasSttConsent,
  revokeSttConsent,
  getSttConsent,
} from '../src/store/sttConsent';

// Per-speaker STT consent, CONSENT-FIRST and per-SERVER (1-click remembered): the row
// only exists after the person consents; `consent_at` records when. hasSttConsent is the GATE
// that decides whether a speaker enters the transcription receiver. Revoke = delete the row.

const U = '111';
const G = 'guildA';

describe('store/sttConsent', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('without consent, the gate denies (consent-first)', () => {
    expect(hasSttConsent(db, U, G)).toBe(false);
    expect(getSttConsent(db, U, G)).toBeNull();
  });

  it('grant records consent_at and the gate starts allowing', () => {
    grantSttConsent(db, U, G, 1700);
    expect(hasSttConsent(db, U, G)).toBe(true);
    expect(getSttConsent(db, U, G)).toEqual({ userId: U, guildId: G, consentAt: 1700 });
  });

  it('consent is PER-SERVER (does not leak to another guild)', () => {
    grantSttConsent(db, U, G, 1700);
    expect(hasSttConsent(db, U, 'guildB')).toBe(false);
  });

  it('repeated grant is idempotent and preserves the original consent_at (1-click-for-life)', () => {
    grantSttConsent(db, U, G, 1700);
    grantSttConsent(db, U, G, 9999);
    expect(getSttConsent(db, U, G)?.consentAt).toBe(1700);
  });

  it('revoke deletes the row and the gate denies again; returns true only when consent existed', () => {
    grantSttConsent(db, U, G, 1700);
    expect(revokeSttConsent(db, U, G)).toBe(true);
    expect(hasSttConsent(db, U, G)).toBe(false);
    expect(revokeSttConsent(db, U, G)).toBe(false); // there was nothing left
  });
});
