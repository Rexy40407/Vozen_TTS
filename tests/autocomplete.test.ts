import { describe, it, expect, vi } from 'vitest';
import {
  filterModelChoices,
  handleAutocomplete,
  sanitizeAutocompleteChoices,
  commandDefs,
} from '../src/commands/index';
import { modelDisplayName } from '../src/language/voiceMap';

describe('modelDisplayName', () => {
  it('shows the language written in its own language (autonym)', () => {
    expect(modelDisplayName('pt_PT-tugao-medium')).toBe('Português (Portugal)');
    expect(modelDisplayName('pt_BR-faber-medium')).toBe('Português (Brasil)'); // symmetric with pt_PT
    expect(modelDisplayName('en_US-amy-medium')).toBe('English (US)');
    expect(modelDisplayName('fr_FR-siwis-medium')).toBe('Français');
    expect(modelDisplayName('de_DE-thorsten-medium')).toBe('Deutsch');
    expect(modelDisplayName('zh_CN-huayan-medium')).toBe('中文');
  });
  it('falls back to the id when the locale is not mapped (never hides the voice)', () => {
    expect(modelDisplayName('xx_YY-foo-medium')).toBe('xx_YY-foo-medium');
  });
});

describe('filterModelChoices (autocomplete)', () => {
  const models = ['pt_PT-tugao-medium', 'en_US-amy-medium', 'fr_FR-siwis-medium'];

  it('name = autonym, value = id, sorted by name', () => {
    expect(filterModelChoices(models, '')).toEqual([
      { name: 'English (US)', value: 'en_US-amy-medium' },
      { name: 'Français', value: 'fr_FR-siwis-medium' },
      { name: 'Português (Portugal)', value: 'pt_PT-tugao-medium' },
    ]);
  });

  it('filters by the language name (the user types "portu")', () => {
    expect(filterModelChoices(models, 'portu').map((c) => c.value)).toEqual(['pt_PT-tugao-medium']);
  });

  it('also filters by the model id (e.g. the voice name)', () => {
    expect(filterModelChoices(models, 'siwis').map((c) => c.value)).toEqual(['fr_FR-siwis-medium']);
  });

  it('is case-insensitive and ignores spaces', () => {
    expect(filterModelChoices(models, '  ENGLISH ').map((c) => c.value)).toEqual([
      'en_US-amy-medium',
    ]);
  });

  it('limits to 25 suggestions (Discord maximum)', () => {
    const many = Array.from({ length: 40 }, (_, i) => `en_US-voz${i}-medium`);
    expect(filterModelChoices(many, '').length).toBe(25);
  });

  it('with >25 models returns exactly 25, sorted (sort BEFORE the slice)', () => {
    // Unmapped locales -> modelDisplayName falls back to the raw id, so each model has
    // a DISTINCT name (unlike the en_US-… ones that collapse into "English (US)").
    // We shuffle the input to prove the sorting happens before the cut: if the slice
    // came before the sort, the result wouldn't be the sorted prefix.
    const ids = Array.from({ length: 30 }, (_, i) => `zz_ZZ-v${String(i).padStart(2, '0')}-medium`);
    const shuffled = [...ids].reverse(); // input order != final order
    const out = filterModelChoices(shuffled, '');
    expect(out.length).toBe(25);
    // The first 25 by sorted name (raw id) — not the first 25 of the input.
    const expected = [...ids].sort((a, b) => a.localeCompare(b)).slice(0, 25);
    expect(out.map((c) => c.value)).toEqual(expected);
  });

  it('a query that matches nothing returns [] (no suggestions)', () => {
    expect(filterModelChoices(models, 'zzzz-nao-existe')).toEqual([]);
  });
});

// Diogo's request: the language names in the /voice set picker appear IN THE USER'S
// LANGUAGE (the Discord client locale), via Intl.DisplayNames. Without locale -> autonym.
describe('filterModelChoices — language names in the user locale', () => {
  const models = [
    'pt_PT-tugao-medium',
    'en_US-amy-medium',
    'fr_FR-siwis-medium',
    'de_DE-thorsten-medium',
  ];

  it('locale pt-BR -> names in Portuguese', () => {
    const names = filterModelChoices(models, '', 'pt-BR').map((c) => c.name);
    expect(names).toContain('Alemão');
    expect(names).toContain('Francês');
    expect(names).toContain('Português');
    expect(names).toContain('Inglês'); // the region only appears if there's >1 region of the base
  });

  it('locale fr -> names in French', () => {
    const names = filterModelChoices(models, '', 'fr').map((c) => c.name);
    expect(names).toContain('Allemand');
    expect(names).toContain('Anglais');
    expect(names).toContain('Portugais');
  });

  it('locale de -> names in German', () => {
    const names = filterModelChoices(models, '', 'de').map((c) => c.name);
    expect(names).toContain('Deutsch');
    expect(names).toContain('Englisch');
  });

  it('shows the (localized) REGION when the base has >1 installed region', () => {
    const multi = ['en_US-amy-medium', 'en_GB-alan-medium'];
    const names = filterModelChoices(multi, '', 'pt-BR').map((c) => c.name);
    expect(names).toContain('Inglês (Estados Unidos)');
    expect(names).toContain('Inglês (Reino Unido)');
  });

  it('the user can SEARCH in their own language (e.g. "alemão")', () => {
    expect(filterModelChoices(models, 'alemão', 'pt-BR').map((c) => c.value)).toEqual([
      'de_DE-thorsten-medium',
    ]);
  });

  it('a weird locale -> does not blow up and returns all the voices', () => {
    // Intl is tolerant (falls back to en for unknown but well-formed tags); what matters
    // is to NEVER blow up and never hide a voice.
    const out = filterModelChoices(models, '', 'zz-nonsense');
    expect(out.length).toBe(models.length);
    expect(out.map((c) => c.value)).toContain('de_DE-thorsten-medium');
  });
});

describe('handleAutocomplete', () => {
  // Minimal deps: the handler only reads deps.availableModels in the 'model' branch.
  const deps = { availableModels: ['pt_PT-tugao-medium', 'en_US-amy-medium'] } as any;

  it('focused option is "model": responds with the filtered choices', async () => {
    const respond = vi.fn();
    const i = {
      options: { getFocused: () => ({ name: 'model', value: 'amy' }) },
      respond,
    } as any;
    await handleAutocomplete(i, deps);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith([{ name: 'English (US)', value: 'en_US-amy-medium' }]);
  });

  it('focused option is NOT "model": responds [] (non-model branch)', async () => {
    const respond = vi.fn();
    const i = {
      options: { getFocused: () => ({ name: 'speed', value: '1.0' }) },
      respond,
    } as any;
    await handleAutocomplete(i, deps);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith([]);
  });

  it('focused option is "locale" (/config language): responds with filtered locales (<=25)', async () => {
    const respond = vi.fn();
    const i = {
      options: { getFocused: () => ({ name: 'locale', value: 'portu' }) },
      respond,
    } as any;
    await handleAutocomplete(i, deps);
    expect(respond).toHaveBeenCalledTimes(1);
    const arg = respond.mock.calls[0][0] as { name: string; value: string }[];
    expect(arg.length).toBeLessThanOrEqual(25);
    expect(arg).toContainEqual({ name: 'Português', value: 'pt' });
  });

  it('focused option is "locale" with an empty query: cuts to 25 (34 > 25)', async () => {
    const respond = vi.fn();
    const i = {
      options: { getFocused: () => ({ name: 'locale', value: '' }) },
      respond,
    } as any;
    await handleAutocomplete(i, deps);
    const arg = respond.mock.calls[0][0] as unknown[];
    expect(arg.length).toBe(25);
  });

  // Anti-"Failed to load options" hardening (reported intermittent bug): autocomplete
  // cannot be deferred and the token dies ~3s after the keystroke.

  it('an interaction that arrives >2.5s late is IGNORED (token almost dead; responding would give 10062)', async () => {
    const respond = vi.fn();
    const i = {
      commandName: 'game',
      createdTimestamp: Date.now() - 3000, // 3s of gateway->bot delay
      options: { getFocused: () => ({ name: 'game', value: '' }) },
      respond,
    } as any;
    await handleAutocomplete(i, deps);
    expect(respond).not.toHaveBeenCalled();
  });

  it('a respond that blows up with 10062 (late response) neither propagates nor blows up', async () => {
    const err = Object.assign(new Error('Unknown interaction'), { code: 10062 });
    const i = {
      commandName: 'voice',
      createdTimestamp: Date.now(),
      options: { getFocused: () => ({ name: 'model', value: '' }) },
      respond: vi.fn().mockRejectedValue(err),
    } as any;
    await expect(handleAutocomplete(i, deps)).resolves.toBeUndefined();
  });
});

describe('sanitizeAutocompleteChoices — Discord limits (1 invalid entry = whole payload rejected)', () => {
  it('cuts to 25 entries', () => {
    const many = Array.from({ length: 40 }, (_, k) => ({ name: `n${k}`, value: `v${k}` }));
    expect(sanitizeAutocompleteChoices(many).length).toBe(25);
  });

  it('truncates name and value to 100 chars', () => {
    const out = sanitizeAutocompleteChoices([{ name: 'x'.repeat(150), value: 'y'.repeat(150) }]);
    expect(out[0].name.length).toBe(100);
    expect(out[0].value.length).toBe(100);
  });

  it('empty/whitespace-only name becomes a placeholder (a 0-char name is a 400 from the API)', () => {
    const out = sanitizeAutocompleteChoices([{ name: '   ', value: 'v' }]);
    expect(out[0].name).toBe('—');
    expect(out[0].value).toBe('v');
  });

  it('valid entries pass through intact', () => {
    const input = [{ name: 'Português', value: 'pt' }];
    expect(sanitizeAutocompleteChoices(input)).toEqual(input);
  });
});

describe('/config language — locale option uses autocomplete (34 > 25 choices)', () => {
  it('the `locale` option of /config language is autocomplete and WITHOUT static choices', () => {
    const config = commandDefs.find((c) => c.name === 'config') as any;
    const langSub = config.options.find((o: any) => o.name === 'language');
    expect(langSub, 'subcomando language nao encontrado').toBeDefined();
    const localeOpt = langSub.options.find((o: any) => o.name === 'locale');
    expect(localeOpt, 'option locale nao encontrado').toBeDefined();
    expect(localeOpt.autocomplete).toBe(true);
    // With autocomplete it CANNOT have static choices (Discord rejects both and the
    // limit of 25 would be exceeded by the 34 languages).
    expect(localeOpt.choices ?? []).toHaveLength(0);
  });
});
