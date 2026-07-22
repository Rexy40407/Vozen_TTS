import { describe, expect, it, vi } from 'vitest';
import { commandDefs } from '../src/commands/definitions';
import { handleTranscribeVoiceMessage } from '../src/commands/handlers/messageTools';

function interaction(attachment?: { url: string; contentType: string; size: number }) {
  const edits: unknown[] = [];
  return {
    commandName: 'Transcribe voice message',
    targetMessage: { attachments: new Map(attachment ? [['a', attachment]] : []) },
    user: { id: 'u1' },
    guildId: null,
    deferred: false,
    replied: false,
    isRepliable: () => true,
    deferReply: vi.fn(async () => {}),
    editReply: vi.fn(async (payload: unknown) => {
      edits.push(payload);
    }),
    edits,
  };
}

describe('Transcribe voice message context action', () => {
  it('is registered as a message action', () => {
    const definition = commandDefs.find((entry) => entry.name === 'Transcribe voice message');
    expect(definition?.type).toBe(3);
  });

  it('runs bounded local transcription and returns an ephemeral transcript', async () => {
    const input = {
      url: 'https://cdn.discordapp.com/attachments/1/2/voice.ogg',
      contentType: 'audio/ogg',
      size: 1_024,
    };
    const i = interaction(input);
    const dispose = vi.fn();
    const release = vi.fn();
    const run = vi.fn(async () => ({
      ok: true as const,
      text: 'The meeting starts at ten.',
      language: 'en',
      durationMs: 4_000,
    }));
    const metrics: number[] = [];

    await handleTranscribeVoiceMessage(i as never, {} as never, {
      resolveCommand: () => ({ exe: 'python', args: ['sidecar.py'] }),
      acquire: () => release,
      createTranscriber: () => ({ prewarm: vi.fn(), transcribe: vi.fn(), dispose }),
      run,
      recordAudioMs: (value) => metrics.push(value),
      limits: () => ({ maxBytes: 8_000_000, maxSeconds: 60 }),
    });

    expect(i.deferReply).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ maxBytes: 8_000_000, maxSeconds: 60 }),
    );
    expect(JSON.stringify(i.edits)).toContain('The meeting starts at ten.');
    expect(metrics).toEqual([4_000]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects a target without audio before reserving Whisper capacity', async () => {
    const i = interaction();
    const acquire = vi.fn();
    await handleTranscribeVoiceMessage(i as never, {} as never, {
      resolveCommand: () => ({ exe: 'python', args: [] }),
      acquire,
      createTranscriber: vi.fn(),
      run: vi.fn(),
      recordAudioMs: vi.fn(),
      limits: () => ({ maxBytes: 1, maxSeconds: 1 }),
    });
    expect(acquire).not.toHaveBeenCalled();
    expect(JSON.stringify(i.edits)).toMatch(/audio attachment/i);
  });
});
