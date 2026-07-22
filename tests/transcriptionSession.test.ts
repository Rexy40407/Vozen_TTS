import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  TranscriptionSession,
  type TranscriptionSessionDeps,
} from '../src/voice/transcriptionSession';

// Tests the ORCHESTRATION of the session (consent gate + utterance -> transcription -> post),
// injecting `capture` (the real Opus plumbing stays in the default impl, like in the recorder). A
// fake `capture` emits utterances and resolves when the speaker stops talking.

function makeDeps(over: Partial<TranscriptionSessionDeps> = {}) {
  const posts: string[] = [];
  const captured: string[] = [];
  const deps = {
    hasConsent: (u: string) => u === 'yes',
    displayName: (u: string) => (u === 'yes' ? 'Rita' : u),
    transcribe: vi.fn(async (_wav: string) => ({ text: 'good game', lang: 'en' })),
    post: vi.fn(async (t: string) => {
      posts.push(t);
    }),
    toWav: vi.fn(async (_pcm: Buffer, out: string) => out),
    capture: vi.fn(async (userId: string, onUtterance: (pcm: Buffer) => void) => {
      captured.push(userId);
      onUtterance(Buffer.from('pcm'));
    }),
    ...over,
  };
  return { deps, posts, captured };
}

describe('TranscriptionSession', () => {
  it('CONSENTED speaker: captures, transcribes and posts "**Name:** text"', async () => {
    const { deps, posts } = makeDeps();
    const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
    await s.onSpeakingStart('yes');
    expect(posts).toEqual(['**Rita:** good game']);
    expect(deps.transcribe).toHaveBeenCalledOnce();
  });

  it('speaker WITHOUT consent: is never captured (consent-first gate)', async () => {
    const { deps, captured, posts } = makeDeps();
    const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
    await s.onSpeakingStart('no');
    expect(captured).toEqual([]);
    expect(posts).toEqual([]);
    expect(deps.transcribe).not.toHaveBeenCalled();
  });

  it('does not capture the same speaker twice at once', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const { deps } = makeDeps({
      capture: vi.fn(async (_u: string, _on: (p: Buffer) => void) => {
        calls++;
        await gate; // stays "capturing" until we release
      }),
    });
    const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
    const p1 = s.onSpeakingStart('yes');
    await s.onSpeakingStart('yes'); // 2nd call while the 1st is still capturing -> ignored
    release();
    await p1;
    expect(calls).toBe(1); // only one capture
  });

  it('empty utterance (just noise) posts nothing', async () => {
    const { deps, posts } = makeDeps({
      transcribe: vi.fn(async () => ({ text: '   ', lang: 'en' })),
    });
    const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
    await s.onSpeakingStart('yes');
    expect(posts).toEqual([]);
  });

  it('records only aggregate captured audio duration, never speaker or transcript content', async () => {
    const durations: number[] = [];
    const { deps } = makeDeps({
      capture: vi.fn(async (_userId: string, onUtterance: (pcm: Buffer) => void) => {
        onUtterance(Buffer.alloc(48_000 * 2 * 2));
      }),
      recordAudioMs: (value: number) => durations.push(value),
    });
    const session = new TranscriptionSession(deps as TranscriptionSessionDeps);

    await session.onSpeakingStart('yes');

    expect(durations).toEqual([1_000]);
    expect(JSON.stringify(durations)).not.toMatch(/yes|Rita|good game/);
  });

  it('stop() marks the session as stopped: new speaking-starts are ignored', async () => {
    const { deps, captured } = makeDeps();
    const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
    s.stop();
    await s.onSpeakingStart('yes');
    expect(captured).toEqual([]);
  });

  it('transcribe() failing: swallows the error, does not post and does not blow up the session', async () => {
    const { deps, posts } = makeDeps({
      transcribe: vi.fn(async () => {
        throw new Error('sidecar morreu a meio');
      }),
    });
    const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
    await expect(s.onSpeakingStart('yes')).resolves.toBeUndefined();
    expect(posts).toEqual([]);
  });

  it('the temporary WAV is deleted after the utterance EVEN when transcription fails (PRIVACY §2.4)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vozen-stt-test-'));
    try {
      const written: string[] = [];
      const { deps } = makeDeps({
        tmpDir: dir,
        toWav: vi.fn(async (_pcm: Buffer, out: string) => {
          writeFileSync(out, 'wav'); // actually writes the file (not just the path)
          written.push(out);
          return out;
        }),
        transcribe: vi.fn(async () => {
          throw new Error('boom'); // failure path: the finally must still delete
        }),
      });
      const s = new TranscriptionSession(deps as unknown as TranscriptionSessionDeps);
      await s.onSpeakingStart('yes');
      expect(written).toHaveLength(1);
      expect(existsSync(written[0])).toBe(false); // consented recording does not persist
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
