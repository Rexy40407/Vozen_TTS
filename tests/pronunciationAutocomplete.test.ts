import { describe, it, expect } from 'vitest';
import { filterPronunciationChoices } from '../src/commands/index';

// Autocomplete for /pronunciation remove (and /server-pronunciation remove): instead of the
// user TYPING the term from memory, the picker lists the SAVED pronunciations.
// name = "term → how it's said" (readable); value = the raw term (what the handler deletes).

const DICT = [
  { term: 'gg', replacement: 'good game' },
  { term: 'brb', replacement: 'be right back' },
  { term: 'sql', replacement: 'sequel' },
];

describe('filterPronunciationChoices', () => {
  it('no query lists everything, readable name and value = raw term', () => {
    const out = filterPronunciationChoices(DICT, '');
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ name: 'gg → good game', value: 'gg' });
    expect(out.map((c) => c.value)).toEqual(['gg', 'brb', 'sql']);
  });

  it('filters by substring of the TERM (case-insensitive)', () => {
    expect(filterPronunciationChoices(DICT, 'BR').map((c) => c.value)).toEqual(['brb']);
  });

  it('also filters by the REPLACEMENT (for those who only remember the "how it\'s said")', () => {
    expect(filterPronunciationChoices(DICT, 'sequel').map((c) => c.value)).toEqual(['sql']);
  });

  it('no matches -> empty list', () => {
    expect(filterPronunciationChoices(DICT, 'xyz')).toEqual([]);
  });

  it('respects the Discord cap of 25', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      term: `term-${i}`,
      replacement: `rep ${i}`,
    }));
    expect(filterPronunciationChoices(many, '')).toHaveLength(25);
  });
});
