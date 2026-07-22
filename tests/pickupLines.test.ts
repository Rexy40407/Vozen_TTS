import { describe, it, expect } from 'vitest';
import { pickLine, PICKUP_KEYS } from '../src/content/pickupLines';
import { JOKE_LANGUAGES } from '../src/content/jokes';

describe('pickupLines — cobertura e determinismo', () => {
  it('cada língua do /joke tem >=1 pick-up line própria (sem cair no fallback EN)', () => {
    for (const l of JOKE_LANGUAGES) {
      expect(PICKUP_KEYS).toContain(l.key);
      expect(pickLine(l.key, 0).length).toBeGreaterThan(0);
    }
  });

  it('pickLine é determinista (mesmo seed -> mesma frase)', () => {
    expect(pickLine('en', 3)).toBe(pickLine('en', 3));
    expect(pickLine('pt', 7)).toBe(pickLine('pt', 7));
  });

  it('seed negativo/grande nunca rebenta (índice sempre válido)', () => {
    expect(pickLine('en', -5).length).toBeGreaterThan(0);
    expect(pickLine('en', 999999).length).toBeGreaterThan(0);
  });

  it('key desconhecida cai no inglês', () => {
    expect(pickLine('xx-nao-existe', 0)).toBe(pickLine('en', 0));
  });
});
