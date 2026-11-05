import { describe, expect, it } from 'vitest';
import { buildMediaSearch, SEARCH_PAGE_SIZE } from './mediaSearch';

describe('native library search queries', () => {
  it('uses title and genre matching with bound category values', () => {
    const search = buildMediaSearch(' Zodiac ', 'movie');
    expect(search.values).toEqual(['%Zodiac%', '%Zodiac%', 'movie', 31, 0]);
    expect(search.statement).toContain('title LIKE ?');
    expect(search.statement).toContain('genre LIKE ?');
    expect(search.statement).toContain('category = ?');
  });
  it('treats SQL wildcard characters and quotes as literal search input', () => {
    const search = buildMediaSearch("50%_\\'", 'all');
    expect(search.values[0]).toBe("%50\\%\\_\\\\'%");
    expect(search.statement).not.toContain('50');
  });
  it('requests 30 results plus lookahead from the requested offset', () => {
    expect(SEARCH_PAGE_SIZE).toBe(30);
    expect(buildMediaSearch('', 'all', 300).values).toEqual([31, 300]);
  });
});