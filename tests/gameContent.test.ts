import { describe, it, expect } from 'vitest';
import { WORD_BANK, wordsForLocale } from '../src/games/content/words';
import { WORDLE_WORDS, pickWordleWords } from '../src/games/content/wordleWords';
import { SHORT_PHRASES } from '../src/games/content/shortPhrases';
import { ROULETTE_PROMPTS } from '../src/games/content/roulettePrompts';
import { LANGUAGE_PHRASES } from '../src/games/content/languagePhrases';

/**
 * Guardas ESTRUTURAIS dos bancos de conteudo dos jogos. O objetivo e duplo:
 *  1. variedade — os pools tem um MINIMO de entradas (o bug original: 16 palavras na
 *     Forca, 8 frases na Velocidade, 1 frase por lingua no Adivinha a Lingua — tudo
 *     repetia ao fim de duas partidas);
 *  2. validade — o Wordle assume EXATAMENTE 5 letras ASCII; uma palavra torta era
 *     silenciosamente filtrada em runtime, encolhendo o pool sem ninguem dar por isso
 *     (o banco DE chegou a ficar com 17 palavras uteis de 25 declaradas).
 */

function dup<T>(arr: readonly T[]): T[] {
  const seen = new Set<T>();
  const dups: T[] = [];
  for (const x of arr) seen.has(x) ? dups.push(x) : seen.add(x);
  return dups;
}

describe('WORD_BANK (Ditado/Soletrado/Sotaque/Vozen Diz/Forca)', () => {
  it('cada lingua tem >= 40 palavras, sem duplicados, todas com >= 3 letras', () => {
    for (const [lang, words] of Object.entries(WORD_BANK)) {
      expect(words.length, `banco ${lang}`).toBeGreaterThanOrEqual(40);
      expect(dup(words), `duplicados em ${lang}`).toEqual([]);
      for (const w of words)
        expect(w.length, `palavra curta em ${lang}: ${w}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('a Forca (wordsForLocale) fica com >= 40 palavras jogaveis (sem hifen/espaco)', () => {
    for (const lang of Object.keys(WORD_BANK)) {
      expect(wordsForLocale(lang).words.length, `forca ${lang}`).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('WORDLE_WORDS (Termo/Wordle)', () => {
  it('todas as palavras tem EXATAMENTE 5 letras ASCII (nada e filtrado em runtime)', () => {
    for (const [lang, words] of Object.entries(WORDLE_WORDS)) {
      const bad = words.filter((w) => !/^[a-z]{5}$/.test(w));
      expect(bad, `palavras invalidas em ${lang}`).toEqual([]);
      // O filtro defensivo do picker nao deve deitar NADA fora.
      expect(pickWordleWords(lang).words.length, `pool ${lang}`).toBe(words.length);
    }
  });

  it('cada lingua tem >= 70 palavras, sem duplicados', () => {
    for (const [lang, words] of Object.entries(WORDLE_WORDS)) {
      expect(words.length, `banco ${lang}`).toBeGreaterThanOrEqual(70);
      expect(dup(words), `duplicados em ${lang}`).toEqual([]);
    }
  });
});

describe('SHORT_PHRASES (Velocidade Estupida)', () => {
  it('cada lingua tem >= 20 frases, sem duplicados', () => {
    for (const [lang, phrases] of Object.entries(SHORT_PHRASES)) {
      expect(phrases.length, `banco ${lang}`).toBeGreaterThanOrEqual(20);
      expect(dup(phrases), `duplicados em ${lang}`).toEqual([]);
    }
  });
});

describe('ROULETTE_PROMPTS (Roleta)', () => {
  it('cada lingua tem >= 30 desafios, sem duplicados', () => {
    for (const [lang, prompts] of Object.entries(ROULETTE_PROMPTS)) {
      expect(prompts.length, `banco ${lang}`).toBeGreaterThanOrEqual(30);
      expect(dup(prompts), `duplicados em ${lang}`).toEqual([]);
    }
  });
});

describe('LANGUAGE_PHRASES (Adivinha a Lingua)', () => {
  it('cada lingua tem >= 3 frases nao-vazias, sem duplicados (anti-decorar)', () => {
    for (const [lang, phrases] of Object.entries(LANGUAGE_PHRASES)) {
      expect(phrases.length, `frases ${lang}`).toBeGreaterThanOrEqual(3);
      expect(dup(phrases), `duplicados em ${lang}`).toEqual([]);
      // Limiar baixo de proposito: o chines/japones dizem muito em poucos carateres.
      for (const p of phrases) expect(p.trim().length, `frase vazia em ${lang}`).toBeGreaterThan(5);
    }
  });
});
