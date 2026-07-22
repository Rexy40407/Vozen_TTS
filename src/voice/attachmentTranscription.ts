import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import type { Transcript } from './whisperTranscriber';

/** Safe, IO-free admission gate for Discord-attachment transcription. */
export interface DiscordAudioAttachment {
  url: string;
  contentType: string | null | undefined;
  size: number;
}

export type AttachmentAdmission =
  { ok: true; url: URL } | { ok: false; reason: 'host' | 'type' | 'size' | 'url' };

const DISCORD_CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/webm',
]);

/**
 * No network request happens here. The command must use this before downloading, then enforce
 * an ffmpeg-derived duration cap with a timeout. Arbitrary URLs and browser/User-App contexts
 * are structurally excluded because the only accepted hosts are Discord's attachment CDNs.
 */
export function admitDiscordAudioAttachment(
  attachment: DiscordAudioAttachment,
  maxBytes: number,
): AttachmentAdmission {
  let url: URL;
  try {
    url = new URL(attachment.url);
  } catch {
    return { ok: false, reason: 'url' };
  }
  if (url.protocol !== 'https:' || !DISCORD_CDN_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: 'host' };
  }
  const type = attachment.contentType?.split(';', 1)[0].trim().toLowerCase();
  if (!type || !AUDIO_TYPES.has(type)) return { ok: false, reason: 'type' };
  if (!Number.isSafeInteger(attachment.size) || attachment.size < 1 || attachment.size > maxBytes) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true, url };
}

/** Kept separate from the CDN gate so a future local ffprobe adapter can be timeout-tested. */
export function withinAttachmentDuration(durationSeconds: number, maxSeconds: number): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= maxSeconds;
}

export interface AttachmentWorkspace {
  inputPath: string;
  wavPath: string;
  cleanup: () => Promise<void>;
}

export interface AttachmentTranscriptionDeps {
  maxBytes: number;
  maxSeconds: number;
  createWorkspace?: () => Promise<AttachmentWorkspace>;
  download?: (url: URL, destination: string, maxBytes: number) => Promise<void>;
  transcode?: (inputPath: string, wavPath: string, maxSeconds: number) => Promise<number>;
  transcribe: (wavPath: string) => Promise<Transcript>;
}

export type AttachmentTranscriptionResult =
  | { ok: true; text: string; language: string; durationMs: number }
  | { ok: false; reason: 'host' | 'type' | 'size' | 'url' | 'duration' | 'processing' };

const DOWNLOAD_TIMEOUT_MS = 15_000;
const TRANSCODE_TIMEOUT_MS = 20_000;

async function createDefaultWorkspace(): Promise<AttachmentWorkspace> {
  const dir = await mkdtemp(join(tmpdir(), 'vozen-attachment-stt-'));
  return {
    inputPath: join(dir, 'input.audio'),
    wavPath: join(dir, 'output.wav'),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

/** Downloads one already-admitted CDN object with both declared and actual byte caps. */
async function downloadDiscordAttachment(
  url: URL,
  destination: string,
  maxBytes: number,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('attachment download failed');
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error('attachment too large');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1 || bytes.length > maxBytes) throw new Error('attachment too large');
    await writeFile(destination, bytes, { flag: 'wx' });
  } finally {
    clearTimeout(timer);
  }
}

function waitForFfmpeg(child: ChildProcess): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let stderr = '';
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
      finish(new Error('attachment conversion timed out'));
    }, TRANSCODE_TIMEOUT_MS);
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 4_096) stderr += chunk.toString('utf8').slice(0, 4_096 - stderr.length);
    });
    child.once('error', () => finish(new Error('attachment conversion failed')));
    child.once('close', (code) =>
      finish(code === 0 ? undefined : new Error(`attachment conversion exited ${code}: ${stderr}`)),
    );
  });
}

/** Converts to fixed PCM so duration can be derived without trusting attachment metadata. */
async function transcodeAttachment(
  inputPath: string,
  wavPath: string,
  maxSeconds: number,
): Promise<number> {
  const ffmpeg = ffmpegStatic as unknown as string | null;
  if (!ffmpeg) throw new Error('ffmpeg unavailable');
  const child = spawn(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-t',
      String(maxSeconds + 1),
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
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  await waitForFfmpeg(child);
  const info = await stat(wavPath);
  // PCM s16le, 24 kHz mono = 48,000 data bytes/s. The canonical header is 44 bytes.
  return Math.max(0, info.size - 44) / 48_000;
}

/** Complete bounded pipeline. Temporary source and WAV files are removed on every outcome. */
export async function transcribeDiscordAudioAttachment(
  attachment: DiscordAudioAttachment,
  deps: AttachmentTranscriptionDeps,
): Promise<AttachmentTranscriptionResult> {
  const admission = admitDiscordAudioAttachment(attachment, deps.maxBytes);
  if (!admission.ok) return admission;
  let workspace: AttachmentWorkspace | undefined;
  try {
    workspace = await (deps.createWorkspace ?? createDefaultWorkspace)();
    await (deps.download ?? downloadDiscordAttachment)(
      admission.url,
      workspace.inputPath,
      deps.maxBytes,
    );
    const duration = await (deps.transcode ?? transcodeAttachment)(
      workspace.inputPath,
      workspace.wavPath,
      deps.maxSeconds,
    );
    if (!withinAttachmentDuration(duration, deps.maxSeconds))
      return { ok: false, reason: 'duration' };
    const transcript = await deps.transcribe(workspace.wavPath);
    return {
      ok: true,
      text: transcript.text.trim(),
      language: transcript.lang,
      durationMs: Math.round(duration * 1_000),
    };
  } catch {
    return { ok: false, reason: 'processing' };
  } finally {
    await workspace?.cleanup().catch(() => {});
  }
}
