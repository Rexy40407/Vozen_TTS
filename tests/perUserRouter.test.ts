import { describe, it, expect, vi } from 'vitest';
import { PerUserEngineRouter } from '../src/tts/perUserRouter';
import { cacheKey } from '../src/tts/cache';
import type { SynthRequest, TTSEngine } from '../src/tts/engine';

function fake(name: string): TTSEngine {
  return { synth: vi.fn(async () => `/wav/${name}.wav`) };
}
const req = (engine?: 'google' | 'piper' | 'kokoro' | 'gcloud'): SynthRequest => ({
  text: 'olá',
  model: 'pt_BR-cadu-medium',
  speed: 1,
  engine,
});

describe('PerUserEngineRouter — despacha por req.engine', () => {
  it("engine='piper' -> Piper", async () => {
    const g = fake('gtts');
    const p = fake('piper');
    const k = fake('kokoro');
    const gc = fake('gcloud');
    const r = new PerUserEngineRouter(g, p, k, gc);
    expect(await r.synth(req('piper'))).toBe('/wav/piper.wav');
    expect(p.synth).toHaveBeenCalledTimes(1);
    expect(g.synth).not.toHaveBeenCalled();
    expect(k.synth).not.toHaveBeenCalled();
    expect(gc.synth).not.toHaveBeenCalled();
  });

  it("engine='piper' cai para gTTS se o Piper falhar", async () => {
    const g = fake('gtts');
    const p: TTSEngine = {
      synth: vi.fn(async () => {
        throw new Error('Modelo Piper nao encontrado');
      }),
    };
    const k = fake('kokoro');
    const gc = fake('gcloud');
    const r = new PerUserEngineRouter(g, p, k, gc);

    expect(await r.synth(req('piper'))).toBe('/wav/gtts.wav');
    expect(p.synth).toHaveBeenCalledTimes(1);
    expect(g.synth).toHaveBeenCalledTimes(1);
    expect(g.synth).toHaveBeenCalledWith(expect.objectContaining({ engine: 'google' }));
    expect(k.synth).not.toHaveBeenCalled();
  });

  it("engine='kokoro' -> Kokoro", async () => {
    const g = fake('gtts');
    const p = fake('piper');
    const k = fake('kokoro');
    const gc = fake('gcloud');
    const r = new PerUserEngineRouter(g, p, k, gc);
    expect(await r.synth(req('kokoro'))).toBe('/wav/kokoro.wav');
    expect(k.synth).toHaveBeenCalledTimes(1);
    expect(g.synth).not.toHaveBeenCalled();
    expect(p.synth).not.toHaveBeenCalled();
    expect(gc.synth).not.toHaveBeenCalled();
  });

  it("engine='gcloud' -> GCloud (Google HD)", async () => {
    const g = fake('gtts');
    const p = fake('piper');
    const k = fake('kokoro');
    const gc = fake('gcloud');
    const r = new PerUserEngineRouter(g, p, k, gc);
    expect(await r.synth(req('gcloud'))).toBe('/wav/gcloud.wav');
    expect(gc.synth).toHaveBeenCalledTimes(1);
    expect(g.synth).not.toHaveBeenCalled();
    expect(p.synth).not.toHaveBeenCalled();
    expect(k.synth).not.toHaveBeenCalled();
  });

  it("engine='google' -> gTTS", async () => {
    const g = fake('gtts');
    const p = fake('piper');
    const k = fake('kokoro');
    const gc = fake('gcloud');
    const r = new PerUserEngineRouter(g, p, k, gc);
    expect(await r.synth(req('google'))).toBe('/wav/gtts.wav');
    expect(g.synth).toHaveBeenCalledTimes(1);
  });

  it('engine ausente -> gTTS (default)', async () => {
    const g = fake('gtts');
    const p = fake('piper');
    const k = fake('kokoro');
    const gc = fake('gcloud');
    const r = new PerUserEngineRouter(g, p, k, gc);
    expect(await r.synth(req(undefined))).toBe('/wav/gtts.wav');
    expect(g.synth).toHaveBeenCalledTimes(1);
    expect(p.synth).not.toHaveBeenCalled();
    expect(k.synth).not.toHaveBeenCalled();
    expect(gc.synth).not.toHaveBeenCalled();
  });
});

describe('cacheKey — separa motores sem invalidar a cache existente', () => {
  it('google e undefined dão a MESMA chave (cache antiga intacta)', () => {
    expect(cacheKey(req('google'))).toBe(cacheKey(req(undefined)));
  });

  it('piper dá chave DIFERENTE (não cruza áudio entre motores)', () => {
    expect(cacheKey(req('piper'))).not.toBe(cacheKey(req('google')));
  });

  it('kokoro dá chave DIFERENTE de google E de piper', () => {
    expect(cacheKey(req('kokoro'))).not.toBe(cacheKey(req('google')));
    expect(cacheKey(req('kokoro'))).not.toBe(cacheKey(req('piper')));
  });

  it('gcloud dá chave DIFERENTE de google, piper E kokoro', () => {
    expect(cacheKey(req('gcloud'))).not.toBe(cacheKey(req('google')));
    expect(cacheKey(req('gcloud'))).not.toBe(cacheKey(req('piper')));
    expect(cacheKey(req('gcloud'))).not.toBe(cacheKey(req('kokoro')));
  });
});
