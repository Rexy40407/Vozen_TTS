// src/commands/handlers/fun.ts — fun handlers: /laugh, /joke, /rizz, micro-fun (/8-ball,/fortune,/fact,/wyr) and /birthday extracted from index.ts (plan 015).
import { join } from 'node:path';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { BotDeps } from '../../bot/deps';
import { getPlayer, getLimiter } from '../../bot/deps';
import { getUserVoice } from '../../store/userVoice';
import { resolveUserEngine } from '../../tts/resolveEngine';
import { getGuildConfig } from '../../store/guildConfig';
import { isGuildPremium, isUserPremium } from '../../store/premium';
import { getBirthday, setBirthday, clearBirthday, isValidBirthday } from '../../store/birthday';
import type { SynthRequest } from '../../tts/engine';
import { laughterFor } from '../../content/laughter';
import { jokeLangByKey, pickJoke } from '../../content/jokes';
import { pickLine } from '../../content/pickupLines';
import { SOUNDS, soundByKey, soundFilename } from '../../content/sounds';
import {
  funLocaleOf,
  pickEightball,
  pickFortune,
  pickFact,
  pickWyr,
  type FunLocale,
} from '../../content/microfun';
import { t } from '../../i18n/index';
import { localeForUser, localePrefixOf, reply } from '../helpers';
import { editCard } from '../../ui/messages';
import { admitUserSpeech } from '../../voice/admission';

function admitInteractionSpeech(i: ChatInputCommandInteraction, deps: BotDeps) {
  if (!i.guildId || !i.guild) return { allowed: false as const };
  return admitUserSpeech(
    deps,
    i.guildId,
    i.user.id,
    i.guild,
    i.guild.members.cache.get(i.user.id)?.voice.channelId ?? null,
  );
}

/**
 * /laugh — Vozen laughs in the voice CURRENTLY selected by the user. Per-user
 * (like /tts), no admin gate, but requires an active player (user in a call). The voice
 * is RESOLVED by precedence (user voice > guild default > .env) and the laughter is
 * chosen by the LANGUAGE of that voice (not by detection) — so we build the
 * SynthRequest DIRECTLY, without going through resolveSynth/detectLang (same logic as
 * /voice preview: the language is known, not detected).
 */
export async function handleLaugh(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  // Synthesis can take a while; defer immediately so we don't lose the token (3s).
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = localeForUser(deps, i);
  const player = getPlayer(deps, i.guildId!);
  if (!player) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const admission = admitInteractionSpeech(i, deps);
  if (!admission.allowed) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const cfg = getGuildConfig(deps.db, i.guildId!);

  // per-user rate-limit (SAME limiter as /tts): without this /laugh would queue
  // without limit -> voice-queue spam vector. Runs AFTER deferReply so the
  // editReply works.
  const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
  if (!rl.allow(i.user.id, Date.now())) {
    await i.editReply(editCard(t('tts.tooFast', locale), { tone: 'warning' }));
    return;
  }

  const stored = getUserVoice(deps.db, i.guildId!, i.user.id);
  // Voice precedence: user's saved voice > guild default_voice > .env > amy.
  const model = stored?.model || cfg.defaultVoice || deps.config.defaultVoice || 'en_US-amy-medium';
  const speed = stored?.speed ?? deps.config.defaultSpeed;
  // singleVoice: the voice is DELIBERATELY chosen (the user's current voice); detection
  // must never override it or break the laughter by language.
  const req: SynthRequest = {
    text: laughterFor(localePrefixOf(model)),
    model,
    speed,
    singleVoice: true,
    // Laughs in the SAME engine the user chose; the resolver applies the Kokoro/Google HD
    // gate and attaches the Google HD budget — returns engine + gcloudBudget.
    ...resolveUserEngine(deps.db, i.guildId!, i.user.id, stored?.engine, Date.now()),
  };
  // say() returns false when the queue is at cap: in that case we reuse tts.busy.
  const queued = await player.say(req, {
    authorId: i.user.id,
    source: 'command',
    lane: admission.lane,
  });
  await i.editReply(
    editCard(queued ? t('laugh.playing', locale) : t('tts.busy', locale), {
      tone: queued ? 'success' : 'warning',
    }),
  );
}

/**
 * Pause (ms) between the joke and the laughter in /joke. The laughter is a SEPARATE
 * utterance that carries this value in `leadSilenceMs` (PREPENDED silence), creating a real
 * gap — Vozen speaks the joke, waits ~1s, and ONLY THEN laughs.
 */
const JOKE_LAUGH_PAUSE_MS = 1000;

/**
 * /joke — tells a short joke in the chosen LANGUAGE (`language`, autocomplete). The voice
 * is chosen by LANGUAGE (first model in deps.availableModels whose name starts
 * with the language prefix; if none, falls back to the guild/.env default). If `laughter` is
 * true, appends the laughter of that language at the end. Since the language is KNOWN (chosen,
 * not detected), we build the SynthRequest directly — without resolveSynth/detectLang
 * (same logic as /voice preview and /laugh).
 */
export async function handleJoke(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = localeForUser(deps, i);
  const player = getPlayer(deps, i.guildId!);
  if (!player) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const admission = admitInteractionSpeech(i, deps);
  if (!admission.allowed) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const langKey = i.options.getString('language', true);
  const lang = jokeLangByKey(langKey);
  if (!lang) {
    await i.editReply(editCard(t('joke.unknownLang', locale), { tone: 'danger' }));
    return;
  }
  const risos = i.options.getBoolean('laughter', true);

  // Voice for the chosen language: 1st installed model with the prefix; if none
  // (the language has no installed model), falls back to the guild / .env / amy default.
  const cfg = getGuildConfig(deps.db, i.guildId!);

  // per-user rate-limit (SAME limiter as /tts): without this /joke would queue
  // without limit -> voice-queue spam vector. Runs AFTER deferReply so the
  // editReply works.
  const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
  if (!rl.allow(i.user.id, Date.now())) {
    await i.editReply(editCard(t('tts.tooFast', locale), { tone: 'warning' }));
    return;
  }

  const model =
    deps.availableModels.find((m) => m.startsWith(lang.prefix)) ||
    cfg.defaultVoice ||
    deps.config.defaultVoice ||
    'en_US-amy-medium';

  // The MODEL (voice) for /joke is chosen by LANGUAGE, but the ENGINE (google/piper) should
  // follow the user's choice — just like /laugh and /voice preview. Without this, a
  // Piper user would hear the jokes on Google (inconsistent with everything else).
  const stored = getUserVoice(deps.db, i.guildId!, i.user.id);
  // Shared resolver: gcloud->google without Premium (gate) + budget (Phase 3).
  const resolvedEngine = resolveUserEngine(
    deps.db,
    i.guildId!,
    i.user.id,
    stored?.engine,
    Date.now(),
  );

  // pickJoke is PURE/seeded; at runtime we use Date.now() as the seed (variety without
  // sacrificing the function's deterministic testability).
  const joke = pickJoke(langKey, Date.now());
  const speed = deps.config.defaultSpeed;

  // ALWAYS queue the joke alone first. The reply is based on THIS utterance: if the
  // queue is full (say false), we respond busy and don't queue the laughter.
  // singleVoice: the joke's language is KNOWN (chosen), detection doesn't decide.
  const queued = await player.say(
    {
      text: joke,
      model,
      speed,
      singleVoice: true,
      ...resolvedEngine,
    },
    { authorId: i.user.id, source: 'command', lane: admission.lane },
  );

  // If `laughter` AND the joke entered the queue, queue the LAUGHTER as a SEPARATE utterance with a
  // real 2s pause IN FRONT (leadSilenceMs). This way Vozen speaks the joke, PAUSES ~2s,
  // and ONLY THEN laughs (instead of laughing glued to the end of the joke, as before). The laughter is
  // best-effort: if the queue fills up meanwhile, it simply doesn't laugh (the reply already reflects
  // the joke). Two queue-items: a /skip during the joke won't catch the laughter — acceptable.
  if (queued && risos) {
    await player.say(
      {
        text: laughterFor(lang.prefix),
        model,
        speed,
        ...resolvedEngine,
        leadSilenceMs: JOKE_LAUGH_PAUSE_MS,
        // singleVoice: without this, a multi-script edge-case would lose the leadSilenceMs
        // (the per-segment path calls base.synth without it). The language is known.
        singleVoice: true,
      },
      { authorId: i.user.id, source: 'command', lane: admission.lane },
    );
  }

  // Confirmation includes the written joke (the user sees what is being read).
  await i.editReply(
    editCard(queued ? t('joke.playing', locale, { joke }) : t('tts.busy', locale), {
      tone: queued ? 'success' : 'warning',
    }),
  );
}

// /rizz sound effect: a ready WAV in assets/sfx/ (repo root). At runtime this
// module lives in dist/commands/handlers/, so we go up 3 levels to the root (same
// pattern as the wordlists in games/wordchain/dict.ts). The pause silence is EMBEDDED in the
// file (assetPath skips the engines, where leadSilenceMs lives). Swappable: just
// replace the file with another WAV.
const RIZZ_SFX_PATH = join(__dirname, '..', '..', '..', 'assets', 'sfx', 'rizz.wav');

/**
 * /rizz — sends a pick-up line in the chosen LANGUAGE (`language`,
 * autocomplete — the SAME as /joke), spoken in that language's voice. If `sound` is true,
 * plays the "rizz" sound effect afterward as a SEPARATE utterance that the player plays DIRECTLY
 * (assetPath, no engine/cache/effects). Same voice/engine logic as /joke.
 */
export async function handleRizz(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = localeForUser(deps, i);

  // 💎 GATE: /rizz is Premium (user's own Plus OR the server's Premium). Same pattern as
  // /voice effect and the Premium games. Checked early — doesn't even generate the line.
  const now = Date.now();
  const premium =
    isUserPremium(deps.db, i.user.id, now) || isGuildPremium(deps.db, i.guildId!, now);
  if (!premium) {
    await i.editReply(editCard(t('rizz.locked', locale), { tone: 'premium' }));
    return;
  }

  const player = getPlayer(deps, i.guildId!);
  if (!player) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const admission = admitInteractionSpeech(i, deps);
  if (!admission.allowed) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const langKey = i.options.getString('language', true);
  const lang = jokeLangByKey(langKey);
  if (!lang) {
    await i.editReply(editCard(t('rizz.unknownLang', locale), { tone: 'danger' }));
    return;
  }
  const sound = i.options.getBoolean('sound', true);
  const cfg = getGuildConfig(deps.db, i.guildId!);

  // per-user rate-limit (SAME limiter as /tts and /joke): AFTER deferReply.
  const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
  if (!rl.allow(i.user.id, Date.now())) {
    await i.editReply(editCard(t('tts.tooFast', locale), { tone: 'warning' }));
    return;
  }

  const model =
    deps.availableModels.find((m) => m.startsWith(lang.prefix)) ||
    cfg.defaultVoice ||
    deps.config.defaultVoice ||
    'en_US-amy-medium';
  const stored = getUserVoice(deps.db, i.guildId!, i.user.id);
  // follows the user's engine (like /joke and /laugh), with the paid-engine gate and budget.
  const resolvedEngine = resolveUserEngine(
    deps.db,
    i.guildId!,
    i.user.id,
    stored?.engine,
    Date.now(),
  );

  const line = pickLine(langKey, Date.now());
  const speed = deps.config.defaultSpeed;

  // ALWAYS queue the line alone first; the reply is based on THIS utterance.
  const queued = await player.say(
    {
      text: line,
      model,
      speed,
      singleVoice: true,
      ...resolvedEngine,
    },
    { authorId: i.user.id, source: 'command', lane: admission.lane },
  );

  // "rizz" sound effect afterward (SEPARATE utterance, played directly via assetPath — no engine
  // or cache). Best-effort: if the queue fills up meanwhile, it simply doesn't play the effect
  // (the reply already reflects the line). `text: ''` -> no emphasis gain.
  if (queued && sound) {
    await player.say(
      { text: '', model, speed, singleVoice: true, assetPath: RIZZ_SFX_PATH },
      { authorId: i.user.id, source: 'command', lane: admission.lane },
    );
  }

  await i.editReply(
    editCard(queued ? t('rizz.playing', locale, { line }) : t('tts.busy', locale), {
      tone: queued ? 'success' : 'warning',
    }),
  );
}

// Directory of the soundboard clips (repo root /assets/sfx). At runtime this module
// lives in dist/commands/handlers/, so we go up 3 levels (same pattern as RIZZ_SFX_PATH).
const SFX_DIR = join(__dirname, '..', '..', '..', 'assets', 'sfx');

/**
 * /sound [name] — plays a short soundboard clip in the call (CURATED library, no
 * upload). Without `name`, responds with the LIST of sounds (discovery). The clip is played DIRECTLY
 * via assetPath (no engine/cache/effects) — the same pipeline as the /rizz effect. Requires
 * an active player (bot in a call) and has a per-user rate-limit (anti sound-spam).
 */
export async function handleSound(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = localeForUser(deps, i);

  // Per-server kill-switch: an admin can turn off /sound with /config soundboard.
  const cfg = getGuildConfig(deps.db, i.guildId!);
  if (!cfg.soundboard) {
    await i.editReply(editCard(t('sound.disabled', locale), { tone: 'warning' }));
    return;
  }

  // No argument -> lists the available sounds (doesn't need to be in a call).
  const key = i.options.getString('name');
  if (!key) {
    const list = SOUNDS.map((s) => `${s.emoji ?? '🔊'} \`${s.key}\``).join(' · ');
    await i.editReply(editCard(t('sound.list', locale, { sounds: list })));
    return;
  }

  // `name` comes from choices, but via the API an invalid key can arrive -> clear message.
  const clip = soundByKey(key);
  if (!clip) {
    await i.editReply(editCard(t('sound.unknown', locale), { tone: 'danger' }));
    return;
  }

  const player = getPlayer(deps, i.guildId!);
  if (!player) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }
  const admission = admitInteractionSpeech(i, deps);
  if (!admission.allowed) {
    await i.editReply(editCard(t('tts.notInVoice', locale), { tone: 'danger' }));
    return;
  }

  // per-user rate-limit (SAME limiter as /tts): without this a user could fill the
  // voice queue with clips and drown out everyone's TTS. AFTER deferReply.
  const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
  if (!rl.allow(i.user.id, Date.now())) {
    await i.editReply(editCard(t('tts.tooFast', locale), { tone: 'warning' }));
    return;
  }

  // Fixed clip played DIRECTLY (assetPath skips engine/cache/effects). model/speed are
  // placeholders required by the SynthRequest type — ignored when there is an assetPath.
  const model = cfg.defaultVoice || deps.config.defaultVoice || 'en_US-amy-medium';
  const queued = await player.say(
    {
      text: '',
      model,
      speed: deps.config.defaultSpeed,
      singleVoice: true,
      assetPath: join(SFX_DIR, soundFilename(clip.key)),
    },
    { authorId: i.user.id, source: 'command', lane: admission.lane },
  );
  await i.editReply(
    editCard(queued ? t('sound.playing', locale, { name: clip.name }) : t('tts.busy', locale), {
      tone: queued ? 'success' : 'warning',
    }),
  );
}

type MicroFunKind = '8ball' | 'fortune' | 'fact' | 'wyr';

/**
 * Fun micro-commands (/8-ball, /fortune, /fact, /wyr): pick a phrase from the bank
 * in the user's UI LANGUAGE (EN/PT) and respond PUBLICLY in text; if Vozen
 * is in the call, it also SPEAKS it (voice of the phrase's language, user's engine). Unlike
 * /joke, they work OUTSIDE a call (text anyway). The speech is best-effort and
 * rate-limited (same limiter as /tts): rate-limit -> text anyway, without speaking.
 */
export async function handleMicroFun(
  i: ChatInputCommandInteraction,
  deps: BotDeps,
  kind: MicroFunKind,
): Promise<void> {
  await i.deferReply();
  const locale = localeForUser(deps, i);
  const funLoc: FunLocale = funLocaleOf(locale);
  const seed = Date.now();

  let spoken: string;
  let replyText: string;
  switch (kind) {
    case '8ball': {
      const question = i.options.getString('question', true);
      spoken = pickEightball(funLoc, seed);
      replyText = t('fun.eightball', locale, { question, answer: spoken });
      break;
    }
    case 'fortune':
      spoken = pickFortune(funLoc, seed);
      replyText = t('fun.fortune', locale, { text: spoken });
      break;
    case 'fact':
      spoken = pickFact(funLoc, seed);
      replyText = t('fun.fact', locale, { text: spoken });
      break;
    case 'wyr':
      spoken = pickWyr(funLoc, seed);
      replyText = t('fun.wyr', locale, { text: spoken });
      break;
  }

  // Speech (best-effort): only if Vozen is in the call AND the user is not rate-limited.
  const player = getPlayer(deps, i.guildId!);
  if (player) {
    const admission = admitInteractionSpeech(i, deps);
    if (!admission.allowed) {
      await i.editReply(editCard(replyText));
      return;
    }
    const cfg = getGuildConfig(deps.db, i.guildId!);
    const rl = getLimiter(deps, i.guildId!, cfg.ratePerMin);
    if (rl.allow(i.user.id, Date.now())) {
      const prefix = funLoc === 'pt' ? 'pt_' : 'en_';
      const model =
        deps.availableModels.find((m) => m.startsWith(prefix)) ||
        cfg.defaultVoice ||
        deps.config.defaultVoice ||
        'en_US-amy-medium';
      const stored = getUserVoice(deps.db, i.guildId!, i.user.id);
      const resolvedEngine = resolveUserEngine(
        deps.db,
        i.guildId!,
        i.user.id,
        stored?.engine,
        Date.now(),
      );
      // singleVoice: the phrase's language is KNOWN (the bank), detection doesn't decide.
      void player.say(
        {
          text: spoken,
          model,
          speed: deps.config.defaultSpeed,
          singleVoice: true,
          ...resolvedEngine,
        },
        { authorId: i.user.id, source: 'command', lane: admission.lane },
      );
    }
  }

  await i.editReply(editCard(replyText));
}

/**
 * /birthday set|clear|show — records the birthday (month+day, no year) per-(guild,user).
 * On the day, when the person joins Vozen's call, it says "Happy Birthday" (greetOnJoin). Validates
 * the day/month combination (rejects 31/02 etc.). Ephemeral responses in the user's own locale.
 */
export async function handleBirthday(i: ChatInputCommandInteraction, deps: BotDeps): Promise<void> {
  const locale = localeForUser(deps, i);
  const sub = i.options.getSubcommand();
  if (sub === 'set') {
    const day = i.options.getInteger('day', true);
    const month = i.options.getInteger('month', true);
    if (!isValidBirthday(month, day)) {
      await reply(i, t('birthday.invalid', locale));
      return;
    }
    setBirthday(deps.db, i.guildId!, i.user.id, month, day);
    await reply(i, t('birthday.set', locale, { day, month }));
  } else if (sub === 'clear') {
    clearBirthday(deps.db, i.guildId!, i.user.id);
    await reply(i, t('birthday.cleared', locale));
  } else {
    // show
    const bd = getBirthday(deps.db, i.guildId!, i.user.id);
    await reply(
      i,
      bd
        ? t('birthday.show', locale, { day: bd.day, month: bd.month })
        : t('birthday.none', locale),
    );
  }
}
