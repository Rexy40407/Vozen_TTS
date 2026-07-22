import { describe, it, expect } from 'vitest';
import { splitEnglishSlang } from '../src/textCleaning/abbreviations';

describe('splitEnglishSlang — segmentacao de girias EN dentro de outra lingua', () => {
  it('texto sem girias -> 1 unico segmento (isEnglish false)', () => {
    expect(splitEnglishSlang('isto e uma frase normal')).toEqual([
      { text: 'isto e uma frase normal', isEnglish: false },
    ]);
  });

  it('so girias ("brb omg") -> 1 unico segmento ingles', () => {
    expect(splitEnglishSlang('brb omg')).toEqual([{ text: 'brb omg', isEnglish: true }]);
  });

  it('misturado "isto ta a funcionar btw" -> [base false, giria true]', () => {
    expect(splitEnglishSlang('isto ta a funcionar btw')).toEqual([
      { text: 'isto ta a funcionar', isEnglish: false },
      { text: 'btw', isEnglish: true },
    ]);
  });

  it('interleaved "funciona btw agora" -> 3 segmentos false/true/false', () => {
    expect(splitEnglishSlang('funciona btw agora')).toEqual([
      { text: 'funciona', isEnglish: false },
      { text: 'btw', isEnglish: true },
      { text: 'agora', isEnglish: false },
    ]);
  });

  it('pontuacao a volta do token ("btw!") e core-stripped -> ingles', () => {
    expect(splitEnglishSlang('btw!')).toEqual([{ text: 'btw!', isEnglish: true }]);
  });

  it('vazio/so-espacos -> []', () => {
    expect(splitEnglishSlang('')).toEqual([]);
    expect(splitEnglishSlang('   ')).toEqual([]);
  });
});
