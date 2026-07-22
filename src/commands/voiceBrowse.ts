import { makeLocalizedNamer } from '../language/voiceMap';

export type VoiceCatalogEngine = 'all' | 'local' | 'google';

export interface VoiceBrowseFilters {
  query?: string | null;
  locale?: string | null;
  engine?: VoiceCatalogEngine | null;
}

/**
 * Catalog-only browsing.  Model ids are never accepted from a component: this
 * function starts with the currently available runtime catalog and returns labels only.
 */
export function filterVoiceCatalog(
  models: readonly string[],
  filters: VoiceBrowseFilters,
  userLocale?: string,
): Array<{ id: string; label: string; engine: Exclude<VoiceCatalogEngine, 'all'> }> {
  const query = filters.query?.trim().toLowerCase() ?? '';
  const locale = filters.locale?.trim().toLowerCase() ?? '';
  const requestedEngine = filters.engine ?? 'all';
  const namer = makeLocalizedNamer(userLocale, [...models]);
  return [...new Set(models)]
    .map((id) => ({
      id,
      label: namer(id),
      engine: id.includes('-google-') ? ('google' as const) : ('local' as const),
    }))
    .filter((voice) => requestedEngine === 'all' || voice.engine === requestedEngine)
    .filter((voice) => !locale || voice.id.toLowerCase().startsWith(`${locale}_`))
    .filter(
      (voice) =>
        !query ||
        voice.label.toLowerCase().includes(query) ||
        voice.id.toLowerCase().includes(query),
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function paginateVoiceCatalog<T>(items: readonly T[], page: number, pageSize = 8) {
  const safePageSize = Math.max(1, Math.min(25, Math.floor(pageSize)));
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.max(0, Math.min(pageCount - 1, Math.floor(page)));
  return {
    page: safePage,
    pageCount,
    slice: items.slice(safePage * safePageSize, (safePage + 1) * safePageSize),
  };
}
