import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LANGS = ['en', 'pt', 'fr', 'es', 'de', 'tr', 'ar', 'zh', 'ru', 'ko'] as const;
const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), { encoding: 'utf8' });

describe('dashboard channel and voice controls', () => {
  it('ships cache-busted assets and removes the immediately replaced versions', () => {
    const page = source('site/dashboard.html');
    expect(page).toContain('js/i18n-v40.js');
    expect(page).toContain('js/dashboard-v7.js');
    expect(page).not.toContain('js/dashboard-v6.js');
    expect(page).not.toContain('js/i18n-v39.js');
    expect(page).not.toContain('js/i18n-v38.js');
    expect(page).not.toContain('js/dashboard-v5.js');
    expect(existsSync(resolve(process.cwd(), 'site/js/i18n-v39.js'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'site/js/i18n-v38.js'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'site/js/dashboard-v5.js'))).toBe(false);
  });

  it('only reveals the new controls when the API advertises capabilities and options', () => {
    const script = source('site/js/dashboard-v7.js');
    expect(script).toContain('meta.capabilities.ttsChannelId');
    expect(script).toContain('meta.capabilities.defaultVoice');
    expect(script).toContain('Array.isArray(meta.options.channels)');
    expect(script).toContain('Array.isArray(meta.options.voices)');
    expect(script).toContain('fields.unshift("ttsChannelId", "defaultVoice")');
  });

  it('uses only server-provided channel, voice and locale options', () => {
    const script = source('site/js/dashboard-v7.js');
    expect(script).not.toContain('var LOCALES =');
    expect(script).toContain('meta.options.channels');
    expect(script).toContain('meta.options.voices');
    expect(script).toContain('meta.options.locales');
  });

  it('selecting or clearing a channel adjusts Auto-read once while later edits stay respected', () => {
    const script = source('site/js/dashboard-v7.js');
    expect(script).toContain('function syncChannelAutoread(event)');
    expect(script).toContain('target.getAttribute("data-k") !== "ttsChannelId"');
    expect(script).toContain('autoread.checked = target.value !== ""');
    expect(script).toContain('syncChannelAutoread(event);');
  });

  it('renders stale choices as disabled and rebuilds from the authoritative save response', () => {
    const script = source('site/js/dashboard-v7.js');
    expect(script).toContain('option.unavailable ? " disabled" : ""');
    expect(script).toContain('dashboard.unavailableChannel');
    expect(script).toContain('dashboard.unavailableVoice');
    expect(script).toContain('return res.json();');
    expect(script).toContain('renderForm(guild, data.config, guilds, data, true)');
  });

  it('renders an authorised channel-profile editor and uses scoped API routes', () => {
    const script = source('site/js/dashboard-v7.js');
    expect(script).toContain('meta.capabilities.channelProfiles');
    expect(script).toContain('meta.channelProfiles');
    expect(script).toContain('/profile/');
    expect(script).toContain('method: "DELETE"');
  });

  it('translates the new fields in every advertised site language', () => {
    const keys = [
      'dashboard.f_ttsChannelId',
      'dashboard.d_ttsChannelId',
      'dashboard.f_defaultVoice',
      'dashboard.d_defaultVoice',
      'dashboard.channelNone',
      'dashboard.voiceGlobal',
      'dashboard.unavailableChannel',
      'dashboard.unavailableVoice',
    ];
    for (const language of LANGS) {
      const parsed = JSON.parse(source(`tools/i18n-src/${language}.json`)) as {
        ui: Record<string, string>;
      };
      for (const key of keys) expect(parsed.ui[key], `${language}: ${key}`).toBeTruthy();
    }
  });
});
