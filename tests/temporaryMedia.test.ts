import { describe, expect, it, vi } from 'vitest';
import { makeTemporaryMediaCopy } from '../src/media/temporaryMedia';

describe('temporary media', () => {
  it('uses an opaque temporary name and removes the private directory on cleanup', async () => {
    const copyFile = vi.fn(async () => {});
    const rm = vi.fn(async () => {});
    const media = await makeTemporaryMediaCopy('cached.wav', '.wav', {
      fs: { mkdtemp: async () => 'C:/temp/vozen-media-opaque', copyFile, rm },
    });

    expect(copyFile).toHaveBeenCalledWith('cached.wav', expect.stringMatching(/\.wav$/));
    expect(media.path).not.toContain('cached.wav');
    await media.cleanup();
    expect(rm).toHaveBeenCalledWith('C:/temp/vozen-media-opaque', {
      recursive: true,
      force: true,
    });
  });

  it('cleans the directory when copying fails', async () => {
    const rm = vi.fn(async () => {});
    await expect(
      makeTemporaryMediaCopy('cached.wav', '.wav', {
        fs: {
          mkdtemp: async () => 'C:/temp/vozen-media-failed',
          copyFile: async () => {
            throw new Error('copy failed');
          },
          rm,
        },
      }),
    ).rejects.toThrow('copy failed');
    expect(rm).toHaveBeenCalledWith('C:/temp/vozen-media-failed', { recursive: true, force: true });
  });
});
