import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  buildPremiumStatus,
  grantUserPremium,
  grantGuildPass,
  activateSeat,
  syncDiscordEntitlements,
} from '../src/store/premium';

const U = 'user-1';
const DAY = 86_400_000;

describe('buildPremiumStatus — vista do painel', () => {
  let db: Database.Database;
  const now = 1_000_000;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('sem nada -> plus inativo e passe null', () => {
    const v = buildPremiumStatus(db, U, now);
    expect(v.plus.active).toBe(false);
    expect(v.plus.expiresAt).toBeNull();
    expect(v.pass).toBeNull();
  });

  it('Plus ativo -> plus.active true com expiry', () => {
    grantUserPremium(db, U, 30, 'kofi', now);
    const v = buildPremiumStatus(db, U, now);
    expect(v.plus.active).toBe(true);
    expect(v.plus.expiresAt).toBe(now + 30 * DAY);
  });

  it('Plus expirado -> active false mas mantém o expiry (passado)', () => {
    grantUserPremium(db, U, 30, 'kofi', now);
    const later = now + 40 * DAY;
    const v = buildPremiumStatus(db, U, later);
    expect(v.plus.active).toBe(false);
    expect(v.plus.expiresAt).toBe(now + 30 * DAY);
  });

  it('passe com licenças ativadas -> seats/used/servidores corretos', () => {
    grantGuildPass(db, U, 3, 30, 'kofi', now);
    activateSeat(db, U, 'g-1', now);
    activateSeat(db, U, 'g-2', now + 1000);
    const v = buildPremiumStatus(db, U, now + 2000);
    expect(v.pass).not.toBeNull();
    expect(v.pass!.seats).toBe(3);
    expect(v.pass!.used).toBe(2);
    expect(v.pass!.active).toBe(true);
    expect(v.pass!.guilds).toEqual(['g-1', 'g-2']);
  });

  it('shows the effective Discord Plus expiry without changing the direct purchase row', () => {
    grantUserPremium(db, U, 1, 'kofi', now);
    const discordExpiry = now + 3 * DAY;
    syncDiscordEntitlements(db, [{ kind: 'user', id: U, expiresAt: discordExpiry }]);
    expect(buildPremiumStatus(db, U, now).plus).toEqual({ active: true, expiresAt: discordExpiry });
    syncDiscordEntitlements(db, []);
    expect(buildPremiumStatus(db, U, now).plus.expiresAt).toBe(now + DAY);
  });

  it('passe expirado -> active false', () => {
    grantGuildPass(db, U, 3, 30, 'kofi', now);
    const v = buildPremiumStatus(db, U, now + 40 * DAY);
    expect(v.pass!.active).toBe(false);
  });
});
