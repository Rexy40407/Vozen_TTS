import {
  langKeyOfModel,
  spokenPhrasesFor,
  buildMediaSuffix,
  type MediaItem,
} from '../language/spokenPhrases';
import { expandAbbreviations, splitEnglishSlang } from '../textCleaning/abbreviations';
import { detectLangDetailed } from '../language/detect';
import { pickVoiceForLang } from '../language/voiceMap';
import { restoreAccents, accentLangOfModel } from '../textCleaning/accents';
import { applyPronunciation, type PronunciationEntry } from '../textCleaning/pronunciation';
import { redactBlocked } from '../moderation/filter';
import type { SynthRequest } from '../tts/engine';

/** Is there at least one letter or number (something readable to speak)? */
export function hasReadableText(s: string): boolean {
  return /[\p{L}\p{N}]/u.test(s);
}

/**
 * Applies the blocklist REDACTION to a SynthRequest: removes the blocked words from the text
 * to synthesize (req.text) and from each segment (multi-voice synthesis), keeping the rest —
 * Vozen reads the message WITHOUT saying the banned words. Segments left with nothing readable
 * are removed. Empty blocklist -> req unchanged. If the result ends up with nothing readable,
 * the caller detects it (hasReadableText) and does not speak. PURE.
 */
export function redactRequest(req: SynthRequest, blocklist: string[]): SynthRequest {
  if (blocklist.length === 0) return req;
  const text = redactBlocked(req.text, blocklist);
  const segments = req.segments
    ?.map((s) => ({ ...s, text: redactBlocked(s.text, blocklist) }))
    .filter((s) => hasReadableText(s.text));
  return { ...req, text, segments: segments && segments.length > 0 ? segments : undefined };
}

export interface PrepareSpeechInput {
  /** Text ALREADY with the user's PERSONAL abbreviations applied (before the EN expansion). */
  personal: string;
  /** The author's PERSONAL pronunciations (getUserPronunciations) — individual since plan v4. */
  pronunciations: PronunciationEntry[];
  userVoice: { model: string; speed: number } | null;
  available: string[];
  /** Per-user AUTOMATIC language detection toggle. Default OFF (undefined/false = fixed
   *  voice); opt-in via /voice detection. When true, the message's language is detected and
   *  the voice is picked per detected language / per slang segment. */
  autoDetect?: boolean;
  /** Per-guild default voice (`default_voice`); empty = the guild did not set one. */
  guildDefaultVoice?: string;
  /** Global default voice from .env (DEFAULT_VOICE). */
  defaultVoice: string;
  defaultSpeed: number;
  /**
   * Media to ANNOUNCE at the end of the speech (links, gifs, attachments by type, stickers).
   * It is appended AFTER the voice is resolved and localized in the LANGUAGE OF THAT voice
   * (e.g. gif -> "a gif" in a PT voice). It does not go through slang/pronunciation (they are
   * our own words, already correct) and does NOT enter language detection (that runs only over
   * `personal`).
   */
  media?: MediaItem[];
  /**
   * The author's name to announce BEFORE the message — the "xsaid": "{name} said …".
   * Empty/undefined = no announcement (xsaid OFF or not applicable, e.g. /tts). The "said" is
   * localized in the voice's language (spokenPhrases.said); the name comes out as-is.
   */
  announceSpeaker?: string;
}

export interface PreparedSpeech {
  /** SPOKEN text (expanded slang + pronunciation), used for the blocklist. */
  spoken: string;
  /** Synthesis request already with the voice resolved. */
  req: SynthRequest;
}

/**
 * Transforms the text (already with personal abbreviations) into a SynthRequest, resolving the
 * voice — and, when detection is ON and the message MIXES a base language with known EN slang
 * (btw, lol, omg...), it produces MIXED VOICES: the non-slang part is detected on its own and
 * spoken in the detected language's voice; the EN slang is a SEPARATE segment in an English
 * voice. It replaces "btw"->"by the way" polluting the detection and reading the whole message
 * in one voice (often the wrong one).
 *
 * Pronunciation happens HERE (before the upstream blocklist runs over `spoken`).
 * PURE: no side effects.
 */
/**
 * HARD character cap on the text that goes to SYNTHESIS. cleanText limits the INPUT text
 * (`maxChars` ≤ 2000), but the downstream expansions (pronunciation, EN slang, accents, xsaid
 * prefix + media suffix) GROW the string without re-capping. Without this cap, a 2000-char
 * message of slang ("imho imho…") would expand ~5× → ~10k chars → chunkText split that into
 * ~50 HTTP requests to gTTS for ONE message → a Google 429 for the whole guild
 * (amplification/auto-DoS). 2400 gives room for the legitimate expansions over an input at the
 * max (2000) + announcements, and limits the fan-out to ~12 requests/message.
 */
const MAX_SYNTH_CHARS = 2400;

/**
 * Applies the output cap to `req` (text and segments) — what is effectively synthesized. Does
 * NOT touch `spoken` (used by the downstream blocklist), so as not to lose precision in the
 * blocked-word check. Truncates by CODE POINT (surrogate-safe).
 */
function capSynth(result: PreparedSpeech): PreparedSpeech {
  const text = result.req.text;
  if (text.length <= MAX_SYNTH_CHARS) return result;
  const req: SynthRequest = {
    ...result.req,
    text: Array.from(text).slice(0, MAX_SYNTH_CHARS).join(''),
  };
  if (req.segments && req.segments.length > 0) {
    const kept: { text: string; model: string }[] = [];
    let budget = MAX_SYNTH_CHARS;
    for (const seg of req.segments) {
      if (budget <= 0) break;
      const cps = Array.from(seg.text);
      if (cps.length <= budget) {
        kept.push(seg);
        budget -= cps.length;
      } else {
        kept.push({ text: cps.slice(0, budget).join(''), model: seg.model });
        budget = 0;
      }
    }
    req.segments = kept;
  }
  return { ...result, req };
}

export function prepareSpeech(input: PrepareSpeechInput): PreparedSpeech {
  return capSynth(decorateAnnouncements(prepareSpeechCore(input), input));
}

/**
 * Wraps the already-resolved speech with the ANNOUNCEMENTS, both localized in the BASE VOICE's
 * language (`req.model`) — the same voice that speaks the message says them:
 *   - xsaid PREFIX: "{name} {said}" (who spoke), when `announceSpeaker` is present.
 *   - media SUFFIX: "…a gif" at the end, when there is `media`.
 * Result: "{name} said {body} {media}". In the MIXED path (with `segments`) the announcements
 * enter as extra segments in the base voice — otherwise they would not be spoken (the engine
 * uses `segments`, not `text`). `text` always carries everything (single-voice fallback + cache
 * base). Empty body (e.g. just a gif) -> "{name} said a gif". PURE. With no announcements ->
 * returns the result intact.
 */
function decorateAnnouncements(result: PreparedSpeech, input: PrepareSpeechInput): PreparedSpeech {
  const phrases = spokenPhrasesFor(langKeyOfModel(result.req.model));
  const name = input.announceSpeaker?.trim();
  const prefix = name ? `${name} ${phrases.said}` : '';
  const suffix =
    input.media && input.media.length > 0 ? buildMediaSuffix(input.media, phrases) : '';
  if (!prefix && !suffix) return result;

  const spoken = [prefix, result.spoken, suffix].filter((s) => s && s.length > 0).join(' ');
  const req: SynthRequest = { ...result.req, text: spoken };
  if (req.segments && req.segments.length > 0) {
    const model = result.req.model;
    req.segments = [
      ...(prefix ? [{ text: prefix, model }] : []),
      ...req.segments,
      ...(suffix ? [{ text: suffix, model }] : []),
    ];
  }
  return { ...result, spoken, req };
}

function prepareSpeechCore(input: PrepareSpeechInput): PreparedSpeech {
  const speed = input.userVoice ? input.userVoice.speed : input.defaultSpeed;
  const configured = [input.userVoice?.model, input.guildDefaultVoice, input.defaultVoice].filter(
    (model): model is string => Boolean(model),
  );
  const preferred =
    configured.find((model) => input.available.includes(model)) ??
    input.available[0] ??
    configured[0] ??
    'en_US-amy-medium';

  // Detection OFF (the DEFAULT): the chosen voice (user > guild > .env > amy) reads
  // EVERYTHING, singleVoice, without detecting the text's language or splitting by segment —
  // the person always sounds the same. Accent restoration uses the language of the VOICE
  // (not the text): "nao"->"não" if the voice is PT. ORDER: guild pronunciation BEFORE the
  // built-in slang — so a /pronunciation like btw->batata WINS over "by the way". Final
  // precedence (personal already applied upstream): personal > /pronunciation > slang.
  if (!input.autoDetect) {
    const spokenRaw = expandAbbreviations(applyPronunciation(input.personal, input.pronunciations));
    const spoken = restoreAccents(spokenRaw, accentLangOfModel(preferred));
    return {
      spoken,
      req: { text: spoken, model: preferred, speed, singleVoice: true, emphasisSource: spoken },
    };
  }

  // Detection ON (opt-in via /voice detection). Guild pronunciation FIRST — before slang
  // splitting — so a /pronunciation like btw->batata stops being "slang" and does NOT create
  // a separate EN segment (it comes out in the base voice). Then split by slang and expand
  // each part. Precedence: personal (upstream) > /pronunciation > built-in slang.
  const pronounced = applyPronunciation(input.personal, input.pronunciations);
  const rawSegs = splitEnglishSlang(pronounced);
  const proc0 = rawSegs.map((seg) => ({
    isEnglish: seg.isEnglish,
    text: expandAbbreviations(seg.text),
  }));

  // Base language = detection of the NON-slang part only (EN slang does not pollute it).
  const baseText = proc0
    .filter((s) => !s.isEnglish)
    .map((s) => s.text)
    .join(' ');
  const { lang: baseLang } = detectLangDetailed(baseText);

  // Per-segment accent restoration, in each one's language (base for non-slang; EN slang has
  // no dictionary -> no-op). E.g. PT "nao"->"não", "amanha"->"amanhã".
  const procSegs = proc0.map((s) => ({
    isEnglish: s.isEnglish,
    text: restoreAccents(s.text, s.isEnglish ? 'eng' : baseLang),
  }));
  const spoken = procSegs.map((s) => s.text).join(' ');

  const hasEng = procSegs.some((s) => s.isEnglish);
  const hasOther = procSegs.some((s) => !s.isEnglish);

  // No EN slang (the common case): a single voice of the base language. Also covers empty
  // `personal` (procSegs [], spoken '') -> a single-voice req with the preferred voice.
  if (!hasEng) {
    const model = pickVoiceForLang(baseLang, input.available, preferred);
    return { spoken, req: { text: spoken, model, speed, emphasisSource: spoken } };
  }

  // Only EN slang: a single English voice.
  if (!hasOther) {
    const model = pickVoiceForLang('eng', input.available, preferred);
    return { spoken, req: { text: spoken, model, speed, emphasisSource: spoken } };
  }

  // MIXED: each segment with its own voice (slang -> EN, rest -> base language). The top-level
  // req.model/text are the single-voice fallback + cache base; MultiSegmentEngine concatenates.
  const segments = procSegs.map((s) => ({
    text: s.text,
    model: pickVoiceForLang(s.isEnglish ? 'eng' : baseLang, input.available, preferred),
  }));
  const baseModel = pickVoiceForLang(baseLang, input.available, preferred);
  return {
    spoken,
    req: { text: spoken, model: baseModel, speed, segments, emphasisSource: spoken },
  };
}
