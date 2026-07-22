// src/tts/resolveEngine.ts
//
// Shared resolver for every call site that copies a user's engine choice into a speech
// request. Keeping the paid Kokoro/Google HD gate here prevents commands such as /joke
// or /voice preview from bypassing Premium checks or usage accounting.

import type Database from 'better-sqlite3';
import type { UserEngine } from '../store/userVoice';
import type { SynthRequest } from './engine';
import { isGuildPremium, isUserPremium, resolveGuildPassOwner } from '../store/premium';

export interface ResolvedEngine {
  /** Effective engine, possibly downgraded from a paid engine to the configured default. */
  engine: UserEngine | undefined;
  /** Budget descriptor attached only to an effective gcloud request. */
  gcloudBudget?: SynthRequest['gcloudBudget'];
}

/** Resolves the effective engine and Google Cloud budget for a guild/user pair. */
export function resolveUserEngine(
  db: Database.Database,
  guildId: string,
  userId: string,
  storedEngine: UserEngine | undefined,
  now: number,
): ResolvedEngine {
  if (storedEngine !== 'kokoro' && storedEngine !== 'gcloud') return { engine: storedEngine };

  // Kokoro is local but compute-intensive, so it has the same entitlement rule as the
  // other paid voice perks. Revalidating here also safely handles preferences saved
  // before the gate existed and subscriptions that have since expired.
  if (storedEngine === 'kokoro') {
    const unlocked = isUserPremium(db, userId, now) || isGuildPremium(db, guildId, now);
    return { engine: unlocked ? 'kokoro' : 'google' };
  }

  // Pools do not spill into one another: personal Plus first, then a pass covering the
  // guild, then direct guild Premium. No entitlement means the configured default.
  if (isUserPremium(db, userId, now)) {
    return { engine: 'gcloud', gcloudBudget: { scope: 'user', key: userId } };
  }
  const passOwner = resolveGuildPassOwner(db, guildId, now);
  if (passOwner) {
    return {
      engine: 'gcloud',
      gcloudBudget: { scope: 'pass', key: passOwner.ownerId, seats: passOwner.seats },
    };
  }
  if (isGuildPremium(db, guildId, now)) {
    return { engine: 'gcloud', gcloudBudget: { scope: 'guild', key: guildId } };
  }
  return { engine: 'google' }; // Historical value for the configured default (normally Piper).
}
