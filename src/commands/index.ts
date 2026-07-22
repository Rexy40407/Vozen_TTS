import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { BotDeps } from '../bot/deps';
import { voiceDisplayName, makeLocalizedNamer } from '../language/voiceMap';
import { JOKE_LANGUAGES } from '../content/jokes';
import { filterGameChoices, filterWordChainLanguages } from '../games/index';
import { log } from '../logging/logger';
import { t, SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES } from '../i18n/index';
import { getUserPronunciations, getServerPronunciations } from '../store/pronunciation';
import { editCard, replyCard } from '../ui/messages';

// Handlers extracted by domain (plan 015): index.ts stays as a thin registry/dispatcher.
import {
  handleJoin,
  handleLeave,
  handleTts,
  handleTtsFile,
  handleSkip,
  handleShutup,
} from './handlers/core';
import { handleVoice } from './handlers/voice';
import { handleTranscribe } from './handlers/transcribe';
import { handleConfig, handleSetup, handleStats } from './handlers/config';
import { handleGame } from './handlers/games';
import { handleCast } from './handlers/cast';
import {
  handleLaugh,
  handleJoke,
  handleRizz,
  handleSound,
  handleMicroFun,
  handleBirthday,
} from './handlers/fun';
import {
  handleHelp,
  handleInvite,
  handleVote,
  handleUptime,
  handleBotstats,
  handleTopSpeakers,
  handleServerStats,
  handlePremium,
  handleVozenGrant,
  handleGenCode,
  handleRedeem,
} from './handlers/meta';
import {
  handlePronunciation,
  handleServerPronunciation,
  handleRandomizer,
} from './handlers/personal';
import { handlePrivacy } from './handlers/privacy';
import { handleQueue } from './handlers/queue';
import { handleTranslate } from './handlers/translation';
import { localeForUser } from './helpers';

// Re-exports: keep the public import paths unchanged for anyone already importing from here.
export { localeForUser, INVITE_PERMISSIONS, localePrefixOf, formatDuration } from './helpers';
export { joinUserVoice, handleMessageContextMenu, type JoinOutcome } from './handlers/core';

export { commandDefs, ownerCommandDefs } from './definitions';

/**
 * Filters the available models by what the user typed (case-insensitive), limited to 25
 * (Discord's maximum for autocomplete). Pure and testable function.
 *
 * `locale` (the Discord client locale of whoever is typing, `i.locale`) writes the
 * language names IN THE USER'S LANGUAGE (e.g. "Alemão"/"Allemand"/"German") via
 * makeLocalizedNamer. Without `locale` -> autonyms (old behavior, used in the tests).
 */
export function filterModelChoices(
  models: string[],
  query: string,
  locale?: string,
): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  // voice:false -> the picker shows only the LANGUAGE (as always), now in the user's language.
  const namer = makeLocalizedNamer(locale, models, { voice: false });
  return (
    models
      .map((m) => ({ name: namer(m), value: m }))
      // Searches by the localized name AND the raw id (the user may type in their language
      // OR the technical/voice name). Also matches the autonym so the search doesn't regress.
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.value.toLowerCase().includes(q) ||
          voiceDisplayName(c.value).toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 25)
  );
}

/**
 * Filters the supported languages of /joke by what the user types in the `idioma`
 * option (case-insensitive, by substring of the ENGLISH display name), limited to 25
 * (Discord's maximum for autocomplete). We support 34 languages > 25, so the cap is
 * really necessary (an empty query would exceed the limit). Pure and testable.
 */
export function filterJokeLanguages(query: string): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  return JOKE_LANGUAGES.filter((l) => l.display.toLowerCase().includes(q))
    .map((l) => ({ name: l.display, value: l.key }))
    .slice(0, 25);
}

/**
 * Filters the supported INTERFACE locales by what the user types in the `locale`
 * option of /config language (case-insensitive, by substring of the endonym OR the
 * code), limited to 25 (Discord's maximum for autocomplete). We support 34 languages
 * > 25, so the cap is really necessary (an empty query would exceed the limit) — this
 * is why this command moved from static choices to autocomplete. Pure and testable.
 * name = endonym (LOCALE_DISPLAY_NAMES), value = code (what is stored in
 * guild_config.locale).
 */
export function filterLocaleChoices(query: string): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  return SUPPORTED_LOCALES.filter(
    (code) =>
      LOCALE_DISPLAY_NAMES[code].toLowerCase().includes(q) || code.toLowerCase().includes(q),
  )
    .map((code) => ({ name: LOCALE_DISPLAY_NAMES[code], value: code }))
    .slice(0, 25);
}

/**
 * Autocomplete for the `model` (/voice set, /voice preview, /config default-voice) and
 * `idioma` (/joke) options: shows the ACTUALLY installed voices / the supported
 * languages for the user to pick from a list, instead of typing the name by hand.
 * Beginner-friendly. Any other option -> [] (no suggestions).
 */
/**
 * Choices for the `/pronunciation remove` (and `/server-pronunciation remove`)
 * autocomplete: lists the SAVED pronunciations instead of forcing the user to type the
 * term from memory. Matches by substring of the term OR the replacement (someone who
 * only remembers the "how it's said" also finds it). name = "term → replacement"
 * (readable); value = the RAW term — it's what the handler passes to
 * removeUserPronunciation/removeServerPronunciation. PURE/testable.
 */
export function filterPronunciationChoices(
  entries: { term: string; replacement: string }[],
  query: string,
): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  return entries
    .filter(
      (e) => !q || e.term.toLowerCase().includes(q) || e.replacement.toLowerCase().includes(q),
    )
    .slice(0, 25)
    .map((e) => ({ name: `${e.term} → ${e.replacement}`, value: e.term }));
}

/**
 * Sanitizes autocomplete choices to Discord's limits: max. 25 entries, `name` 1–100
 * chars, `value` ≤100 chars. ONE invalid entry makes the API reject the WHOLE payload
 * with 400 → the client shows "Failed to load options". This is the single pass-through
 * point before respond(), so the guarantee is structural.
 */
export function sanitizeAutocompleteChoices(
  choices: { name: string; value: string }[],
): { name: string; value: string }[] {
  return choices.slice(0, 25).map((c) => ({
    name: (String(c.name).trim() || '—').slice(0, 100),
    value: String(c.value).slice(0, 100),
  }));
}

/** Computes the choices for ONE autocomplete interaction. Synchronous and I/O-free — the
 *  autocomplete's ~3s budget (no defer possible) is spent on the NETWORK, not here. */
function computeAutocompleteChoices(
  i: AutocompleteInteraction,
  deps: BotDeps,
  focused: { name: string; value: string },
): { name: string; value: string }[] {
  if (focused.name === 'model') {
    // i.locale = the Discord client locale of whoever is typing -> language names
    // written IN THEIR LANGUAGE (e.g. "Alemão" for PT, "Allemand" for FR).
    return filterModelChoices(deps.availableModels, focused.value, i.locale);
  }
  if (focused.name === 'language') {
    // The `language` option exists in TWO commands: /joke (~34 languages) and /game play
    // word-chain (only the 4 Latin languages with a wordlist). We route by command.
    if (i.commandName === 'game') return filterWordChainLanguages(focused.value);
    return filterJokeLanguages(focused.value);
  }
  // /config language: the option is called `locale` (NOT `language` — that's /joke's).
  // 34 languages > 25 static Discord choices, so it's autocomplete.
  if (focused.name === 'locale') {
    return filterLocaleChoices(focused.value);
  }
  // /game play: game names in the user's LANGUAGE. filterGameChoices expects the base
  // code ('pt', 'fr'); we normalize the Discord i.locale ('pt-BR' -> 'pt').
  if (focused.name === 'game') {
    const base = (i.locale || '').split('-')[0].toLowerCase() || 'en';
    return filterGameChoices(focused.value, base);
  }
  // /pronunciation remove + /server-pronunciation remove: the `term` option lists the
  // ALREADY-SAVED pronunciations (personal or server) — pick instead of typing.
  if (focused.name === 'term') {
    if (i.commandName === 'pronunciation') {
      return filterPronunciationChoices(getUserPronunciations(deps.db, i.user.id), focused.value);
    }
    if (i.commandName === 'serverpronunciation') {
      return i.guildId
        ? filterPronunciationChoices(getServerPronunciations(deps.db, i.guildId), focused.value)
        : [];
    }
    return [];
  }
  return [];
}

export async function handleAutocomplete(i: AutocompleteInteraction, deps: BotDeps): Promise<void> {
  // Anti-"Failed to load options" instrumentation. Autocomplete CANNOT be deferred and
  // the token dies ~3s after the user types; the budget splits into: gateway->bot
  // delivery (age), handler (synchronous, ~0ms) and the REST POST of the response. We
  // measure each leg so that, when it fails, the log says WHICH leg ate the time —
  // without this the symptom is invisible and "recurrent".
  const t0 = Date.now();
  const age = t0 - (i.createdTimestamp ?? t0); // delay ALREADY spent before we get to run
  let focusedName = '?';
  try {
    const focused = i.options.getFocused(true);
    focusedName = focused.name;
    if (age > 2500) {
      // The token is (almost) dead on arrival: responding would only produce a 10062.
      // The cause is UPSTREAM of the handler — gateway/network/machine CPU — and is logged.
      log.warn(
        `[autocomplete] interação "${i.commandName}:${focusedName}" chegou ${age}ms atrasada — resposta já impossível (gateway/rede/CPU saturados).`,
      );
      return;
    }
    await i.respond(sanitizeAutocompleteChoices(computeAutocompleteChoices(i, deps, focused)));
    const restMs = Date.now() - t0;
    if (age + restMs > 1500) {
      log.warn(
        `[autocomplete] lento (respondeu, mas perto do limite): "${i.commandName}:${focusedName}" entrega=${age}ms resposta=${restMs}ms.`,
      );
    }
  } catch (err) {
    // 10062 = the response reached Discord after the token expired. Not a handler bug
    // (it's synchronous): it's network/CPU latency — classified separately for the
    // diagnosis of the recurring "Failed to load options".
    if ((err as { code?: number }).code === 10062) {
      log.warn(
        `[autocomplete] resposta tardia (10062): "${i.commandName}:${focusedName}" entrega=${age}ms total=${Date.now() - t0}ms.`,
      );
      return;
    }
    log.error(`[autocomplete] error in "${i.commandName}:${focusedName}"`, err);
  }
}

export async function handleInteraction(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
): Promise<void> {
  try {
    switch (i.commandName) {
      case 'join':
        return await handleJoin(i, deps);
      case 'leave':
        return await handleLeave(i, deps);
      case 'tts':
        return await handleTts(i, deps);
      case 'tts-file':
        return await handleTtsFile(i, deps);
      case 'skip':
        return await handleSkip(i, deps);
      case 'queue':
        return await handleQueue(i, deps);
      case 'translate':
        return await handleTranslate(i, deps);
      case 'shut-up':
        return await handleShutup(i, deps);
      case 'laugh':
        return await handleLaugh(i, deps);
      case 'joke':
        return await handleJoke(i, deps);
      case 'rizz':
        return await handleRizz(i, deps);
      case 'sound':
        return await handleSound(i, deps);
      case '8-ball':
        return await handleMicroFun(i, deps, '8ball');
      case 'fortune':
        return await handleMicroFun(i, deps, 'fortune');
      case 'cast':
        return await handleCast(i, deps);
      case 'fact':
        return await handleMicroFun(i, deps, 'fact');
      case 'wyr':
        return await handleMicroFun(i, deps, 'wyr');
      case 'birthday':
        return await handleBirthday(i, deps);
      case 'top-speakers':
        return await handleTopSpeakers(i, deps);
      case 'server-stats':
        return await handleServerStats(i, deps);
      case 'premium':
        return await handlePremium(i, deps);
      case 'vozen-grant':
        return await handleVozenGrant(i, deps);
      case 'generate-code':
        return await handleGenCode(i, deps);
      case 'redeem':
        return await handleRedeem(i, deps);
      case 'game':
        return await handleGame(i, deps);
      case 'voice':
        return await handleVoice(i, deps);
      case 'transcribe':
        return await handleTranscribe(i, deps);
      case 'config':
        return await handleConfig(i, deps);
      case 'setup':
        return await handleSetup(i, deps);
      case 'stats':
        return await handleStats(i, deps);
      case 'uptime':
        return await handleUptime(i, deps);
      case 'bot-stats':
        return await handleBotstats(i, deps);
      case 'invite':
        return await handleInvite(i, deps);
      case 'vote':
        return await handleVote(i, deps);
      case 'help':
        return await handleHelp(i, deps);
      case 'pronunciation':
        return await handlePronunciation(i, deps);
      case 'server-pronunciation':
        return await handleServerPronunciation(i, deps);
      case 'randomizer':
        return await handleRandomizer(i, deps);
      case 'privacy':
        return await handlePrivacy(i, deps);
    }
  } catch (err) {
    log.error('[command] error in', i.commandName, err);
    if (!i.isRepliable()) return;
    // localeForUser never throws, so even the generic error follows the invoking
    // user's Discord client language without risking a second failure in this catch.
    const locale = localeForUser(deps, i);
    const msg = t('error.generic', locale);
    if (i.deferred && !i.replied) {
      // Already deferred (the /tts case): editReply so the user receives the error
      // instead of being stuck at "thinking...".
      await i.editReply(editCard(msg, { tone: 'danger' })).catch(() => {});
    } else if (!i.replied) {
      await i.reply(replyCard(msg, { ephemeral: true, tone: 'danger' })).catch(() => {});
    }
  }
}
