import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import type { MediaItem } from '@/context/AppContext.types';
import { isNativePlatform } from '@/lib/platform';
import { isHeadingPlaceholder } from '@/lib/headingFilter';
import { mediaRowToItem, SEARCH_PAGE_SIZE, type SearchCategory } from '@/lib/mediaSearch';
import { logger } from '@/lib/logger';

export function useMediaSearch(query: string, category: SearchCategory) {
  const { parsedMedia, loadingSources, parsingPlaylist } = useAppContext();
  const native = isNativePlatform();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const offset = useRef(0);
  const busy = useRef(false);
  // Native queries must not re-run as the in-memory catalog hydrates.
  const webMedia = native ? null : parsedMedia;

  const loadPage = useCallback(async (reset: boolean, version: number) => {
    if (busy.current && !reset) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      let next: MediaItem[];
      let more: boolean;
      let consumed: number;
      if (native) {
        const db = await import('@/lib/localDb');
        const page = await db.searchMediaLocal(query, category, reset ? 0 : offset.current);
        consumed = page.rows.length;
        next = page.rows.map(mediaRowToItem).filter((m) => !isHeadingPlaceholder(m.title));
        more = page.hasMore;
      } else {
        const term = query.trim().toLowerCase();
        const matches = (webMedia || []).filter((m) =>
          !isHeadingPlaceholder(m.title) && (category === 'all' || m.category === category) &&
          (!term || m.title.toLowerCase().includes(term) || m.genre.toLowerCase().includes(term)),
        );
        const start = reset ? 0 : offset.current;
        next = matches.slice(start, start + SEARCH_PAGE_SIZE);
        consumed = next.length;
        more = start + consumed < matches.length;
      }
      if (version !== generation.current) return;
      offset.current = (reset ? 0 : offset.current) + consumed;
      setItems((prev) => reset ? next : [...prev, ...next]);
      setHasMore(more);
    } catch (e) {
      if (version !== generation.current) return;
      logger.error('Search', 'Library search failed', { error: String(e) });
      setError(true);
    } finally {
      if (version === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [native, query, category, webMedia]);

  useEffect(() => {
    const version = ++generation.current;
    offset.current = 0;
    busy.current = false;
    setItems([]);
    setHasMore(false);
    setLoading(true);
    setError(false);
    if (loadingSources || parsingPlaylist) return;
    const timer = setTimeout(() => void loadPage(true, version), 250);
    return () => { clearTimeout(timer); generation.current++; };
  }, [loadPage, loadingSources, parsingPlaylist, retry]);

  return { items, hasMore, loading, error,
    loadMore: () => void loadPage(false, generation.current),
    retry: () => setRetry((n) => n + 1),
  };
}