import { describe, expect, it } from 'vitest';
import {
  admitDiscordAudioAttachment,
  transcribeDiscordAudioAttachment,
  withinAttachmentDuration,
} from '../src/voice/attachmentTranscription';
import { vi } from 'vitest';

describe('attachment transcription admission', () => {
  const valid = {
    url: 'https://cdn.discordapp.com/attachments/1/2/audio.ogg',
    contentType: 'audio/ogg',
    size: 10,
  };

  it('accepts a bounded Discord CDN audio attachment', () => {
    expect(admitDiscordAudioAttachment(valid, 20).ok).toBe(true);
  });

  it('rejects arbitrary host, unsupported content type and oversized input before download', () => {
    expect(
      admitDiscordAudioAttachment({ ...valid, url: 'https://example.com/audio.ogg' }, 20),
    ).toMatchObject({ ok: false, reason: 'host' });
    expect(admitDiscordAudioAttachment({ ...valid, contentType: 'text/plain' }, 20)).toMatchObject({
      ok: false,
      reason: 'type',
    });
    expect(admitDiscordAudioAttachment({ ...valid, size: 21 }, 20)).toMatchObject({
      ok: false,
      reason: 'size',
    });
  });

  it('keeps duration validation local and finite', () => {
    expect(withinAttachmentDuration(30, 30)).toBe(true);
    expect(withinAttachmentDuration(31, 30)).toBe(false);
    expect(withinAttachmentDuration(Number.NaN, 30)).toBe(false);
  });

  it('downloads, converts and transcribes an admitted attachment, then always cleans up', async () => {
    const cleanup = vi.fn(async () => {});
    const download = vi.fn(async () => {});
    const transcode = vi.fn(async () => 12);
    const transcribe = vi.fn(async () => ({ text: 'hello world', lang: 'en' }));

    const result = await transcribeDiscordAudioAttachment(valid, {
      maxBytes: 20,
      maxSeconds: 30,
      createWorkspace: async () => ({
        inputPath: 'private-input',
        wavPath: 'private-wav',
        cleanup,
      }),
      download,
      transcode,
      transcribe,
    });

    expect(result).toEqual({ ok: true, text: 'hello world', language: 'en', durationMs: 12_000 });
    expect(download).toHaveBeenCalledWith(new URL(valid.url), 'private-input', 20);
    expect(transcode).toHaveBeenCalledWith('private-input', 'private-wav', 30);
    expect(transcribe).toHaveBeenCalledWith('private-wav');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('rejects before IO and cleans up a failed transcription', async () => {
    const download = vi.fn(async () => {});
    const cleanup = vi.fn(async () => {});
    const invalid = await transcribeDiscordAudioAttachment(
      { ...valid, url: 'https://evil.example/audio.ogg' },
      {
        maxBytes: 20,
        maxSeconds: 30,
        createWorkspace: vi.fn(),
        download,
        transcode: vi.fn(),
        transcribe: vi.fn(),
      },
    );
    expect(invalid).toEqual({ ok: false, reason: 'host' });
    expect(download).not.toHaveBeenCalled();

    const failed = await transcribeDiscordAudioAttachment(valid, {
      maxBytes: 20,
      maxSeconds: 30,
      createWorkspace: async () => ({ inputPath: 'in', wavPath: 'out', cleanup }),
      download,
      transcode: async () => 5,
      transcribe: async () => {
        throw new Error('whisper down');
      },
    });
    expect(failed).toEqual({ ok: false, reason: 'processing' });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('rejects a converted file over the duration limit without calling Whisper', async () => {
    const transcribe = vi.fn();
    const cleanup = vi.fn(async () => {});
    const result = await transcribeDiscordAudioAttachment(valid, {
      maxBytes: 20,
      maxSeconds: 30,
      createWorkspace: async () => ({ inputPath: 'in', wavPath: 'out', cleanup }),
      download: async () => {},
      transcode: async () => 31,
      transcribe,
    });
    expect(result).toEqual({ ok: false, reason: 'duration' });
    expect(transcribe).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
