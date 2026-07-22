import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmDirSafe } from '../src/tts/cleanupDir';

describe('rmDirSafe — limpeza de temp dir que NUNCA lança', () => {
  it('remove um diretório existente com conteúdo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rmdirsafe-'));
    writeFileSync(join(dir, 'out.wav'), 'x');
    rmDirSafe(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it('não lança num caminho inexistente (o perigo do finally: não mascarar o erro real)', () => {
    expect(() =>
      rmDirSafe(join(tmpdir(), `nao-existe-${process.pid}-${Date.now()}`)),
    ).not.toThrow();
  });
});
