import type Database from 'better-sqlite3';

export type KofiActivationMethod = 'discord_email' | 'receipt';

export interface KofiActivationConsentInput {
  transactionId: string;
  confirmationId: string;
  discordId: string;
  acceptedAt: number;
  termsVersion: string;
  method: KofiActivationMethod;
}

/**
 * Persists the minimum evidence that a buyer explicitly requested immediate activation.
 * The caller owns the surrounding transaction so this insert commits or rolls back with the grant.
 * No email or email hash is retained here.
 */
export function recordKofiActivationConsent(
  db: Database.Database,
  input: KofiActivationConsentInput,
): void {
  db.prepare(
    `INSERT INTO kofi_activation_consent
       (transaction_id, confirmation_id, discord_id, accepted_at, terms_version, method)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.transactionId,
    input.confirmationId,
    input.discordId,
    input.acceptedAt,
    input.termsVersion,
    input.method,
  );
}
