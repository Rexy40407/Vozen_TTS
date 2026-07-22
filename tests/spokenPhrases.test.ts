import { describe, it, expect } from 'vitest';
import {
  langKeyOfModel,
  spokenPhrasesFor,
  buildMediaSuffix,
  type MediaItem,
} from '../src/language/spokenPhrases';

describe('langKeyOfModel — prefixo de locale a partir do modelo', () => {
  it('extrai a parte antes do 1.º "_"', () => {
    expect(langKeyOfModel('pt_BR-cadu-medium')).toBe('pt');
    expect(langKeyOfModel('en_US-amy-medium')).toBe('en');
    expect(langKeyOfModel('de_DE-thorsten-medium')).toBe('de');
  });

  it('sem "_" -> fallback "en"', () => {
    expect(langKeyOfModel('semunderscore')).toBe('en');
    expect(langKeyOfModel('')).toBe('en');
  });
});

describe('spokenPhrasesFor — léxico por língua, fallback inglês', () => {
  it('línguas traduzidas devolvem termos próprios', () => {
    expect(spokenPhrasesFor('pt').gif).toBe('um gif');
    expect(spokenPhrasesFor('pt').file).toBe('um arquivo'); // termo brasileiro (voz pt_BR)
    expect(spokenPhrasesFor('es').link).toBe('un enlace');
    expect(spokenPhrasesFor('fr').said).toBe('a dit');
  });

  it('língua não traduzida cai no inglês (fallback honesto)', () => {
    expect(spokenPhrasesFor('tr')).toEqual(spokenPhrasesFor('en'));
    expect(spokenPhrasesFor('zz').link).toBe('a link');
  });
});

describe('buildMediaSuffix — monta o anúncio na língua da voz', () => {
  const en = spokenPhrasesFor('en');
  const pt = spokenPhrasesFor('pt');

  it('um item -> a sua palavra', () => {
    expect(buildMediaSuffix([{ kind: 'gif' }], en)).toBe('a gif');
    expect(buildMediaSuffix([{ kind: 'gif' }], pt)).toBe('um gif');
  });

  it('vários itens -> juntos por espaço, ordem preservada', () => {
    const media: MediaItem[] = [{ kind: 'link' }, { kind: 'image' }];
    expect(buildMediaSuffix(media, en)).toBe('a link an image');
  });

  it('sticker com nome -> lê o nome; sem nome -> "a sticker"', () => {
    expect(buildMediaSuffix([{ kind: 'sticker', text: 'pepe hug' }], en)).toBe('pepe hug');
    expect(buildMediaSuffix([{ kind: 'sticker' }], en)).toBe('a sticker');
    expect(buildMediaSuffix([{ kind: 'sticker', text: '   ' }], en)).toBe('a sticker');
  });

  it('lista vazia -> ""', () => {
    expect(buildMediaSuffix([], en)).toBe('');
  });
});
