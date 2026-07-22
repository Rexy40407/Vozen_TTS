// src/commands/voiceConfigPanel.ts — PURE logic for the /voice config panel.
//
// The panel lets a user configure their voice with dropdowns + a Save button (no
// accidental submit on Enter, unlike a slash command with options). This module owns
// everything that is testable WITHOUT discord.js: seeding the pending state from the
// user's current voice, paginating the ~40 languages into the 25-option select limit,
// grouping voices per locale, the speed/engine presets, and the Save validation
// (Kokoro/Google HD → Premium gate). The thin discord.js handler in voice.ts builds components
// from these functions and is verified live in Discord.

import type { UserEngine } from '../store/userVoice';
import { modelDisplayName } from '../language/voiceMap';
import { isPremiumVoiceEngine } from '../tts/engineLabels';

/** Pending selection while the panel is open (nothing is persisted until Save). */
export interface PanelState {
  model: string;
  engine: UserEngine;
  speed: number;
  /** 0-based page of the language selector (there are more languages than fit in one select). */
  langPage: number;
}

/**
 * Speed presets offered in the panel. Only values inside the valid 0.5–2.0 range,
 * so the "bad speed" guard from /voice set is enforced BY CONSTRUCTION here — the
 * panel can never save an out-of-range speed.
 */
export const SPEED_PRESETS: readonly number[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

/**
 * Languages per page of the language select. A Discord string select allows at most
 * 25 options; we reserve the 25th for a "More languages ▼" sentinel, so each page
 * shows at most 24 real languages.
 */
export const LANG_PAGE_SIZE = 24;

/** The locale of a model id: the part before the 1st '-' (e.g. 'en_US-amy-medium' -> 'en_US'). */
function localeOf(model: string): string {
  const dash = model.indexOf('-');
  return dash === -1 ? model : model.slice(0, dash);
}

/**
 * Seeds the pending state from the user's CURRENT saved voice, so that changing a
 * single field in the panel preserves the others. With no saved voice, falls back to
 * the operator defaults and the legacy 'google' engine (the operator-configured
 * default — see userVoice.ts).
 */
export function seedPanelState(
  current: { model: string; speed: number; engine: UserEngine } | null,
  defaults: { model: string; speed: number },
): PanelState {
  return {
    model: current?.model ?? defaults.model,
    speed: current?.speed ?? defaults.speed,
    engine: current?.engine ?? 'google',
    langPage: 0,
  };
}

/**
 * Distinct locales present in `models`, each once, sorted by their friendly display
 * name (LOCALE_NAMES autonym; falls back to the code) so the dropdown reads in a
 * stable, human order. PURE.
 */
export function localesOf(models: string[]): string[] {
  const seen = new Set<string>();
  for (const m of models) seen.add(localeOf(m));
  return [...seen].sort((a, b) => modelDisplayName(a).localeCompare(modelDisplayName(b)));
}

/** Models belonging to a given locale (the voices available for that language). PURE. */
export function voicesForLocale(models: string[], locale: string): string[] {
  return models.filter((m) => localeOf(m) === locale);
}

/**
 * True when the locale has MORE THAN ONE installed voice — the only case where the
 * panel needs a second "voice" dropdown. Most locales ship a single voice, so this is
 * usually false and the voice row is skipped (auto-picking the single voice).
 */
export function needsVoiceRow(models: string[], locale: string): boolean {
  return voicesForLocale(models, locale).length > 1;
}

export interface LocalePage {
  /** The locales to show on this page (≤ LANG_PAGE_SIZE). */
  slice: string[];
  /** Whether a "More languages" sentinel is needed (the list spans >1 page). */
  hasMore: boolean;
  /** Total number of pages. */
  totalPages: number;
  /** The page to switch to when "More" is chosen — wraps back to 0 after the last. */
  nextPage: number;
}

/**
 * Slices `locales` into a page of at most LANG_PAGE_SIZE entries. When there is more
 * than one page, `hasMore` is true (the caller adds a "More languages ▼" option) and
 * `nextPage` cycles: 0 → 1 → … → last → 0. PURE. `page` is taken modulo the page count
 * so an out-of-range page never crashes.
 */
export function paginateLocales(locales: string[], page: number): LocalePage {
  const totalPages = Math.max(1, Math.ceil(locales.length / LANG_PAGE_SIZE));
  const safePage = ((page % totalPages) + totalPages) % totalPages;
  const start = safePage * LANG_PAGE_SIZE;
  return {
    slice: locales.slice(start, start + LANG_PAGE_SIZE),
    hasMore: totalPages > 1,
    totalPages,
    nextPage: (safePage + 1) % totalPages,
  };
}

export type SaveResult = { ok: true } | { ok: false; reason: 'premiumEngineLocked' };

/**
 * Validates a Save. Kokoro and Google HD require the user's Plus OR the server's
 * Premium — same rule as /voice set. On failure the caller
 * keeps the panel open with the locked message instead of silently downgrading the
 * engine. Speed is preset-bounded by construction, so no range check is needed. PURE.
 */
export function validateSave(state: PanelState, opts: { premium: boolean }): SaveResult {
  if (isPremiumVoiceEngine(state.engine) && !opts.premium) {
    return { ok: false, reason: 'premiumEngineLocked' };
  }
  return { ok: true };
}
