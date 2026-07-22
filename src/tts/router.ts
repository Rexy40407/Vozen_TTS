// src/tts/router.ts
//
// RouterEngine — combines SEVERAL TTS engines into one, choosing per-language and falling
// back to the next when one fails. Each `synth(req)` looks at the language of `req.model`
// (prefix, e.g. 'pt') and tries, IN PRIORITY ORDER, the engines that support that
// language; if one throws (e.g. gTTS with Google HTTP 429), it tries the next. This way:
//   - QUALITY: uses the best available engine for each language (e.g. Kokoro on top).
//   - RELIABILITY: an engine that is down automatically falls back to the next (e.g. gTTS -> Piper).
//   - COVERAGE: a "catch-all" engine (langs=null) at the end guarantees NO language
//     is left without a voice (e.g. Piper, local, covers all 34).
//
// It plugs in as a BASE engine (same TTSEngine contract), under the MultiSegmentEngine:
// in a multilingual message, each segment is routed to the right engine for its language.

import type { SynthRequest, TTSEngine } from './engine';
import { langKeyOfModel } from '../language/spokenPhrases';
import { log } from '../logging/logger';

export interface EngineRoute {
  engine: TTSEngine;
  /**
   * Supported locale prefixes (e.g. new Set(['en','pt','es'])). `null` = CATCH-ALL
   * engine (supports any language) — required at the end of the list.
   */
  langs: Set<string> | null;
  /** Short name for logs (e.g. 'kokoro', 'gtts', 'piper'). */
  label: string;
}

export class RouterEngine implements TTSEngine {
  constructor(private readonly routes: EngineRoute[]) {
    if (routes.length === 0) {
      throw new Error('[router] at least one engine is required');
    }
    // COVERAGE invariant: the last engine must be catch-all (langs=null),
    // otherwise a language with no specific route would fall into a throw. Cheap to guarantee here.
    if (routes[routes.length - 1].langs !== null) {
      throw new Error(
        '[router] the last engine must be a catch-all (langs=null) to guarantee coverage',
      );
    }
  }

  async synth(req: SynthRequest): Promise<string> {
    const key = langKeyOfModel(req.model);
    // Candidates: engines that support this language, in the given priority order.
    const candidates = this.routes.filter((r) => r.langs === null || r.langs.has(key));
    let lastErr: unknown;
    for (let idx = 0; idx < candidates.length; idx++) {
      const route = candidates[idx];
      try {
        return await route.engine.synth(req);
      } catch (err) {
        lastErr = err;
        const next = candidates[idx + 1];
        log.warn(
          `[router] engine '${route.label}' failed for '${key}'` +
            (next ? `; falling back to '${next.label}'` : '; no alternatives remain') +
            `: ${(err as Error).message}`,
        );
      }
    }
    // Only reaches here if ALL candidates failed (the catch-all included).
    throw lastErr ?? new Error(`[router] sem motor para a língua '${key}'`);
  }
}
