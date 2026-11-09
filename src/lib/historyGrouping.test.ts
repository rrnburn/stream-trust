import { describe, it, expect } from 'vitest';
import { parseHistoryId } from './historyGrouping';

describe('parseHistoryId', () => {
  it('maps season/episode IDs to parent series with badge', () => {
    expect(parseHistoryId('abc:s1e3:999')).toEqual({ parentId: 'abc', label: 'S1:E3' });
  });
  it('maps title-based episode IDs to parent', () => {
    expect(parseHistoryId('abc:ep:Pilot')).toEqual({ parentId: 'abc' });
  });
  it('returns null for plain media IDs', () => {
    expect(parseHistoryId('movie-1')).toBeNull();
  });
});
