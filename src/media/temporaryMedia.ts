/**
 * Private, short-lived media copies used only while Discord uploads a response.
 *
 * Engines own their cache files; callers must never hand those cache paths to an
 * interaction.  This helper copies an already-created local file to an opaque name in
 * the OS temp directory and removes the whole directory in every terminal path.
 */
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const TEMP_PREFIX = 'vozen-media-';

export interface TemporaryMedia {
  path: string;
  cleanup(): Promise<void>;
}

export interface TemporaryMediaFs {
  mkdtemp(prefix: string): Promise<string>;
  copyFile(source: string, destination: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
}

const nodeFs: TemporaryMediaFs = { mkdtemp, copyFile, rm };

function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Temporary media operation timed out')),
      timeoutMs,
    );
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Creates a private copy with an opaque filename.  `extension` is controlled by code. */
export async function makeTemporaryMediaCopy(
  sourcePath: string,
  extension = '.wav',
  options: { timeoutMs?: number; fs?: TemporaryMediaFs } = {},
): Promise<TemporaryMedia> {
  const fs = options.fs ?? nodeFs;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!/^\.[a-z0-9]{1,8}$/i.test(extension)) throw new Error('Unsafe temporary media extension');

  const directory = await withTimeout(fs.mkdtemp(join(tmpdir(), TEMP_PREFIX)), timeoutMs);
  const path = join(directory, `${randomUUID()}${extension}`);
  try {
    await withTimeout(fs.copyFile(sourcePath, path), timeoutMs);
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return {
    path,
    cleanup: async () => {
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}
