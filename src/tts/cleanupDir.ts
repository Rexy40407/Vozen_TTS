import { rmSync } from 'node:fs';
import { log } from '../logging/logger';

/**
 * Removes a temporary directory recursively in a way that NEVER throws. `rmSync` with
 * `force:true` only swallows ENOENT — NOT a file in use (EPERM/EBUSY on Windows,
 * when a piper/ffmpeg process was just killed and the OS hasn't released the
 * handle yet). If that happens in a `finally`, the cleanup error:
 *   1. MASKS the original rejection (e.g. "Piper timeout" becomes "EPERM"), and
 *   2. can turn a SUCCESSFUL synthesis (the WAV was already copied to the cache)
 *      into a rejection, leaving the message mute due to a cleanup error.
 * So cleanup lives here, wrapped in try/catch — the same pattern that
 * `mp3ToWav`'s (gtts) `cleanup()` already uses. A leaked temp dir is logged and forgotten,
 * never propagated.
 */
export function rmDirSafe(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    log.warn(`[tts] failed to clean temporary directory ${dir} (ignored)`, err);
  }
}
