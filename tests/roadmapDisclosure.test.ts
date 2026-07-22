import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('voice platform roadmap disclosures', () => {
  it('documents the new private tools and dashboard profiles without stale denials', () => {
    const policy = source('PRIVACY.md');
    expect(policy).toContain('Transcribe voice message');
    expect(policy).toContain('user_voice_favorite');
    expect(policy).toContain('rolling **30-day**');
    expect(policy).not.toContain('Attachment-message transcription is not enabled');
    expect(policy).not.toContain('profiles remain inert');
    expect(policy).not.toContain('It does not translate DMs');

    const sitePolicy = source('site/privacy.html');
    expect(sitePolicy).toContain('Transcribe voice message');
    expect(sitePolicy).toContain('rolling 30-day');
    expect(sitePolicy).toContain('Last updated: 22 July 2026');
    expect(sitePolicy).toContain('voice transcription (see §6)');
    expect(sitePolicy).toContain('object at any time (see §12)');
    expect(sitePolicy).toContain(
      'GitHub Pages, whose standard host logs are outside our control; see §9',
    );
  });

  it('advertises the shipped private tools, profiles and voice library in English', () => {
    const homepage = source('site/index.html');
    expect(homepage).toContain('Private tools, anywhere');
    expect(homepage).toContain('/tts-file');
    expect(homepage).toContain('/translate text');
    expect(homepage).toContain('Channel profiles');
    expect(homepage).toContain('Favourite voices');
    expect(homepage).toContain('href="/status"');
  });

  it('keeps the rollout guide aligned with explicit User Install command metadata', () => {
    const rollout = source('docs/USER-APP-STATUS-ROLLOUT.md');
    expect(rollout).toContain('`/tts-file`');
    expect(rollout).toContain('`Translate`');
    expect(rollout).toContain('`Transcribe voice message`');
    expect(rollout).not.toContain('No voice, queue, transcription,');
  });
});
