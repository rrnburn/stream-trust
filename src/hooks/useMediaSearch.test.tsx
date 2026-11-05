import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaSearch } from './useMediaSearch';

const mocks = vi.hoisted(() => ({ search: vi.fn(), context: {
  parsedMedia: [], loadingSources: false, parsingPlaylist: false,
} }));
vi.mock('@/context/AppContext', () => ({ useAppContext: () => mocks.context }));
vi.mock('@/lib/platform', () => ({ isNativePlatform: () => true }));
vi.mock('@/lib/localDb', () => ({ searchMediaLocal: mocks.search }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const row = (id: string) => ({ id, title: id, category: 'movie', source_id: 'source' });

describe('full-library native search', () => {
  beforeEach(() => mocks.search.mockReset());
  it('finds a database result even when no catalog items have hydrated', async () => {
    mocks.search.mockResolvedValue({ rows: [row('item-48000')], hasMore: false });
    const { result } = renderHook(() => useMediaSearch('Zodiac', 'movie'));
    await waitFor(() => expect(result.current.items[0]?.id).toBe('item-48000'));
    expect(mocks.search).toHaveBeenCalledWith('Zodiac', 'movie', 0);
  });
  it('appends the next 30-item page without duplicating requests', async () => {
    mocks.search.mockResolvedValueOnce({ rows: Array.from({ length: 30 }, (_, i) => row(String(i))), hasMore: true })
      .mockResolvedValueOnce({ rows: [row('30')], hasMore: false });
    const { result } = renderHook(() => useMediaSearch('', 'all'));
    await waitFor(() => expect(result.current.items).toHaveLength(30));
    act(() => { result.current.loadMore(); result.current.loadMore(); });
    await waitFor(() => expect(result.current.items).toHaveLength(31));
    expect(mocks.search).toHaveBeenLastCalledWith('', 'all', 30);
    expect(mocks.search).toHaveBeenCalledTimes(2);
  });
  it('ignores a stale response after the search text changes', async () => {
    let resolveOld: ((value: { rows: ReturnType<typeof row>[]; hasMore: boolean }) => void) | undefined;
    mocks.search.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ rows: [row('new')], hasMore: false });
    const { result, rerender } = renderHook(({ query }) => useMediaSearch(query, 'all'), { initialProps: { query: 'old' } });
    await waitFor(() => expect(mocks.search).toHaveBeenCalledTimes(1));
    rerender({ query: 'new' });
    await waitFor(() => expect(result.current.items[0]?.id).toBe('new'));
    await act(async () => resolveOld?.({ rows: [row('old')], hasMore: false }));
    expect(result.current.items[0]?.id).toBe('new');
  });
});