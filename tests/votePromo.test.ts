import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  VotePromoPoster,
  PROMO_SLOT_COOLDOWN_MS,
  VOTE_PROMO_COOLDOWN_MS,
  VOTE_PROMO_MIN_MESSAGES,
  VOTE_PROMO_PROBABILITY,
  supportPromoMessage,
  votePromoMessage,
} from '../src/votePromo';
import { messageText } from './messagePayload';

const GUILD = 'guild-vote-promo';

describe('VotePromoPoster', () => {
  let db: Database.Database;
  let now: number;

  beforeEach(() => {
    db = initDb(':memory:');
    now = 1_000_000_000_000;
  });
  afterEach(() => db.close());

  it('pins one shared daily slot and a 48h recurrence per card', () => {
    expect(VOTE_PROMO_MIN_MESSAGES).toBe(24);
    expect(PROMO_SLOT_COOLDOWN_MS).toBe(24 * 60 * 60 * 1000);
    expect(VOTE_PROMO_COOLDOWN_MS).toBe(48 * 60 * 60 * 1000);
    expect(VOTE_PROMO_PROBABILITY).toBe(0.12);
  });

  it('stays silent below the activity threshold and still uses a random draw', () => {
    let draw = 0;
    const poster = new VotePromoPoster(
      db,
      () => now,
      () => draw,
    );
    for (let i = 0; i < VOTE_PROMO_MIN_MESSAGES - 1; i += 1) {
      expect(poster.record(GUILD)).toBeNull();
    }
    draw = 1;
    expect(poster.record(GUILD)).toBeNull();
    draw = 0;
    expect(poster.record(GUILD)).toBe('vote');
  });

  it('persists vote -> support -> vote alternation across restarts', () => {
    const first = new VotePromoPoster(
      db,
      () => now,
      () => 0,
    );
    for (let i = 0; i < VOTE_PROMO_MIN_MESSAGES - 1; i += 1) first.record(GUILD);
    expect(first.record(GUILD)).toBe('vote');

    const afterRestart = new VotePromoPoster(
      db,
      () => now,
      () => 0,
    );
    for (let i = 0; i < VOTE_PROMO_MIN_MESSAGES * 2; i += 1) {
      expect(afterRestart.record(GUILD)).toBeNull();
    }
    now += PROMO_SLOT_COOLDOWN_MS - 1;
    expect(afterRestart.record(GUILD)).toBeNull();
    now += 1;
    expect(afterRestart.record(GUILD)).toBe('support');

    now += PROMO_SLOT_COOLDOWN_MS;
    for (let i = 0; i < VOTE_PROMO_MIN_MESSAGES - 1; i += 1) afterRestart.record(GUILD);
    expect(afterRestart.record(GUILD)).toBe('vote');
  });

  it('atomically gives a shared slot to only one worker', () => {
    const one = new VotePromoPoster(
      db,
      () => now,
      () => 0,
    );
    const two = new VotePromoPoster(
      db,
      () => now,
      () => 0,
    );
    for (let i = 0; i < VOTE_PROMO_MIN_MESSAGES - 1; i += 1) {
      one.record(GUILD);
      two.record(GUILD);
    }
    expect(one.record(GUILD)).toBe('vote');
    expect(two.record(GUILD)).toBeNull();
  });
});

describe('votePromoMessage', () => {
  it('advertises the one-time 48h reward with a safe Top.gg button and no mentions', () => {
    const payload = votePromoMessage('pt', '1523826014935842997');
    expect(messageText(payload)).toContain('48h de Plus grátis');
    expect(messageText(payload)).toContain('uma única vez por conta');
    expect(messageText(payload)).toContain('https://top.gg/bot/1523826014935842997/vote');
    expect(messageText(payload)).toContain('/config vote-reminders active:false');
    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect(JSON.stringify(payload.components)).toContain(
      'https://top.gg/bot/1523826014935842997/vote',
    );
  });

  it('links the official support server with no mentions and the same opt-out', () => {
    const url = 'https://discord.gg/4kYw2WUbNN';
    const payload = supportPromoMessage('pt', url);
    expect(messageText(payload)).toContain('ajuda');
    expect(messageText(payload)).toContain(url);
    expect(messageText(payload)).toContain('/config vote-reminders active:false');
    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect(JSON.stringify(payload.components)).toContain(url);
  });
});
