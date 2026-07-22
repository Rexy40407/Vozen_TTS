import type { SynthRequest } from '../tts/engine';

/**
 * "Hello {name}" greeting per base-language, for Vozen to say when someone JOINS the
 * call. The main one is always English ('en'); the others are selectable in /config
 * greet-language. `{name}` is replaced by the (already sanitized) name of whoever joins;
 * without a name, {name} comes out empty and only the greeting remains ("Hello").
 * Fallback: a language without an entry here falls back to English.
 */
export const GREETINGS: Record<string, string> = {
  en: 'Hello {name}',
  pt: 'Olá {name}',
  es: 'Hola {name}',
  fr: 'Bonjour {name}',
  de: 'Hallo {name}',
  it: 'Ciao {name}',
  nl: 'Hallo {name}',
  sv: 'Hej {name}',
  da: 'Hej {name}',
  fi: 'Hei {name}',
  pl: 'Cześć {name}',
  ru: 'Привет {name}',
  uk: 'Привіт {name}',
  tr: 'Merhaba {name}',
  cs: 'Ahoj {name}',
  el: 'Γεια σου {name}',
  ro: 'Salut {name}',
  ca: 'Hola {name}',
  hu: 'Szia {name}',
};

/** Choices (≤25) for /config greet-language: readable label + code. Derived from GREETINGS. */
export const GREET_LANGUAGE_CHOICES: { name: string; value: string }[] = [
  { name: 'English', value: 'en' },
  { name: 'Português', value: 'pt' },
  { name: 'Español', value: 'es' },
  { name: 'Français', value: 'fr' },
  { name: 'Deutsch', value: 'de' },
  { name: 'Italiano', value: 'it' },
  { name: 'Nederlands', value: 'nl' },
  { name: 'Svenska', value: 'sv' },
  { name: 'Dansk', value: 'da' },
  { name: 'Suomi', value: 'fi' },
  { name: 'Polski', value: 'pl' },
  { name: 'Русский', value: 'ru' },
  { name: 'Українська', value: 'uk' },
  { name: 'Türkçe', value: 'tr' },
  { name: 'Čeština', value: 'cs' },
  { name: 'Ελληνικά', value: 'el' },
  { name: 'Română', value: 'ro' },
  { name: 'Català', value: 'ca' },
  { name: 'Magyar', value: 'hu' },
];

/**
 * "Happy birthday {name}" wish per base-language, for Vozen to say when someone JOINS
 * the call on their birthday (instead of the normal greeting). Same languages as
 * GREETINGS; fallback to English. `{name}` already sanitized.
 */
export const BIRTHDAY_WISHES: Record<string, string> = {
  en: 'Happy birthday {name}',
  pt: 'Feliz aniversário {name}',
  es: 'Feliz cumpleaños {name}',
  fr: 'Joyeux anniversaire {name}',
  de: 'Alles Gute zum Geburtstag {name}',
  it: 'Buon compleanno {name}',
  nl: 'Gefeliciteerd met je verjaardag {name}',
  sv: 'Grattis på födelsedagen {name}',
  da: 'Tillykke med fødselsdagen {name}',
  fi: 'Hyvää syntymäpäivää {name}',
  pl: 'Wszystkiego najlepszego {name}',
  ru: 'С днём рождения {name}',
  uk: 'З днем народження {name}',
  tr: 'Doğum günün kutlu olsun {name}',
  cs: 'Všechno nejlepší {name}',
  el: 'Χρόνια πολλά {name}',
  ro: 'La mulți ani {name}',
  ca: 'Per molts anys {name}',
  hu: 'Boldog születésnapot {name}',
};

/** Valid greeting codes (to validate /config greet-language). */
export const GREET_LOCALES: ReadonlySet<string> = new Set(Object.keys(GREETINGS));

/**
 * Is it a JOIN into the channel `botChannelId`? True if the person is now in that channel
 * (`newChannelId`) and was NOT there before (`oldChannelId`). Covers reconnecting and
 * moving from another channel to the bot's. False if the bot is not in a call
 * (`botChannelId` null), if they were already there, or if it's a mute/deafen event
 * (channel didn't change). PURE.
 */
export function isJoinIntoChannel(
  oldChannelId: string | null | undefined,
  newChannelId: string | null | undefined,
  botChannelId: string | null | undefined,
): boolean {
  if (!botChannelId) return false;
  return newChannelId === botChannelId && oldChannelId !== botChannelId;
}

/** Base language code from a Piper model id ('de_DE-thorsten' -> 'de'). */
function baseOfModel(model: string): string {
  return model.split('-')[0].split('_')[0].toLowerCase();
}

/**
 * Builds the greeting SynthRequest: text "Hello {name}" in the language `locale` and a
 * voice of that language (1st installed model with the prefix; otherwise the default
 * voice). If the language has no greeting, it falls back to English (text AND voice).
 * `name` already comes sanitized; empty -> just the greeting. `singleVoice` so the chosen
 * language isn't overridden by detection. PURE.
 */
export function buildGreeting(opts: {
  locale: string;
  name: string;
  availableModels: string[];
  defaultVoice: string;
  defaultSpeed: number;
  /** If true, uses the BIRTHDAY_WISHES instead of the "Hello" — birthday. */
  birthday?: boolean;
}): SynthRequest {
  const requested = (opts.locale || 'en').split('-')[0].toLowerCase();
  const table = opts.birthday ? BIRTHDAY_WISHES : GREETINGS;
  const base = table[requested] ? requested : 'en';
  const text = table[base].replace('{name}', opts.name).replace(/\s+/g, ' ').trim();
  const model = opts.availableModels.find((m) => baseOfModel(m) === base) ?? opts.defaultVoice;
  return { text, model, speed: opts.defaultSpeed, singleVoice: true };
}
