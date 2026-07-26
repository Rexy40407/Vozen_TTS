import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');

describe('Docker runtime assets', () => {
  it('keeps the soundboard in the build context without including brand assets', () => {
    const ignore = readFileSync(resolve(root, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^assets\/\*$/m);
    expect(ignore).toMatch(/^!assets\/sfx\/$/m);
    expect(ignore).toMatch(/^!assets\/sfx\/\*\*$/m);
  });

  it('copies soundboard WAVs into both Node and Rust runtime images', () => {
    const nodeDockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
    const rustDockerfile = readFileSync(resolve(root, 'Dockerfile.rust'), 'utf8');
    expect(nodeDockerfile).toContain('COPY --from=builder /app/assets/sfx ./assets/sfx');
    expect(rustDockerfile).toContain('COPY assets/sfx ./assets/sfx');
  });

  it('pins and verifies the Linux Piper runtime in the Rust image', () => {
    const rustDockerfile = readFileSync(resolve(root, 'Dockerfile.rust'), 'utf8');
    expect(rustDockerfile).toContain('ARG PIPER_VERSION=2023.11.14-2');
    expect(rustDockerfile).toContain('PIPER_LINUX_X86_64_SHA256=');
    expect(rustDockerfile).toContain('sha256sum --check --strict');
    expect(rustDockerfile).toContain('test -x /usr/local/lib/piper/piper');
  });

  it('keeps every Rust synthesis cache on the writable data volume', () => {
    const rustCompose = readFileSync(resolve(root, 'docker-compose.rust.yml'), 'utf8');
    expect(rustCompose).toContain('RUST_VOICE_CACHE_DIR: /data/audio-cache/rust');
    expect(rustCompose).toContain('RUST_TTS_FILE_CACHE_DIR: /data/audio-cache/rust-file');
  });
});
