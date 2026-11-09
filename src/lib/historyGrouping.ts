// Maps episode history IDs (`<seriesId>:s1e3:<epId>` or `<seriesId>:ep:<title>`) to their parent series.
export interface EpisodeRef {
  parentId: string;
  label?: string; // e.g. "S1:E3"
}

export function parseHistoryId(id: string): EpisodeRef | null {
  const m = id.match(/^(.*?):s(\d+)e(\d+)(?::|$)/i);
  if (m) return { parentId: m[1], label: `S${m[2]}:E${m[3]}` };
  const i = id.indexOf(':ep:');
  if (i > 0) return { parentId: id.slice(0, i) };
  return null;
}
