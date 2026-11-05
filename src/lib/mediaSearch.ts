import type { MediaItem, MediaRow } from '@/context/AppContext.types';

export const SEARCH_PAGE_SIZE = 30;
export type SearchCategory = 'all' | MediaItem['category'];

export function mediaRowToItem(row: MediaRow): MediaItem {
  return {
    id: row.id, title: row.title, poster: row.poster || '', category: row.category,
    genre: row.genre || 'Uncategorized', description: row.description || '',
    sourceId: row.source_id, streamUrl: row.stream_url || '',
    group: row.group_name || undefined, tvgId: row.tvg_id || undefined,
  };
}

export function buildMediaSearch(query: string, category: SearchCategory, offset = 0) {
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  const term = query.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push("(title LIKE ? ESCAPE '\\' OR genre LIKE ? ESCAPE '\\')");
    values.push(pattern, pattern);
  }
  if (category !== 'all') {
    clauses.push('category = ?');
    values.push(category);
  }
  return {
    statement: `SELECT * FROM parsed_media ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY title COLLATE NOCASE, id LIMIT ? OFFSET ?`,
    values: [...values, SEARCH_PAGE_SIZE + 1, Math.max(0, Math.floor(offset))],
  };
}