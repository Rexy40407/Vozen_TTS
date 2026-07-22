import { describe, expect, it } from 'vitest';
import { filterVoiceCatalog, paginateVoiceCatalog } from '../src/commands/voiceBrowse';

describe('voice catalog browsing', () => {
  const models = ['en_US-amy-medium', 'pt_PT-tugao-medium', 'ja_JP-google-medium'];

  it('uses only available catalog entries and filters by locale, query and engine', () => {
    expect(filterVoiceCatalog(models, { locale: 'pt' }).map((voice) => voice.id)).toEqual([
      'pt_PT-tugao-medium',
    ]);
    expect(
      filterVoiceCatalog(models, { query: 'amy', engine: 'local' }).map((voice) => voice.id),
    ).toEqual(['en_US-amy-medium']);
    expect(filterVoiceCatalog(models, { engine: 'google' }).map((voice) => voice.id)).toEqual([
      'ja_JP-google-medium',
    ]);
  });

  it('paginates with bounded, stale-safe page indexes', () => {
    const page = paginateVoiceCatalog(['a', 'b', 'c'], 99, 2);
    expect(page.page).toBe(1);
    expect(page.slice).toEqual(['c']);
    expect(paginateVoiceCatalog(['a'], -1, 2).page).toBe(0);
  });
});
