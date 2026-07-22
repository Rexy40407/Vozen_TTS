// src/voice/whisperSidecar.ts
//
// Command resolution for the STT SIDECAR (local Whisper, Phase 4). Mirrors
// resolveKokoroCmd: auto-detects the Python venv + the sidecar script in tools/. If
// anything is missing it returns null (=> STT stays INERT; the transcription command
// replies "unavailable" instead of crashing). The sidecar (tools/whisper_sidecar.py) is a
// PERSISTENT process that loads the faster-whisper model ONCE and transcribes N requests
// (kokoro sidecar pattern).
//
// Spike (docs/SPIKE-STT.md): faster-whisper `base` int8 on the VPS = ~2.2s per ~13.6s of
// speech, well below the 5s threshold. `base` is the default (best accuracy; latency to spare).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Default Whisper model (see spike). Overridable via WHISPER_MODEL in the env. */
export const DEFAULT_WHISPER_MODEL = 'base';

export interface ResolveWhisperDeps {
  /** Injectable in tests; in production it's fs.existsSync. */
  exists?: (p: string) => boolean;
  /** Project root; defaults to process.cwd(). */
  cwd?: string;
}

/**
 * Resolves the Whisper sidecar command. `model` = model size (tiny/base/small…).
 * Returns `{ exe, args }` (exe = venv python; args = [script, model]) or null if the venv
 * or the script don't exist on this instance. PURE (only does existsSync).
 */
export function resolveWhisperCmd(
  model: string = DEFAULT_WHISPER_MODEL,
  deps: ResolveWhisperDeps = {},
): { exe: string; args: string[] } | null {
  const exists = deps.exists ?? existsSync;
  const cwd = deps.cwd ?? process.cwd();
  // The venv python: Scripts/python.exe (Windows) or bin/python (Linux/VPS) — tries both.
  const venvPy = [
    join(cwd, 'tools', 'whisper-venv', 'Scripts', 'python.exe'),
    join(cwd, 'tools', 'whisper-venv', 'bin', 'python'),
  ].find((p) => exists(p));
  const script = join(cwd, 'tools', 'whisper_sidecar.py');
  if (!venvPy || !exists(script)) return null;
  return { exe: venvPy, args: [script, '--model', String(model)] };
}
