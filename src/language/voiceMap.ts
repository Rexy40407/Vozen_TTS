/**
 * Maps ISO 639-3 codes (detectLang output) to locale prefixes used in Piper
 * model names (e.g. 'por' -> 'pt_', 'eng' -> 'en_').
 */
const LANG_TO_PREFIX: Record<string, string> = {
  // Original languages
  // 'por' -> 'pt_' DELIBERATELY covers pt_PT and pt_BR: franc always returns
  // 'por' for Portuguese (without distinguishing the variant) and both Piper
  // locales ('pt_PT-...', 'pt_BR-...') start with 'pt_', so pickVoice takes the
  // first available pt_ model (see tests P7.3 in tests/language.test.ts).
  por: 'pt_',
  eng: 'en_',
  spa: 'es_',
  fra: 'fr_',
  deu: 'de_',
  ita: 'it_',
  nld: 'nl_',
  rus: 'ru_',
  // Added languages (P3.3)
  pol: 'pl_',
  ukr: 'uk_',
  tur: 'tr_',
  ces: 'cs_',
  cat: 'ca_',
  swe: 'sv_',
  fin: 'fi_',
  dan: 'da_',
  ron: 'ro_',
  ell: 'el_',
  hun: 'hu_',
  // Languages of the remaining Piper models. Where franc may return more than
  // one ISO 639-3 code for the same language, we map ALL plausible variants to
  // the same prefix. Codes confirmed empirically with franc v5 (node + long
  // samples): Arabic -> 'arb', Persian -> 'fas', Georgian -> 'kat',
  // Kazakh -> 'kaz', Latvian -> 'lav', Nepali -> 'nep', Slovak -> 'slk',
  // Slovenian -> 'slv', Serbian -> 'srp', Swahili -> 'swh', Vietnamese -> 'vie',
  // Chinese -> 'cmn'. We also keep the alternative variants (ara/pes/swa/zho).
  // NOTE: cym (Welsh), isl (Icelandic) and ltz (Luxembourgish) are NOT emitted by
  // franc v5 (no trigram model -> it classifies them as tzm/uzn/deu). The entries
  // stay anyway (correct and forward-compatible): pickVoice is independent of
  // franc, and if the detection source changes they start working.
  ara: 'ar_',
  arb: 'ar_',
  cym: 'cy_',
  fas: 'fa_',
  pes: 'fa_',
  isl: 'is_',
  kat: 'ka_',
  kaz: 'kk_',
  ltz: 'lb_',
  lav: 'lv_',
  nep: 'ne_',
  slk: 'sk_',
  slv: 'sl_',
  srp: 'sr_',
  swh: 'sw_',
  swa: 'sw_',
  vie: 'vi_',
  cmn: 'zh_',
  zho: 'zh_',
  // FIX (TTS audit — G3 alignment bug): 'no_NO' already had an autonym in
  // LOCALE_NAMES ("Norsk") but NO detection code pointed to the 'no_' prefix —
  // Norwegian text could never route to an installed Norwegian model, always
  // falling into the fallback (typically the English voice, i.e. garble C1 in
  // docs/VOICE-QUALITY.md). 'nob' (Bokmål) and 'nno' (Nynorsk) are the ISO 639-3
  // codes of the two written Norwegian standards; 'nor' is the macro-language
  // code. We map all three for the SAME reason as the cym/isl/ltz block above:
  // franc v5 may not emit any of them today (no trigram model for Norwegian),
  // but pickVoice/pickVoiceForLang are independent of franc — the route is
  // correct and forward-compatible as soon as detection (or another source,
  // e.g. future detection by Discord locale) emits one of these codes.
  nob: 'no_',
  nno: 'no_',
  nor: 'no_',
  // Japanese. Standard Piper (rhasspy/piper-voices) has NO ja_JP model — only
  // gTTS (Google) speaks Japanese well. We map it anyway following the SAME dormant
  // pattern as the cym/isl/ltz/nob block above: the route is correct and
  // forward-compatible, and as soon as a 'ja_*.onnx' appears in ./models BOTH
  // engines serve Japanese like any other voice. Today: gTTS serves it (see the
  // synthetic ja_JP voice in index.ts).
  jpn: 'ja_',
};

/**
 * Chooses a Piper model from `available` for the language `lang`.
 * If a model whose name starts with the language prefix exists, returns it.
 * Otherwise (unknown lang, '', or no matching model), returns `fallback`.
 * PURE: no side effects.
 */
export function pickVoice(lang: string, available: string[], fallback: string): string {
  const prefix = LANG_TO_PREFIX[lang];
  if (!prefix) return fallback;

  const match = available.find((model) => model.startsWith(prefix));
  return match ?? fallback;
}

/**
 * Chooses the voice for the language `lang`, HONORING the `preferred` voice when it
 * is already in the detected language. Difference vs `pickVoice`: here `preferred`
 * is not an anonymous fallback — it is the voice the user/guild/.env want, so if it
 * belongs to the text's language, it wins (even if it is not the 1st voice of the
 * prefix in alphabetical order; e.g. 'en_GB-alan' for English, not the 1st 'en_').
 *
 * - `lang` unknown/'' (detection failed) => returns `preferred` (can't decide by
 *   language, honors the preferred one).
 * - `preferred` already starts with the language prefix => returns `preferred`.
 * - otherwise => 1st voice in `available` with the language prefix; if there is
 *   none, fall back to `preferred`.
 * PURE: no side effects.
 */
export function pickVoiceForLang(lang: string, available: string[], preferred: string): string {
  const prefix = LANG_TO_PREFIX[lang];
  if (!prefix) return preferred;
  if (preferred.startsWith(prefix)) return preferred;

  const match = available.find((model) => model.startsWith(prefix));
  return match ?? preferred;
}

/**
 * Display name of each Piper locale, written IN ITS OWN LANGUAGE (autonym).
 * Used in the voice-selection dropdown to be beginner-friendly (the user sees
 * "Português", "English", "Français"… instead of the technical model id).
 * Key = locale (the part before the 1st '-' in the model name, e.g. 'pt_PT', 'en_US').
 * Where there is more than one variant of a language, it includes the region to disambiguate.
 */
export const LOCALE_NAMES: Record<string, string> = {
  ar_JO: 'العربية',
  ca_ES: 'Català',
  cs_CZ: 'Čeština',
  cy_GB: 'Cymraeg',
  da_DK: 'Dansk',
  de_DE: 'Deutsch',
  el_GR: 'Ελληνικά',
  en_GB: 'English (UK)',
  en_US: 'English (US)',
  es_ES: 'Español',
  es_MX: 'Español (México)',
  fa_IR: 'فارسی',
  fi_FI: 'Suomi',
  fr_FR: 'Français',
  hu_HU: 'Magyar',
  is_IS: 'Íslenska',
  it_IT: 'Italiano',
  ja_JP: '日本語',
  ka_GE: 'ქართული',
  kk_KZ: 'Қазақ тілі',
  lb_LU: 'Lëtzebuergesch',
  lv_LV: 'Latviešu',
  ne_NP: 'नेपाली',
  nl_BE: 'Nederlands (België)',
  nl_NL: 'Nederlands',
  no_NO: 'Norsk',
  pl_PL: 'Polski',
  pt_BR: 'Português (Brasil)', // symmetric with pt_PT (Diogo's request 2026-07-08): both PT voices show the region
  pt_PT: 'Português (Portugal)', // restored 2026-07-08 (see empty EXCLUDED_MODELS in index.ts)
  ro_RO: 'Română',
  ru_RU: 'Русский',
  sk_SK: 'Slovenčina',
  sl_SI: 'Slovenščina',
  sr_RS: 'Српски',
  sv_SE: 'Svenska',
  sw_CD: 'Kiswahili',
  tr_TR: 'Türkçe',
  uk_UA: 'Українська',
  vi_VN: 'Tiếng Việt',
  zh_CN: '中文',
};

/**
 * Builds synthetic model IDs for locales not covered by an installed Piper model.
 * These entries are exposed only when the operator explicitly enables the unofficial
 * Google Translate TTS modes. Local and official-API modes must never advertise a
 * model they cannot synthesize.
 */
export function syntheticGttsModels(piperModels: string[], enabled: boolean): string[] {
  if (!enabled) return [];
  const covered = new Set(piperModels.map((m) => m.split('-')[0])); // 'es_ES-davefx-medium' -> 'es_ES'
  return Object.keys(LOCALE_NAMES)
    .filter((locale) => !covered.has(locale))
    .map((locale) => `${locale}-google-medium`);
}

/**
 * Friendly name of a Piper model for the dropdown: the language written in its own
 * language, derived from the locale (part before the 1st '-'). If the locale is not
 * mapped, returns the model id as-is (safe fallback, never hides a voice).
 */
export function modelDisplayName(model: string): string {
  const dash = model.indexOf('-');
  const locale = dash === -1 ? model : model.slice(0, dash);
  return LOCALE_NAMES[locale] ?? model;
}

/**
 * Short/human name of the VOICE within a language: the 2nd segment of the Piper
 * model id (e.g. 'en_US-amy-medium' -> 'Amy'), capitalized. It is what distinguishes
 * two voices of the SAME language (which `modelDisplayName` collapses into the same
 * autonym). If the id has no 2nd segment, returns the raw id (guard: never hides a voice).
 */
function voiceLabel(model: string): string {
  const parts = model.split('-');
  const raw = parts[1];
  if (!raw) return model;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * FULL friendly name of a voice for success responses (e.g. /voice set,
 * /config default-voice): joins the language autonym (`modelDisplayName`) with the
 * human voice name (`voiceLabel`), in the format "English (US) — Amy". It is what
 * distinguishes two voices of the SAME language (which `modelDisplayName` alone
 * collapsed into the same autonym) and avoids showing the technical id to a beginner.
 * Guards preserved:
 *  - unmapped locale -> `modelDisplayName` falls into the raw id (never hides the voice);
 *  - id with no 2nd segment (no '-') -> there is no voice name to join, returns only the
 *    language name (never "… — " with an empty suffix).
 * PURE: no side effects.
 */
export function voiceDisplayName(model: string): string {
  const lang = modelDisplayName(model);
  if (model.indexOf('-') === -1) return lang;
  return `${lang} — ${voiceLabel(model)}`;
}

/** Splits a model id into the locale's base code and region: 'en_US-amy' -> {base:'en', region:'US'}. */
function baseAndRegion(model: string): { base: string; region: string } {
  const locale = model.split('-')[0]; // 'en_US'
  const us = locale.indexOf('_');
  if (us === -1) return { base: locale.toLowerCase(), region: '' };
  return { base: locale.slice(0, us).toLowerCase(), region: locale.slice(us + 1) };
}

/** Language bases with MORE THAN ONE installed region (e.g. 'en' if there is en_US and en_GB). */
function multiRegionBases(models: string[]): Set<string> {
  const byBase = new Map<string, Set<string>>();
  for (const m of models) {
    const { base, region } = baseAndRegion(m);
    if (!byBase.has(base)) byBase.set(base, new Set());
    if (region) byBase.get(base)!.add(region);
  }
  const out = new Set<string>();
  for (const [base, regions] of byBase) if (regions.size > 1) out.add(base);
  return out;
}

/** Safe `Intl.DisplayNames.of`: returns undefined on an unknown code (of returns the code itself) or error. */
function safeOf(dn: Intl.DisplayNames, code: string): string | undefined {
  try {
    const r = dn.of(code);
    return r && r.toLowerCase() !== code.toLowerCase() ? r : undefined;
  } catch {
    return undefined;
  }
}

const capFirst = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Factory for a "namer" that writes the voice name IN THE USER'S LANGUAGE (the Discord
 * client locale, `i.locale`) — e.g. the German voice appears "Alemão — Thorsten" for a
 * user with Discord in PT, "Allemand — Thorsten" in FR, "German — Thorsten" in EN. Uses
 * `Intl.DisplayNames` (Node's ICU data) — no hand-written translation table, covers all
 * languages. The region is only shown when that base has >1 installed region (e.g. English
 * US vs UK); otherwise only the language name. Builds `Intl.DisplayNames` ONCE (not per
 * model) for autocomplete efficiency.
 *
 * `locale` absent/empty (e.g. non-interaction contexts) -> falls into the AUTONYM
 * (`voiceDisplayName`), preserving the old behavior. Language code unknown to ICU
 * -> also falls into the autonym (never hides a voice).
 */
export function makeLocalizedNamer(
  locale: string | undefined,
  models: string[],
  opts: { voice?: boolean } = {},
): (model: string) => string {
  // voice=true (default) -> "Alemão — Thorsten" (confirmations); voice=false -> only the
  // language "Alemão" (the /voice set picker, which was always just the language).
  const withVoice = opts.voice !== false;
  const fallback = (m: string): string => (withVoice ? voiceDisplayName(m) : modelDisplayName(m));
  if (!locale) return fallback;
  let langDN: Intl.DisplayNames;
  let regionDN: Intl.DisplayNames;
  try {
    langDN = new Intl.DisplayNames([locale, 'en'], { type: 'language' });
    regionDN = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  } catch {
    return fallback; // invalid locale -> autonym
  }
  const multi = multiRegionBases(models);
  return (model) => {
    const { base, region } = baseAndRegion(model);
    const langName = safeOf(langDN, base);
    if (!langName) return fallback(model); // language unknown to ICU -> autonym/id
    let name = capFirst(langName);
    if (region && multi.has(base)) {
      const rn = safeOf(regionDN, region);
      if (rn) name = `${name} (${rn})`;
    }
    if (!withVoice) return name;
    return model.indexOf('-') === -1 ? name : `${name} — ${voiceLabel(model)}`;
  };
}

/**
 * Renders the list of available voices GROUPED BY LANGUAGE, so that /voice list is
 * beginner-friendly: instead of a flat list of technical ids, it shows a header
 * with the language autonym (via LOCALE_NAMES / modelDisplayName) and, below it,
 * one line per voice with the human name and the raw id in parentheses (so that
 * `/voice set` stays copy-pasteable). Languages and voices sorted by name, for a
 * stable (and testable) reading. PURE: no side effects.
 */
export function formatVoiceList(models: string[], locale?: string): string {
  // Groups by locale (the part before the 1st '-', same slice as modelDisplayName).
  const groups = new Map<string, string[]>();
  for (const model of models) {
    const dash = model.indexOf('-');
    const loc = dash === -1 ? model : model.slice(0, dash);
    const bucket = groups.get(loc);
    if (bucket) bucket.push(model);
    else groups.set(loc, [model]);
  }

  // Header in the USER'S LANGUAGE (Intl) when there is a `locale`; otherwise the AUTONYM
  // (LOCALE_NAMES), preserving the old behavior. The region only appears when the base
  // has >1 installed region (same rule as makeLocalizedNamer).
  const multi = multiRegionBases(models);
  let langDN: Intl.DisplayNames | undefined;
  let regionDN: Intl.DisplayNames | undefined;
  if (locale) {
    try {
      langDN = new Intl.DisplayNames([locale, 'en'], { type: 'language' });
      regionDN = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
    } catch {
      langDN = undefined;
      regionDN = undefined;
    }
  }
  const header = (loc: string): string => {
    if (langDN) {
      const { base, region } = baseAndRegion(loc);
      const langName = safeOf(langDN, base);
      if (langName) {
        let name = capFirst(langName);
        if (region && multi.has(base) && regionDN) {
          const rn = safeOf(regionDN, region);
          if (rn) name = `${name} (${rn})`;
        }
        return name;
      }
    }
    return LOCALE_NAMES[loc] ?? loc;
  };

  const lines: string[] = [];
  // Sorts the groups by the header (localized or autonym) for a stable output.
  const sortedLocales = [...groups.keys()].sort((a, b) => header(a).localeCompare(header(b)));
  for (const loc of sortedLocales) {
    lines.push(header(loc));
    const voices = groups.get(loc)!;
    for (const model of [...voices].sort((a, b) => voiceLabel(a).localeCompare(voiceLabel(b)))) {
      lines.push(`• ${voiceLabel(model)} (${model})`);
    }
  }
  return lines.join('\n');
}
