import { describe, it, expect } from 'vitest';
import { isBlocked, redactBlocked } from '../src/moderation/filter';

describe('isBlocked', () => {
  it('deteta uma palavra presente na blocklist', () => {
    expect(isBlocked('isto e um teste palavrao aqui', ['palavrao'])).toBe(true);
  });

  it('ignora maiusculas/minusculas no texto e na blocklist', () => {
    expect(isBlocked('Isto e um TESTE PalavrAO', ['palavrao'])).toBe(true);
    expect(isBlocked('isto e um palavrao', ['PALAVRAO'])).toBe(true);
  });

  it('faz match por palavra completa, nao por substring', () => {
    // "ass" nao deve disparar dentro de "passar"
    expect(isBlocked('vou passar por ali', ['ass'])).toBe(false);
  });

  it('deteta a palavra mesmo rodeada de pontuacao', () => {
    expect(isBlocked('para, palavrao!', ['palavrao'])).toBe(true);
    expect(isBlocked('(palavrao)', ['palavrao'])).toBe(true);
  });

  it('devolve false quando a blocklist esta vazia', () => {
    expect(isBlocked('qualquer texto', [])).toBe(false);
  });

  it('devolve false quando nenhuma palavra da blocklist aparece', () => {
    expect(isBlocked('texto perfeitamente limpo', ['palavrao', 'outra'])).toBe(false);
  });

  it('deteta qualquer uma de varias palavras na blocklist', () => {
    expect(isBlocked('aqui aparece outra coisa', ['palavrao', 'outra'])).toBe(true);
  });

  it('ignora entradas vazias na blocklist', () => {
    expect(isBlocked('texto normal', ['', '   '])).toBe(false);
  });

  it('faz match de blockword com varias palavras como frase', () => {
    expect(isBlocked('ele disse uma coisa ma agora', ['coisa ma'])).toBe(true);
    expect(isBlocked('isto e uma coisa boa', ['coisa ma'])).toBe(false);
  });
});

describe('redactBlocked — remove a palavra, mantem o resto legivel', () => {
  it('remove a palavra bloqueada e le o resto', () => {
    expect(redactBlocked('isto e um teste palavrao aqui', ['palavrao'])).toBe(
      'isto e um teste aqui',
    );
  });

  it('ignora maiusculas/minusculas ao remover', () => {
    expect(redactBlocked('Isto e PalavrAO no meio', ['palavrao'])).toBe('Isto e no meio');
  });

  it('so remove palavra completa, nao substring', () => {
    // "ass" NAO deve ser removido de dentro de "passar"
    expect(redactBlocked('vou passar por ali', ['ass'])).toBe('vou passar por ali');
  });

  it('remove palavras bloqueadas consecutivas (replace global)', () => {
    expect(redactBlocked('palavrao palavrao fim', ['palavrao'])).toBe('fim');
  });

  it('remove mesmo rodeada de pontuacao, mantendo a pontuacao vizinha', () => {
    expect(redactBlocked('para, palavrao! continua', ['palavrao'])).toBe('para, ! continua');
  });

  it('remove qualquer uma de varias palavras da blocklist', () => {
    expect(redactBlocked('aqui aparece outra e palavrao coisa', ['palavrao', 'outra'])).toBe(
      'aqui aparece e coisa',
    );
  });

  it('mensagem que e SO a palavra bloqueada fica vazia', () => {
    expect(redactBlocked('palavrao', ['palavrao'])).toBe('');
    expect(redactBlocked('  palavrao  ', ['palavrao'])).toBe('');
  });

  it('remove blockword multi-palavra (frase)', () => {
    expect(redactBlocked('ele disse uma coisa ma agora', ['coisa ma'])).toBe('ele disse uma agora');
  });

  it('blocklist vazia -> texto inalterado (sem normalizar espacos a toa)', () => {
    expect(redactBlocked('texto  com   espacos', [])).toBe('texto  com   espacos');
    expect(redactBlocked('texto normal', ['', '   '])).toBe('texto normal');
  });

  it('sem palavra bloqueada presente -> texto inalterado byte-a-byte', () => {
    expect(redactBlocked('texto  perfeitamente  limpo', ['palavrao'])).toBe(
      'texto  perfeitamente  limpo',
    );
  });
});
