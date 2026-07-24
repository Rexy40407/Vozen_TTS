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
});
