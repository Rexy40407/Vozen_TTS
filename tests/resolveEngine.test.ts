import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  grantUserPremium,
  grantGuildPremium,
  grantGuildPass,
  activateSeat,
} from '../src/store/premium';
import { resolveUserEngine } from '../src/tts/resolveEngine';

const G = 'guild-1';
const U = 'user-1';
const NOW = 1_000_000;

describe('resolveUserEngine — runtime gate for paid voice engines', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('free engines pass through untouched (without touching premium)', () => {
    for (const eng of ['google', 'piper', undefined] as const) {
      expect(resolveUserEngine(db, G, U, eng, NOW).engine).toBe(eng);
    }
  });

  it('Kokoro WITHOUT Premium -> demoted to the free default', () => {
    expect(resolveUserEngine(db, G, U, 'kokoro', NOW).engine).toBe('google');
  });

  it('Kokoro WITH Vozen Plus (user) -> keeps Kokoro', () => {
    grantUserPremium(db, U, 30, 'test', NOW);
    expect(resolveUserEngine(db, G, U, 'kokoro', NOW).engine).toBe('kokoro');
  });

  it('Kokoro WITH server Premium -> keeps Kokoro', () => {
    grantGuildPremium(db, G, 30, 'test', NOW);
    expect(resolveUserEngine(db, G, U, 'kokoro', NOW).engine).toBe('kokoro');
  });

  it('Kokoro with EXPIRED Premium -> demoted to the free default', () => {
    grantUserPremium(db, U, 30, 'test', NOW - 60 * 86_400_000);
    expect(resolveUserEngine(db, G, U, 'kokoro', NOW).engine).toBe('google');
  });

  it('gcloud WITHOUT Premium -> demoted to google (gate)', () => {
    expect(resolveUserEngine(db, G, U, 'gcloud', NOW).engine).toBe('google');
  });

  it('gcloud WITH Vozen Plus (user) -> keeps gcloud', () => {
    grantUserPremium(db, U, 30, 'test', NOW);
    expect(resolveUserEngine(db, G, U, 'gcloud', NOW).engine).toBe('gcloud');
  });

  it('gcloud WITH server (guild) Premium -> keeps gcloud', () => {
    grantGuildPremium(db, G, 30, 'test', NOW);
    expect(resolveUserEngine(db, G, U, 'gcloud', NOW).engine).toBe('gcloud');
  });

  it('gcloud with EXPIRED Premium -> demoted to google', () => {
    grantUserPremium(db, U, 30, 'test', NOW - 60 * 86_400_000); // expired long ago
    expect(resolveUserEngine(db, G, U, 'gcloud', NOW).engine).toBe('google');
  });
});

describe('resolveUserEngine — budget descriptor (pool to debit)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('Plus -> PERSONAL pool (scope user, key = userId)', () => {
    grantUserPremium(db, U, 30, 'test', NOW);
    const r = resolveUserEngine(db, G, U, 'gcloud', NOW);
    expect(r.gcloudBudget).toEqual({ scope: 'user', key: U });
  });

  it('no Plus but the pass covers the guild -> PASS pool (scope pass, key = owner, seats)', () => {
    const OWNER = 'owner-1';
    grantGuildPass(db, OWNER, 8, 30, 'test', NOW); // 8-server pass
    activateSeat(db, OWNER, G, NOW); // activate on this server
    const r = resolveUserEngine(db, G, U, 'gcloud', NOW);
    expect(r.engine).toBe('gcloud');
    expect(r.gcloudBudget).toEqual({ scope: 'pass', key: OWNER, seats: 8 });
  });

  it('Plus TAKES precedence over the pass (does not drain the pass owner)', () => {
    const OWNER = 'owner-1';
    grantGuildPass(db, OWNER, 8, 30, 'test', NOW);
    activateSeat(db, OWNER, G, NOW);
    grantUserPremium(db, U, 30, 'test', NOW); // the user themselves has Plus
    const r = resolveUserEngine(db, G, U, 'gcloud', NOW);
    expect(r.gcloudBudget).toEqual({ scope: 'user', key: U }); // personal pool, not the pass's
  });

  it('DIRECT server Premium (no pass) -> server pool (scope guild, key = guildId)', () => {
    grantGuildPremium(db, G, 30, 'test', NOW); // redeem/discord/manual, no pass
    const r = resolveUserEngine(db, G, U, 'gcloud', NOW);
    expect(r.gcloudBudget).toEqual({ scope: 'guild', key: G });
  });

  it('pass owner tie-break: OLDEST activated_at wins', () => {
    const A = 'owner-early';
    const B = 'owner-late';
    grantGuildPass(db, A, 3, 30, 'test', NOW);
    grantGuildPass(db, B, 8, 30, 'test', NOW);
    activateSeat(db, A, G, NOW); // A activates first (older)
    activateSeat(db, B, G, NOW + 1000); // B activates later
    const r = resolveUserEngine(db, G, U, 'gcloud', NOW + 2000);
    expect(r.gcloudBudget?.key).toBe(A);
    expect(r.gcloudBudget?.seats).toBe(3);
  });
});
