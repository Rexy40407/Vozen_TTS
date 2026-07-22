import { describe, it, expect } from 'vitest';
import { restoreAccents, accentLangOfModel } from '../src/textCleaning/accents';
import { prepareSpeech } from '../src/commands/prepareSpeech';

describe('restoreAccents — restores the language accents', () => {
  it('PT: common words without accents -> with accents', () => {
    expect(restoreAccents('nao', 'por')).toBe('não');
    expect(restoreAccents('voce e portugues', 'por')).toBe('você e português'); // "e" stays (ambiguous)
    expect(restoreAccents('ate amanha', 'por')).toBe('até amanhã');
    expect(restoreAccents('isto e muito rapido e facil', 'por')).toBe(
      'isto e muito rápido e fácil',
    );
  });

  it('PT: cedilla and nasals', () => {
    expect(restoreAccents('servico', 'por')).toBe('serviço');
    expect(restoreAccents('vamos comecar', 'por')).toBe('vamos começar');
    expect(restoreAccents('bom preco', 'por')).toBe('bom preço');
    expect(restoreAccents('coracao', 'por')).toBe('coração');
    expect(restoreAccents('a minha mae', 'por')).toBe('a minha mãe');
  });

  it('PT: preserves capitalization and word boundary', () => {
    expect(restoreAccents('Nao', 'por')).toBe('Não');
    expect(restoreAccents('NAO', 'por')).toBe('NÃO');
    expect(restoreAccents('Voce', 'por')).toBe('Você');
    expect(restoreAccents('nao!', 'por')).toBe('não!');
    expect(restoreAccents('naopode', 'por')).toBe('naopode'); // does not match inside a word
  });

  it('PT: AMBIGUOUS pairs are NOT touched (does not break valid words)', () => {
    for (const w of ['esta', 'e', 'so', 'musica', 'pratica', 'pais', 'pode', 'publico']) {
      expect(restoreAccents(w, 'por')).toBe(w);
    }
  });

  it('other languages: ES/FR restore; without a dictionary = no-op', () => {
    expect(restoreAccents('informacion', 'spa')).toBe('información');
    expect(restoreAccents('francais', 'fra')).toBe('français');
    expect(restoreAccents('nao', 'eng')).toBe('nao'); // English has no dict
    // German HAS a dict, but 'nao' is not a German key -> no-op (does not touch).
    expect(restoreAccents('nao', 'deu')).toBe('nao');
    expect(restoreAccents('nao', '')).toBe('nao');
  });

  it('DE: restores the Umlaut of safe words (the un-umlauted form is not a German word)', () => {
    expect(restoreAccents('fur', 'deu')).toBe('für');
    expect(restoreAccents('konnen', 'deu')).toBe('können');
    expect(restoreAccents('grun', 'deu')).toBe('grün');
    expect(restoreAccents('ich mochte funf', 'deu')).toBe('ich mochte fünf'); // "mochte" stays (ambiguous)
    expect(restoreAccents('naturlich', 'deu')).toBe('natürlich');
  });

  it('DE: preserves capitalization and boundary', () => {
    expect(restoreAccents('Tur', 'deu')).toBe('Tür'); // 1st letter uppercase
    expect(restoreAccents('FUNF', 'deu')).toBe('FÜNF'); // all uppercase
    expect(restoreAccents('fur!', 'deu')).toBe('für!'); // punctuation = boundary
    expect(restoreAccents('furcht', 'deu')).toBe('furcht'); // does not match inside a word
  });

  it('DE: ambiguous MINIMAL pairs are NOT touched (the un-umlauted form is another word)', () => {
    // Landmines: each is a common German word on its own -> must stay intact.
    for (const w of [
      'schon',
      'wurde',
      'mochte',
      'hatte',
      'konnte',
      'musste',
      'durfte',
      'ware',
      'wahlen',
      'zahlen',
      'lauft',
      'uber',
    ]) {
      expect(restoreAccents(w, 'deu')).toBe(w);
    }
  });

  it('accentLangOfModel: model prefix -> ISO (only languages with a dict)', () => {
    expect(accentLangOfModel('pt_PT-tugao-medium')).toBe('por');
    expect(accentLangOfModel('es_ES-davefx-medium')).toBe('spa');
    expect(accentLangOfModel('fr_FR-siwis-medium')).toBe('fra');
    expect(accentLangOfModel('de_DE-thorsten-medium')).toBe('deu');
    expect(accentLangOfModel('en_US-amy-medium')).toBe('');
  });
});

describe('prepareSpeech — integrates accent restoration', () => {
  const available = ['en_US-amy-medium', 'pt_PT-google-medium', 'es_ES-davefx-medium'];
  // Without `as const`: it made `pronunciations` a readonly [] incompatible with the
  // PronunciationEntry[] (mutable) of PrepareSpeechInput.
  const base = {
    pronunciations: [] as { term: string; replacement: string }[],
    userVoice: null,
    available,
    defaultVoice: 'en_US-amy-medium',
    defaultSpeed: 1,
  };

  it('fixed PT voice => restores accents by the VOICE language', () => {
    const r = prepareSpeech({
      ...base,
      personal: 'nao voce',
      userVoice: { model: 'pt_PT-google-medium', speed: 1 },
    });
    expect(r.spoken).toBe('não você');
    expect(r.req.singleVoice).toBe(true);
  });
});
