import { describe, it, expect } from 'vitest';
import { sanitizeSpeakerName } from '../src/language/speakerName';

describe('sanitizeSpeakerName — nome pronunciável para o xsaid', () => {
  it('nome normal fica igual', () => {
    expect(sanitizeSpeakerName('Alex')).toBe('Alex');
    expect(sanitizeSpeakerName('João Silva')).toBe('João Silva');
  });

  it('tira emojis e símbolos decorativos', () => {
    expect(sanitizeSpeakerName('🔥xX_Pro_Xx🔥')).toBe('xX Pro Xx');
    expect(sanitizeSpeakerName('★▓ Diogo ▓★')).toBe('Diogo');
    expect(sanitizeSpeakerName('~|Ana|~')).toBe('Ana');
  });

  it('underscores viram espaço e colapsa whitespace', () => {
    expect(sanitizeSpeakerName('cool__name')).toBe('cool name');
    expect(sanitizeSpeakerName('  a   b  ')).toBe('a b');
  });

  it('custom emoji do Discord é removido', () => {
    expect(sanitizeSpeakerName('Bea <:heart:123456>')).toBe('Bea');
  });

  it('nome 100% emojis/símbolos -> "" (sem nada legível)', () => {
    expect(sanitizeSpeakerName('🔥💯✨')).toBe('');
    expect(sanitizeSpeakerName('★▓~|')).toBe('');
    expect(sanitizeSpeakerName('')).toBe('');
  });

  it('trunca nomes muito longos (<=40)', () => {
    const long = 'a'.repeat(60);
    expect(sanitizeSpeakerName(long).length).toBe(40);
  });
});
