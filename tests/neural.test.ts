// tests/neural.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NeuralEngine } from '../src/tts/neural';
import { AudioCache } from '../src/tts/cache';
import type { SynthRequest } from '../src/tts/engine';

const req: SynthRequest = { text: 'ola mundo', model: 'en_US-amy-medium', speed: 1 };

describe('NeuralEngine.synth — caminhos de erro (fetch mockado)', () => {
  let dir: string;
  let cache: AudioCache;
  let engine: NeuralEngine;

  beforeEach(() => {
    // Cache em temp-dir fresca -> get() falha -> chega-se sempre a fetchSpeech.
    dir = mkdtempSync(join(tmpdir(), 'neuralcache-'));
    cache = new AudioCache(dir);
    engine = new NeuralEngine('sk-test', cache);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  it('(a) HTTP non-2xx -> rejeita com status e detalhe na mensagem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'rate limited',
      })),
    );

    await expect(engine.synth(req)).rejects.toThrow(/500/);
    await expect(engine.synth(req)).rejects.toThrow(/rate limited/);
    // Nenhum ficheiro escrito na cache em caso de erro.
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('(b) timeout/abort (AbortController) -> rejeita com mensagem de timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      }),
    );

    await expect(engine.synth(req)).rejects.toThrow(/timeout/);
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('(b2) erro de rede generico -> rejeita com a mensagem do erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    await expect(engine.synth(req)).rejects.toThrow(/Network failure/);
    await expect(engine.synth(req)).rejects.toThrow(/ECONNREFUSED/);
  });

  it('(c) body vazio -> rejeita com "corpo vazio"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    );

    await expect(engine.synth(req)).rejects.toThrow(/empty body/);
    // Body vazio rejeita ANTES de qualquer writeFile -> cache continua vazia.
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('caminho feliz: 2xx com bytes -> resolve com caminho na cache (.wav)', async () => {
    const fakeWav = Buffer.from('RIFF....fake-wav-bytes');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () =>
          fakeWav.buffer.slice(fakeWav.byteOffset, fakeWav.byteOffset + fakeWav.byteLength),
      })),
    );

    const out = await engine.synth(req);
    expect(out).toMatch(/\.wav$/);
    // Segunda chamada deve servir da cache (sem novo fetch).
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const out2 = await engine.synth(req);
    expect(out2).toBe(out);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
