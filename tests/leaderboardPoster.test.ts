import { describe, it, expect } from 'vitest';
import {
  LeaderboardPoster,
  renderLeaderboard,
  MIN_MESSAGES,
  COOLDOWN_MS,
} from '../src/leaderboard/randomPost';
import type { TalkRow } from '../src/store/talkStats';

const G = 'guild-1';

// now and rand injectable via mutable refs (total determinism).
function makePoster(now: { v: number }, rand: { v: number }): LeaderboardPoster {
  return new LeaderboardPoster(
    () => now.v,
    () => rand.v,
  );
}

describe('LeaderboardPoster.record — threshold + cooldown + draw', () => {
  it('accumulates silently until MIN_MESSAGES (even with the draw winning)', () => {
    const now = { v: 1_000_000_000_000 };
    const rand = { v: 0 }; // 0 < prob -> the draw ALWAYS wins
    const p = makePoster(now, rand);
    // The first MIN_MESSAGES-1 never post (not enough activity yet).
    for (let n = 0; n < MIN_MESSAGES - 1; n++) expect(p.record(G)).toBe(false);
    // The MIN_MESSAGES-th is now eligible and the draw wins -> posts.
    expect(p.record(G)).toBe(true);
  });

  it('the draw can fail (rand >= prob) — keeps accumulating without posting', () => {
    const now = { v: 1_000_000_000_000 };
    const rand = { v: 0.99 }; // >= prob -> the draw never wins
    const p = makePoster(now, rand);
    for (let n = 0; n < MIN_MESSAGES + 20; n++) expect(p.record(G)).toBe(false);
    // As soon as the draw starts winning, it posts (already eligible).
    rand.v = 0;
    expect(p.record(G)).toBe(true);
  });

  it('after a post, the COOLDOWN blocks new posts until the interval passes', () => {
    const now = { v: 1_000_000_000_000 };
    const rand = { v: 0 };
    const p = makePoster(now, rand);
    for (let n = 0; n < MIN_MESSAGES - 1; n++) p.record(G);
    expect(p.record(G)).toBe(true); // 1st post (resets the counter, marks the instant)

    // Even with +MIN_MESSAGES messages, WITHIN the cooldown it does not post.
    for (let n = 0; n < MIN_MESSAGES; n++) expect(p.record(G)).toBe(false);

    // Once the cooldown passes, the next eligible message posts again.
    now.v += COOLDOWN_MS;
    expect(p.record(G)).toBe(true);
  });

  it('is per-guild (independent guilds)', () => {
    const now = { v: 1_000_000_000_000 };
    const rand = { v: 0 };
    const p = makePoster(now, rand);
    for (let n = 0; n < MIN_MESSAGES; n++) p.record('g-A');
    // g-B starts from zero — does not inherit g-A's counter.
    expect(p.record('g-B')).toBe(false);
  });
});

describe('renderLeaderboard — title + lines (reuses topspeakers.line)', () => {
  const rows: TalkRow[] = [
    { userId: 'u1', count: 42, streak: 5, bestStreak: 7 },
    { userId: 'u2', count: 30, streak: 2, bestStreak: 4 },
  ];

  it('includes the title and one line per person with the mention and the count', () => {
    const out = renderLeaderboard(rows, 'en');
    expect(out).toContain('Top talkers');
    expect(out).toContain('<@u1>');
    expect(out).toContain('42');
    expect(out).toContain('<@u2>');
    expect(out.split('\n')).toHaveLength(3); // title + 2 lines
  });

  it('localizes (pt)', () => {
    expect(renderLeaderboard(rows, 'pt')).toContain('Os que mais falam');
  });
});
