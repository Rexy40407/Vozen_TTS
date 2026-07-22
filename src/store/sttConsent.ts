import type Database from 'better-sqlite3';

// STT consent (Phase 4), per-speaker and per-SERVER. CONSENT-FIRST: the row only exists
// AFTER the person consents — their presence IS the consent. `hasSttConsent` is the GATE
// that decides whether a speaker's speech enters the transcription receiver. Consenting is
// 1-click-remembered: it is asked ONCE per guild and `consent_at` pins the moment (repeated
// grants preserve the original). Revoking deletes the row. It is NOT cached: the gate runs
// once per speaker when STARTING transcription (not per-frame), so a direct read is enough
// and avoids revocation staleness (relevant for GDPR).

export interface SttConsentRow {
  userId: string;
  guildId: string;
  consentAt: number;
}

/** Returns the consent row (or null if the person did not consent in this server). */
export function getSttConsent(
  db: Database.Database,
  userId: string,
  guildId: string,
): SttConsentRow | null {
  const row = db
    .prepare(
      'SELECT user_id, guild_id, consent_at FROM stt_consent WHERE user_id = ? AND guild_id = ?',
    )
    .get(userId, guildId) as { user_id: string; guild_id: string; consent_at: number } | undefined;
  if (!row) return null;
  return { userId: row.user_id, guildId: row.guild_id, consentAt: row.consent_at };
}

/** GATE: has the person consented to being transcribed in this server? */
export function hasSttConsent(db: Database.Database, userId: string, guildId: string): boolean {
  return getSttConsent(db, userId, guildId) !== null;
}

/**
 * Records the consent (idempotent). A repeated grant PRESERVES the original `consent_at`
 * (consent is 1-click-for-life per server; rewriting the date would erase the real record of
 * the moment the person consented).
 */
export function grantSttConsent(
  db: Database.Database,
  userId: string,
  guildId: string,
  now: number,
): void {
  db.prepare(
    `INSERT INTO stt_consent (user_id, guild_id, consent_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, guild_id) DO NOTHING`,
  ).run(userId, guildId, now);
}

/** Revokes the consent (deletes the row). Returns true if there was consent to revoke. */
export function revokeSttConsent(db: Database.Database, userId: string, guildId: string): boolean {
  const res = db
    .prepare('DELETE FROM stt_consent WHERE user_id = ? AND guild_id = ?')
    .run(userId, guildId);
  return res.changes > 0;
}
