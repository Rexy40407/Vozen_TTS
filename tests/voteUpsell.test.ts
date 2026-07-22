import { describe, it, expect } from 'vitest';
import { voteUpsellLine } from '../src/commands/voteUpsell';

describe('voteUpsellLine — invitation to the one-time 48h Plus reward', () => {
  it('no clientId (undefined or empty): returns null (broken link) — appends nothing', () => {
    expect(voteUpsellLine('en', undefined)).toBeNull();
    expect(voteUpsellLine('pt', '')).toBeNull();
  });

  it('with clientId: returns a line with the top.gg vote link', () => {
    const en = voteUpsellLine('en', '12345');
    expect(en).not.toBeNull();
    expect(en).toContain('https://top.gg/bot/12345/vote');

    const pt = voteUpsellLine('pt', '12345');
    expect(pt).not.toBeNull();
    expect(pt).toContain('https://top.gg/bot/12345/vote');
    // PT differs from EN (the copy is localized, not an English fallback).
    expect(pt).not.toBe(en);
  });
});
