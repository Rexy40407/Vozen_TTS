import { describe, it, expect } from 'vitest';
import {
  seedPanelState,
  localesOf,
  voicesForLocale,
  needsVoiceRow,
  paginateLocales,
  validateSave,
  SPEED_PRESETS,
  LANG_PAGE_SIZE,
  type PanelState,
} from '../src/commands/voiceConfigPanel';

// A realistic slice of availableModels: one voice for most locales, TWO for en_US.
const MODELS = [
  'en_US-amy-medium',
  'en_US-ryan-medium', // second en_US voice
  'en_GB-alan-medium',
  'pt_PT-tugao-medium',
  'pt_BR-faber-medium',
  'es_ES-davefx-medium',
  'fr_FR-siwis-medium',
  'de_DE-thorsten-medium',
];

const DEFAULTS = { model: 'en_US-amy-medium', speed: 1.0 };

describe('voiceConfigPanel — pure logic for the /voice config panel', () => {
  describe('seedPanelState', () => {
    it('seeds from the user CURRENT voice (so changing one field preserves the rest)', () => {
      const s = seedPanelState(
        { model: 'de_DE-thorsten-medium', speed: 1.25, engine: 'kokoro' },
        DEFAULTS,
      );
      expect(s.model).toBe('de_DE-thorsten-medium');
      expect(s.speed).toBe(1.25);
      expect(s.engine).toBe('kokoro');
      expect(s.langPage).toBe(0);
    });

    it('falls back to defaults + google engine when the user has no saved voice', () => {
      const s = seedPanelState(null, DEFAULTS);
      expect(s.model).toBe('en_US-amy-medium');
      expect(s.speed).toBe(1.0);
      expect(s.engine).toBe('google');
      expect(s.langPage).toBe(0);
    });
  });

  describe('localesOf', () => {
    it('returns each distinct locale ONCE (en_US collapses its two voices), sorted stably', () => {
      const locales = localesOf(MODELS);
      // 6 distinct locales: en_US, en_GB, pt_PT, pt_BR, es_ES, fr_FR, de_DE => 7 actually
      expect(locales).toContain('en_US');
      expect(locales.filter((l) => l === 'en_US')).toHaveLength(1);
      expect(new Set(locales).size).toBe(locales.length); // no duplicates
      expect(locales).toEqual([...locales].sort()); // deterministic order is fine to assert as sorted-by-code? -> see impl
    });
  });

  describe('voicesForLocale / needsVoiceRow', () => {
    it('voicesForLocale returns only the models of that locale', () => {
      expect(voicesForLocale(MODELS, 'en_US').sort()).toEqual([
        'en_US-amy-medium',
        'en_US-ryan-medium',
      ]);
      expect(voicesForLocale(MODELS, 'fr_FR')).toEqual(['fr_FR-siwis-medium']);
    });

    it('needsVoiceRow is true ONLY when the locale has more than one voice', () => {
      expect(needsVoiceRow(MODELS, 'en_US')).toBe(true); // amy + ryan
      expect(needsVoiceRow(MODELS, 'fr_FR')).toBe(false); // single voice
      expect(needsVoiceRow(MODELS, 'xx_XX')).toBe(false); // unknown locale
    });
  });

  describe('paginateLocales', () => {
    // 50 synthetic locales to force multiple pages
    const many = Array.from({ length: 50 }, (_, i) => `l${String(i).padStart(2, '0')}_XX`);

    it('a page never exceeds LANG_PAGE_SIZE (leaving room for the "More" sentinel)', () => {
      const p0 = paginateLocales(many, 0);
      expect(p0.slice.length).toBeLessThanOrEqual(LANG_PAGE_SIZE);
      expect(p0.slice.length).toBe(LANG_PAGE_SIZE);
      expect(p0.hasMore).toBe(true);
    });

    it('exposes total pages and wraps the page index (so "More" cycles back to the start)', () => {
      const total = Math.ceil(many.length / LANG_PAGE_SIZE);
      const p0 = paginateLocales(many, 0);
      expect(p0.totalPages).toBe(total);
      // last page then wrap
      const last = paginateLocales(many, total - 1);
      expect(last.nextPage).toBe(0); // wraps to first page
      const first = paginateLocales(many, 0);
      expect(first.nextPage).toBe(1);
    });

    it('a single-page list has no "More" and nextPage stays 0', () => {
      const few = ['en_US', 'pt_PT'];
      const p = paginateLocales(few, 0);
      expect(p.hasMore).toBe(false);
      expect(p.totalPages).toBe(1);
      expect(p.nextPage).toBe(0);
      expect(p.slice).toEqual(few);
    });
  });

  describe('validateSave', () => {
    const base: PanelState = {
      model: 'en_US-amy-medium',
      engine: 'google',
      speed: 1.0,
      langPage: 0,
    };

    it('gcloud engine WITHOUT premium is rejected (panel stays open), not silently downgraded', () => {
      const r = validateSave({ ...base, engine: 'gcloud' }, { premium: false });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('premiumEngineLocked');
    });

    it('gcloud engine WITH premium saves', () => {
      const r = validateSave({ ...base, engine: 'gcloud' }, { premium: true });
      expect(r.ok).toBe(true);
    });

    it('Kokoro WITHOUT premium is rejected and WITH premium saves', () => {
      expect(validateSave({ ...base, engine: 'kokoro' }, { premium: false }).ok).toBe(false);
      expect(validateSave({ ...base, engine: 'kokoro' }, { premium: true }).ok).toBe(true);
    });

    it('free engines always save (speed is preset-bounded by construction)', () => {
      for (const engine of ['google', 'piper'] as const) {
        expect(validateSave({ ...base, engine }, { premium: false }).ok).toBe(true);
      }
    });
  });

  describe('SPEED_PRESETS', () => {
    it('every preset is inside the valid 0.5–2.0 range', () => {
      expect(SPEED_PRESETS.length).toBeGreaterThan(0);
      for (const s of SPEED_PRESETS) {
        expect(s).toBeGreaterThanOrEqual(0.5);
        expect(s).toBeLessThanOrEqual(2.0);
      }
    });
  });
});
