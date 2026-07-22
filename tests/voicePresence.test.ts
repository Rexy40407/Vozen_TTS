import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  rememberVoicePresence,
  forgetVoicePresence,
  listVoicePresence,
} from '../src/store/voicePresence';
import { planRejoin, type ChannelState } from '../src/voice/rejoin';

describe('voice_presence — store (voice-session persistence)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });

  it('remember inserts and list returns', () => {
    rememberVoicePresence(db, 'G1', 'C1', 1000);
    expect(listVoicePresence(db)).toEqual([{ guildId: 'G1', channelId: 'C1', updatedAt: 1000 }]);
  });

  it('remember is upsert (same guild -> updates channel, does not duplicate)', () => {
    rememberVoicePresence(db, 'G1', 'C1', 1000);
    rememberVoicePresence(db, 'G1', 'C2', 2000);
    expect(listVoicePresence(db)).toEqual([{ guildId: 'G1', channelId: 'C2', updatedAt: 2000 }]);
  });

  it('forget deletes (idempotent)', () => {
    rememberVoicePresence(db, 'G1', 'C1', 1000);
    forgetVoicePresence(db, 'G1');
    expect(listVoicePresence(db)).toEqual([]);
    forgetVoicePresence(db, 'G1'); // 2nd time -> no-op
    expect(listVoicePresence(db)).toEqual([]);
  });

  it('stores several independent guilds', () => {
    rememberVoicePresence(db, 'G1', 'C1', 1000);
    rememberVoicePresence(db, 'G2', 'C2', 1000);
    expect(
      listVoicePresence(db)
        .map((r) => r.guildId)
        .sort(),
    ).toEqual(['G1', 'G2']);
  });
});

describe('planRejoin — pure policy of the startup rejoin', () => {
  const rows = [
    { guildId: 'PREM-READY', channelId: 'c', updatedAt: 0 },
    { guildId: 'PREM-GONE', channelId: 'c', updatedAt: 0 },
    { guildId: 'PREM-NOPERMS', channelId: 'c', updatedAt: 0 },
    { guildId: 'FREE', channelId: 'c', updatedAt: 0 },
  ];
  const states: Record<string, ChannelState> = {
    'PREM-READY': 'ready',
    'PREM-GONE': 'gone',
    'PREM-NOPERMS': 'no-perms',
    FREE: 'ready', // irrelevant: it will be forgotten because it is not Premium
  };
  const plan = planRejoin(rows, {
    stayInCall: (g) => g.startsWith('PREM'),
    channelState: (g) => states[g],
  });

  it('Premium + channel ready -> rejoins', () => {
    expect(plan.rejoin.map((r) => r.guildId)).toEqual(['PREM-READY']);
  });

  it('not eligible for this startup -> forgets (safety net)', () => {
    expect(plan.forget).toContain('FREE');
  });

  it('Premium + deleted channel -> forgets', () => {
    expect(plan.forget).toContain('PREM-GONE');
  });

  it('Premium + no permissions -> neither rejoins nor forgets (retries on next startup)', () => {
    expect(plan.rejoin.map((r) => r.guildId)).not.toContain('PREM-NOPERMS');
    expect(plan.forget).not.toContain('PREM-NOPERMS');
  });

  it('empty list -> empty plan', () => {
    expect(planRejoin([], { stayInCall: () => true, channelState: () => 'ready' })).toEqual({
      rejoin: [],
      forget: [],
    });
  });
});
