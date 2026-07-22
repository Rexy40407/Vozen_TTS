// tests/segments.test.ts — P14.4a
import { describe, it, expect } from 'vitest';
import { detectSegments } from '../src/tts/segments';

describe('detectSegments', () => {
  it('texto vazio -> array vazio', () => {
    expect(detectSegments('')).toEqual([]);
    expect(detectSegments('   ')).toEqual([]);
  });

  it('texto monolingue (PT longo) -> 1 unico segmento com a lingua certa', () => {
    const text =
      'bom dia a todos os membros deste servidor espero que estejam todos bem e com muita saude hoje';
    const segs = detectSegments(text);
    expect(segs).toHaveLength(1);
    expect(segs[0].lang).toBe('por');
    // O texto do segmento cobre o input original (sem perder conteudo).
    expect(segs[0].text.trim()).toBe(text.trim());
  });

  it('texto monolingue (EN longo) -> 1 unico segmento eng', () => {
    const text =
      'good morning to all the members of this server i hope you are all doing very well today';
    const segs = detectSegments(text);
    expect(segs).toHaveLength(1);
    expect(segs[0].lang).toBe('eng');
  });

  it('bilingue mixed-script (EN + Cirilico RU) -> >=2 segmentos com linguas plausiveis', () => {
    // Frase inglesa longa seguida de frase russa longa (script diferente ->
    // fronteira fiavel). Cada span tem comprimento suficiente para o franc.
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    const segs = detectSegments(`${en}. ${ru}`);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    const langs = segs.map((s) => s.lang);
    expect(langs).toContain('eng');
    expect(langs).toContain('rus');
  });

  it('funde pedacos consecutivos da mesma lingua (uma so frase EN em varias sentencas)', () => {
    // Duas sentencas ambas EN -> devem fundir num unico segmento eng.
    const text =
      'good morning everyone here today. i really hope that you are all doing very well right now.';
    const segs = detectSegments(text);
    expect(segs).toHaveLength(1);
    expect(segs[0].lang).toBe('eng');
  });

  it('concatenacao dos textos dos segmentos preserva o conteudo (sem perder caracteres nao-brancos)', () => {
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    const input = `${en}. ${ru}`;
    const segs = detectSegments(input);
    const rejoined = segs.map((s) => s.text).join('');
    // Ignora espacos: a heuristica pode normalizar whitespace nas fronteiras.
    expect(rejoined.replace(/\s+/g, '')).toBe(input.replace(/\s+/g, ''));
  });

  it('pedaco curto demais herda a lingua dominante/anterior (nao vira segmento proprio ruidoso)', () => {
    // "Ok." e curto demais para detetar; deve fundir-se com o vizinho PT.
    const text =
      'bom dia a todos os membros deste servidor espero que estejam bem. Ok. continuemos entao a conversa toda em portugues hoje';
    const segs = detectSegments(text);
    // Tudo PT no fim -> 1 segmento por.
    expect(segs).toHaveLength(1);
    expect(segs[0].lang).toBe('por');
  });
});
