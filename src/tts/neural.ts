// src/tts/neural.ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { rmDirSafe } from './cleanupDir';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SynthRequest, TTSEngine } from './engine';
import { AudioCache, cacheKey } from './cache';
import { lowerAllCapsRuns } from './deCaps';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_MODEL = 'tts-1';
const NEURAL_TIMEOUT_MS = 15000;

/** Vozes validas da API OpenAI tts-1. */
const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
const DEFAULT_OPENAI_VOICE = 'alloy';

/**
 * `req.model` e um id de voz Piper (ex. 'en_US-amy-medium'), nao uma voz OpenAI.
 * Se o id contiver o nome de uma voz OpenAI valida (ex. um futuro
 * 'openai-nova'), usa-a; caso contrario cai na voz default. Mapeamento simples
 * e deterministico — a sintese real e verificacao ao vivo pendente.
 */
function mapVoice(model: string): string {
  const lower = model.toLowerCase();
  const match = OPENAI_VOICES.find((v) => lower.includes(v));
  return match ?? DEFAULT_OPENAI_VOICE;
}

/**
 * Motor TTS neural premium (OpenAI tts-1) atras da flag TTS_ENGINE=neural.
 * Implementa a MESMA interface TTSEngine do Piper e partilha a MESMA AudioCache
 * (cache por cacheKey). Pede sempre formato 'wav' para alinhar com o pipeline
 * existente (AudioCache guarda .wav e o player espera wav).
 *
 * Sintese real = verificacao ao vivo pendente (precisa de OPENAI_API_KEY).
 */
export class NeuralEngine implements TTSEngine {
  private readonly apiKey: string;
  private readonly cache: AudioCache;

  constructor(apiKey: string, cache: AudioCache) {
    this.apiKey = apiKey;
    this.cache = cache;
  }

  async synth(req: SynthRequest): Promise<string> {
    const key = cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const audio = await this.fetchSpeech(req);

    const workDir = mkdtempSync(join(tmpdir(), 'neural-'));
    const outPath = join(workDir, 'out.wav');
    try {
      writeFileSync(outPath, audio);
      return this.cache.put(key, outPath);
    } finally {
      rmDirSafe(workDir);
    }
  }

  private async fetchSpeech(req: SynthRequest): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NEURAL_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(OPENAI_TTS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          voice: mapVoice(req.model),
          // lowerAllCapsRuns: evita que um "grito" em MAIÚSCULAS saia soletrado (ver
          // deCaps.ts). A chave de cache usa o req ORIGINAL.
          input: lowerAllCapsRuns(req.text),
          speed: req.speed > 0 ? req.speed : 1,
          response_format: 'wav',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const reason =
        (err as Error)?.name === 'AbortError'
          ? `timeout (${NEURAL_TIMEOUT_MS}ms)`
          : (err as Error).message;
      throw new Error(`Network failure while contacting the OpenAI TTS API: ${reason}`, {
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `API OpenAI TTS devolveu ${res.status} ${res.statusText}${detail ? `: ${detail.trim()}` : ''}`,
      );
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      throw new Error('OpenAI TTS API returned an empty body');
    }
    return buf;
  }
}
