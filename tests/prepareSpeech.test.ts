import { describe, it, expect } from 'vitest';
import { prepareSpeech, redactRequest, hasReadableText } from '../src/commands/prepareSpeech';
import { emphasisGain } from '../src/tts/emphasis';
import type { SynthRequest } from '../src/tts/engine';

// Model catalog. Automatic language detection is OPT-IN (default OFF): without autoDetect the
// voice is ALWAYS the preferred one; with autoDetect:true it follows the message's language.
const AVAILABLE = ['en_US-amy-medium', 'pt_PT-google-medium', 'es_ES-davefx-medium'];

// Without `as const`: keeping it made `pronunciations` a `readonly []` that does not fit
// the PronunciationEntry[] (mutable) expected by PrepareSpeechInput.
const BASE = {
  pronunciations: [] as { term: string; replacement: string }[],
  userVoice: null,
  available: AVAILABLE,
  defaultVoice: 'en_US-amy-medium',
  defaultSpeed: 1,
};

describe('prepareSpeech — FIXED voice (detection OFF, the default)', () => {
  it('always reads in the preferred voice, singleVoice, no segments — even text in another language', () => {
    const { req } = prepareSpeech({
      ...BASE,
      personal: 'isto e uma frase em portugues bem comprida que ANTES era detetada como portugues',
    });
    // No detection: the voice is the preferred one (.env => en_US-amy), not the text's language.
    expect(req.model).toBe('en_US-amy-medium');
    expect(req.singleVoice).toBe(true);
    expect(req.segments).toBeUndefined();
  });

  it('honors the user voice (user > guild > .env)', () => {
    const { req } = prepareSpeech({
      ...BASE,
      personal: 'texto qualquer',
      userVoice: { model: 'es_ES-davefx-medium', speed: 1.3 },
    });
    expect(req.model).toBe('es_ES-davefx-medium');
    expect(req.speed).toBe(1.3);
    expect(req.singleVoice).toBe(true);
    expect(req.segments).toBeUndefined();
  });

  it('falls back safely when a saved voice model is no longer installed', () => {
    const { req } = prepareSpeech({
      ...BASE,
      personal: 'hello',
      userVoice: { model: 'pt_PT-retired-medium', speed: 1.1 },
    });
    expect(req.model).toBe('en_US-amy-medium');
    expect(req.speed).toBe(1.1);
  });

  it('uses the first installed model when every configured preference is stale', () => {
    const { req } = prepareSpeech({
      ...BASE,
      personal: 'hello',
      userVoice: { model: 'xx_XX-retired-medium', speed: 1 },
      guildDefaultVoice: 'yy_YY-retired-medium',
      defaultVoice: 'zz_ZZ-retired-medium',
    });
    expect(req.model).toBe(AVAILABLE[0]);
  });

  it('expands built-in slang in the spoken text (btw -> by the way)', () => {
    const { req, spoken } = prepareSpeech({ ...BASE, personal: 'brb omg' });
    expect(req.segments).toBeUndefined();
    expect(spoken).toBe('be right back oh my god');
  });
});

describe('prepareSpeech — output cap (anti-amplification)', () => {
  it('caps req.text at 2400 chars; the spoken stays whole (blocklist)', () => {
    const long = 'palavra '.repeat(500); // ~4000 chars
    const { req, spoken } = prepareSpeech({ ...BASE, personal: long });
    expect(req.text.length).toBe(2400); // what goes to synthesis is capped
    expect(spoken.length).toBeGreaterThan(2400); // the spoken (blocklist) is NOT truncated
  });

  it('does not touch normal text (below the cap)', () => {
    const { req } = prepareSpeech({ ...BASE, personal: 'uma frase normal e curta' });
    expect(req.text.length).toBeLessThan(2400);
  });
});

describe('prepareSpeech — announcements (xsaid + media) localized to the voice', () => {
  it('xsaid: "{name} said" prefix in the voice language (EN voice)', () => {
    const { req, spoken } = prepareSpeech({
      ...BASE,
      personal: 'hello there',
      announceSpeaker: 'Alex',
    });
    expect(spoken).toBe('Alex said hello there');
    expect(req.text).toBe('Alex said hello there');
  });

  it('emphasisSource = ONLY the body (without the xsaid name) — anti false-shout', () => {
    // Bug: a name/nickname in UPPERCASE in the xsaid prefix made ALL messages
    // shout. The emphasisSource must be only what the user wrote.
    const { req } = prepareSpeech({
      ...BASE,
      personal: 'hello there',
      announceSpeaker: 'DIOGO', // name in UPPERCASE
    });
    expect(req.text).toBe('DIOGO said hello there'); // the synthesized text carries the name
    expect(req.emphasisSource).toBe('hello there'); // but the emphasis comes only from the body
    expect(emphasisGain(req.emphasisSource ?? req.text)).toBe(1); // calm body -> does not shout
    expect(emphasisGain(req.text)).toBeGreaterThan(1); // the decorated text would shout (old bug)
  });

  it('xsaid localized to the VOICE language: PT voice -> "disse"', () => {
    const { spoken } = prepareSpeech({
      ...BASE,
      personal: 'uma frase qualquer',
      userVoice: { model: 'pt_PT-google-medium', speed: 1 },
      announceSpeaker: 'Alex',
    });
    expect(spoken.startsWith('Alex disse ')).toBe(true);
  });

  it('media: suffix at the end, empty body -> "{name} said a gif"', () => {
    const { spoken } = prepareSpeech({
      ...BASE,
      personal: '',
      announceSpeaker: 'Alex',
      media: [{ kind: 'gif' }],
    });
    expect(spoken).toBe('Alex said a gif');
  });
});

describe('prepareSpeech — /pronunciation overrides the built-in slang list', () => {
  it('pronunciation btw->batata BEATS the slang (not "by the way")', () => {
    const { spoken, req } = prepareSpeech({
      ...BASE,
      personal: 'btw',
      pronunciations: [{ term: 'btw', replacement: 'batata' }],
      userVoice: { model: 'es_ES-davefx-medium', speed: 1 },
    });
    expect(spoken).toBe('batata');
    expect(req.singleVoice).toBe(true);
  });

  it('WITHOUT a pronunciation, btw expands normally to "by the way"', () => {
    const { spoken } = prepareSpeech({
      ...BASE,
      personal: 'btw',
      userVoice: { model: 'es_ES-davefx-medium', speed: 1 },
    });
    expect(spoken).toBe('by the way');
  });
});

describe('hasReadableText — is there a letter or number?', () => {
  it('true when there is a letter/number', () => {
    expect(hasReadableText('abc')).toBe(true);
    expect(hasReadableText('  1  ')).toBe(true);
  });
  it('false when there are only spaces/punctuation', () => {
    expect(hasReadableText('')).toBe(false);
    expect(hasReadableText('   ')).toBe(false);
    expect(hasReadableText('!!! ,. ')).toBe(false);
  });
});

describe('redactRequest — redacts the blocklist in the SynthRequest', () => {
  const base: SynthRequest = { text: 'ola palavrao mundo', model: 'en_US-amy-medium', speed: 1 };

  it('empty blocklist -> req unchanged (same reference)', () => {
    expect(redactRequest(base, [])).toBe(base);
  });

  it('removes the word from req.text', () => {
    const out = redactRequest(base, ['palavrao']);
    expect(out.text).toBe('ola mundo');
    expect(out.model).toBe('en_US-amy-medium');
    expect(out.speed).toBe(1);
  });

  it('redacts each segment and keeps those left with text', () => {
    const req: SynthRequest = {
      text: 'ola palavrao hi',
      model: 'en_US-amy-medium',
      speed: 1,
      segments: [
        { text: 'ola palavrao', model: 'pt_PT-google-medium' },
        { text: 'hi', model: 'en_US-amy-medium' },
      ],
    };
    const out = redactRequest(req, ['palavrao']);
    expect(out.segments).toEqual([
      { text: 'ola', model: 'pt_PT-google-medium' },
      { text: 'hi', model: 'en_US-amy-medium' },
    ]);
  });

  it('a segment left with nothing readable is removed', () => {
    const req: SynthRequest = {
      text: 'palavrao hi',
      model: 'en_US-amy-medium',
      speed: 1,
      segments: [
        { text: 'palavrao', model: 'pt_PT-google-medium' },
        { text: 'hi', model: 'en_US-amy-medium' },
      ],
    };
    const out = redactRequest(req, ['palavrao']);
    expect(out.segments).toEqual([{ text: 'hi', model: 'en_US-amy-medium' }]);
  });

  it('if all segments become empty, segments turns undefined', () => {
    const req: SynthRequest = {
      text: 'palavrao',
      model: 'en_US-amy-medium',
      speed: 1,
      segments: [{ text: 'palavrao', model: 'pt_PT-google-medium' }],
    };
    const out = redactRequest(req, ['palavrao']);
    expect(out.segments).toBeUndefined();
    expect(hasReadableText(out.text)).toBe(false); // caller does not speak
  });
});

describe('prepareSpeech — detection ON (opt-in via /voice detection)', () => {
  it('takes the detection path (no singleVoice) and the voice follows the message language', () => {
    const ptText =
      'bom dia a todos isto aqui e uma frase bem comprida escrita em portugues de portugal para nao restar duvida nenhuma sobre a lingua desta mensagem';
    const { req } = prepareSpeech({ ...BASE, autoDetect: true, personal: ptText });
    // Structural proof the ON branch ran: it never sets singleVoice.
    expect(req.singleVoice).toBeUndefined();
    // The voice is picked for the DETECTED language (PT), not the .env default (EN).
    expect(req.model.startsWith('pt_')).toBe(true);
  });

  it('OFF (default) keeps the fixed voice even for clearly foreign text', () => {
    const { req } = prepareSpeech({
      ...BASE,
      // autoDetect omitted => OFF (undefined)
      personal: 'isto e claramente portugues de portugal sem qualquer duvida',
    });
    expect(req.model).toBe('en_US-amy-medium');
    expect(req.singleVoice).toBe(true);
  });
});
