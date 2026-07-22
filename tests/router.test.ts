import { describe, it, expect, vi } from 'vitest';
import { RouterEngine, type EngineRoute } from '../src/tts/router';
import type { SynthRequest, TTSEngine } from '../src/tts/engine';

// Fake engine: returns an identifiable path, or throws if `fail`.
function fakeEngine(name: string, fail = false): TTSEngine {
  return {
    synth: vi.fn(async (_req: SynthRequest) => {
      if (fail) throw new Error(`${name} falhou`);
      return `/wav/${name}.wav`;
    }),
  };
}

const req = (model: string): SynthRequest => ({ text: 'olá', model, speed: 1 });

describe('RouterEngine — construction', () => {
  it('requires at least one engine', () => {
    expect(() => new RouterEngine([])).toThrow(/at least one engine/);
  });

  it('requires the last engine to be catch-all (langs=null)', () => {
    const routes: EngineRoute[] = [
      { engine: fakeEngine('kokoro'), langs: new Set(['pt']), label: 'kokoro' },
    ];
    expect(() => new RouterEngine(routes)).toThrow(/catch-all/);
  });
});

describe('RouterEngine — routing by language', () => {
  it('uses the language-specific engine when it exists', async () => {
    const kokoro = fakeEngine('kokoro');
    const piper = fakeEngine('piper');
    const r = new RouterEngine([
      { engine: kokoro, langs: new Set(['pt', 'en']), label: 'kokoro' },
      { engine: piper, langs: null, label: 'piper' },
    ]);
    expect(await r.synth(req('pt_BR-cadu-medium'))).toBe('/wav/kokoro.wav');
    expect(kokoro.synth).toHaveBeenCalledTimes(1);
    expect(piper.synth).not.toHaveBeenCalled();
  });

  it('falls back to the catch-all when the language is not supported above', async () => {
    const kokoro = fakeEngine('kokoro');
    const piper = fakeEngine('piper');
    const r = new RouterEngine([
      { engine: kokoro, langs: new Set(['pt', 'en']), label: 'kokoro' },
      { engine: piper, langs: null, label: 'piper' },
    ]);
    // 'de' (German) is not in Kokoro -> goes straight to Piper.
    expect(await r.synth(req('de_DE-thorsten-medium'))).toBe('/wav/piper.wav');
    expect(kokoro.synth).not.toHaveBeenCalled();
    expect(piper.synth).toHaveBeenCalledTimes(1);
  });
});

describe('RouterEngine — fallback on FAILURE', () => {
  it('gTTS fails -> serves Piper (same language)', async () => {
    const gtts = fakeEngine('gtts', true); // fails (e.g. Google HTTP 429)
    const piper = fakeEngine('piper');
    const r = new RouterEngine([
      { engine: gtts, langs: null, label: 'gtts' },
      { engine: piper, langs: null, label: 'piper' },
    ]);
    expect(await r.synth(req('pt_BR-cadu-medium'))).toBe('/wav/piper.wav');
    expect(gtts.synth).toHaveBeenCalledTimes(1);
    expect(piper.synth).toHaveBeenCalledTimes(1);
  });

  it('traverses several failing engines until one works', async () => {
    const kokoro = fakeEngine('kokoro', true);
    const gtts = fakeEngine('gtts', true);
    const piper = fakeEngine('piper');
    const r = new RouterEngine([
      { engine: kokoro, langs: new Set(['pt']), label: 'kokoro' },
      { engine: gtts, langs: null, label: 'gtts' },
      { engine: piper, langs: null, label: 'piper' },
    ]);
    expect(await r.synth(req('pt_BR-cadu-medium'))).toBe('/wav/piper.wav');
  });

  it('all fail -> propagates the last error', async () => {
    const gtts = fakeEngine('gtts', true);
    const piper = fakeEngine('piper', true);
    const r = new RouterEngine([
      { engine: gtts, langs: null, label: 'gtts' },
      { engine: piper, langs: null, label: 'piper' },
    ]);
    await expect(r.synth(req('pt_BR-cadu-medium'))).rejects.toThrow(/piper falhou/);
  });
});
