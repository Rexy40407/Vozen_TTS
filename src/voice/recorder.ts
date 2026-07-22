// src/voice/recorder.ts
//
// PCM -> WAV conversion for the voice pipeline. `pcmToWavFile` turns raw captured PCM
// (s16le 48k stereo) into the 24kHz mono WAV format used downstream (e.g. /transcribe).

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { rmDirSafe } from '../tts/cleanupDir';

const FF_TIMEOUT_MS = 20_000;

export interface PcmToWavDeps {
  ffmpegPath?: string | null;
  spawnImpl?: typeof spawn;
}

/**
 * Converts the raw PCM (s16le 48k stereo) into a 24kHz mono WAV — the downstream reference
 * format — and writes it to `outPath` (creates the directory). Same ffmpeg runner pattern
 * as the rest of the pipeline: temp dir, timeout+kill, best-effort cleanup.
 */
export function pcmToWavFile(
  pcm: Buffer,
  outPath: string,
  deps: PcmToWavDeps = {},
): Promise<string> {
  const ff = (deps.ffmpegPath ?? (ffmpegStatic as unknown as string | null)) as string | null;
  const spawnImpl = deps.spawnImpl ?? spawn;
  if (!ff) return Promise.reject(new Error('recorder: ffmpeg-static not found'));

  const workDir = mkdtempSync(join(tmpdir(), 'vozen-rec-'));
  const rawPath = join(workDir, 'in.raw');
  const wavPath = join(workDir, 'out.wav');
  try {
    writeFileSync(rawPath, pcm);
  } catch (err) {
    rmDirSafe(workDir);
    throw err;
  }
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    's16le',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-i',
    rawPath,
    '-ar',
    '24000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    '-f',
    'wav',
    wavPath,
    '-y',
  ];

  return new Promise<string>((resolve, reject) => {
    const child = spawnImpl(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // already dead
      }
      reject(new Error(`recorder: ffmpeg excedeu ${FF_TIMEOUT_MS}ms`));
      rmDirSafe(workDir);
    }, FF_TIMEOUT_MS);
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`recorder: falha ao iniciar ffmpeg: ${err.message}`));
      rmDirSafe(workDir);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`recorder: ffmpeg saiu com ${code}: ${stderr.trim()}`));
        rmDirSafe(workDir);
        return;
      }
      try {
        mkdirSync(dirname(outPath), { recursive: true });
        copyFileSync(wavPath, outPath);
        resolve(outPath);
      } catch (err) {
        reject(err as Error);
      } finally {
        rmDirSafe(workDir);
      }
    });
  });
}
