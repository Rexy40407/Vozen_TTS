// src/tts/perUserRouter.ts
//
// Routes each synthesis request to the user's selected engine. The historical `google`
// value means "configured default" for database compatibility; that default is local
// Piper unless the operator explicitly selects a legacy gTTS mode.

import type { SynthRequest, TTSEngine } from './engine';
import { log } from '../logging/logger';

export class PerUserEngineRouter implements TTSEngine {
  constructor(
    private readonly defaultEngine: TTSEngine,
    private readonly piper: TTSEngine,
    private readonly kokoro: TTSEngine,
    private readonly gcloud: TTSEngine,
  ) {}

  async synth(req: SynthRequest): Promise<string> {
    if (req.engine === 'kokoro') return this.kokoro.synth(req);
    if (req.engine === 'gcloud') return this.gcloud.synth(req);
    if (req.engine !== 'piper') return this.defaultEngine.synth(req);

    try {
      return await this.piper.synth(req);
    } catch (err) {
      if (this.defaultEngine === this.piper) throw err;
      log.warn(
        `[tts] Piper failed for ${req.model}; using the configured fallback: ${(err as Error).message}`,
      );
      return this.defaultEngine.synth({ ...req, engine: 'google' });
    }
  }
}
