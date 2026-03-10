/**
 * Client-side M3U / Xtream playlist parser.
 * Mirrors the logic from the parse-playlist edge function so native builds
 * can parse playlists without hitting the server.
 */

export interface ParsedItem {
  title: string;
  group: string;
  logo: string;
  url: string;
  category: 'movie' | 'series' | 'vod' | 'channel';
}

export interface ParseResult {
  items: ParsedItem[];
  total: number;
  channels: number;
  movies: number;
  series: number;
  epgUrl?: string;
}

// ── M3U parser ──────────────────────────────────────────────

function parseM3U(content: string): { items: ParsedItem[]; epgUrl?: string } {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];
  let i = 0;
  let epgUrl: string | undefined;

  if (lines[0]?.startsWith('#EXTM3U')) {
    // Extract url-tvg from the #EXTM3U header
    const tvgMatch = lines[0].match(/url-tvg="([^"]*)"/i);
    if (tvgMatch?.[1]) epgUrl = tvgMatch[1];
    i = 1;
  }

  while (i < lines.length) {
    if (lines[i].startsWith('#EXTINF:')) {
      const info = lines[i];
      const streamUrl = lines[i + 1] || '';
      i += 2;

      const titleMatch = info.match(/,(.+)$/);
      const groupMatch = info.match(/group-title="([^"]*)"/);
      const logoMatch = info.match(/tvg-logo="([^"]*)"/);

      const title = titleMatch?.[1]?.trim() || 'Unknown';
      const group = groupMatch?.[1] || 'Uncategorized';
      const logo = logoMatch?.[1] || '';

      const groupLower = group.toLowerCase();
      let category: ParsedItem['category'] = 'channel';
      if (groupLower.includes('movie') || groupLower.includes('film')) category = 'movie';
      else if (groupLower.includes('series') || groupLower.includes('show')) category = 'series';
      else if (groupLower.includes('vod')) category = 'vod';

      items.push({ title, group, logo, url: streamUrl, category });
    } else {
      i++;
    }
  }

  return { items, epgUrl };
}

// ── Xtream parser ───────────────────────────────────────────

async function parseXtream(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ParsedItem[]> {
  let base = baseUrl.replace(/\/$/, '');
  // Preserve original protocol from user's source URL
  const originalProtocol = /^https:\/\//i.test(base) ? 'https://' : 'http://';
  base = base.replace(/^https?:\/\//i, '');
  base = 'http://' + base;
  base = base.replace(/\/player_api\.php.*$/i, '');
  base = base.replace(/\/get\.php.*$/i, '');
  base = base.replace(/\/$/, '');

  const apiBase = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  // Use original protocol for stream URLs instead of forcing HTTPS
  const streamBase = base.replace(/^http:\/\//i, originalProtocol);

  const fetchOpts: RequestInit = {
    headers: { 'User-Agent': 'okhttp/4.9.2', Accept: '*/*' },
  };

  const parseSafe = async (res: Response) => {
    if (!res.ok) return [];
    try {
      const j = await res.json();
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  };

  const [liveRes, vodRes, seriesRes, liveCatRes, vodCatRes, seriesCatRes] =
    await Promise.all([
      fetch(`${apiBase}&action=get_live_streams`, fetchOpts),
      fetch(`${apiBase}&action=get_vod_streams`, fetchOpts),
      fetch(`${apiBase}&action=get_series`, fetchOpts),
      fetch(`${apiBase}&action=get_live_categories`, fetchOpts),
      fetch(`${apiBase}&action=get_vod_categories`, fetchOpts),
      fetch(`${apiBase}&action=get_series_categories`, fetchOpts),
    ]);

  const [liveStreams, vodStreams, seriesStreams, liveCats, vodCats, seriesCats] =
    await Promise.all([
      parseSafe(liveRes),
      parseSafe(vodRes),
      parseSafe(seriesRes),
      parseSafe(liveCatRes),
      parseSafe(vodCatRes),
      parseSafe(seriesCatRes),
    ]);

  const buildCatMap = (cats: any[]) => {
    const map: Record<string, string> = {};
    for (const c of cats) {
      if (c.category_id && c.category_name)
        map[String(c.category_id)] = c.category_name;
    }
    return map;
  };

  const liveCatMap = buildCatMap(liveCats);
  const vodCatMap = buildCatMap(vodCats);
  const seriesCatMap = buildCatMap(seriesCats);

  return [
    ...liveStreams.map((s: any) => ({
      title: s.name || 'Unknown',
      group: liveCatMap[String(s.category_id)] || s.category_name || 'Uncategorized',
      logo: s.stream_icon || '',
      url: `${streamBase}/live/${username}/${password}/${s.stream_id}.m3u8`,
      category: 'channel' as const,
    })),
    ...vodStreams.map((s: any) => ({
      title: s.name || 'Unknown',
      group: vodCatMap[String(s.category_id)] || s.category_name || 'Uncategorized',
      logo: s.stream_icon || '',
      url: `${streamBase}/movie/${username}/${password}/${s.stream_id}.${s.container_extension || 'mp4'}`,
      category: 'movie' as const,
    })),
    ...seriesStreams.map((s: any) => ({
      title: s.name || 'Unknown',
      group: seriesCatMap[String(s.category_id)] || s.category_name || 'Uncategorized',
      logo: s.cover || '',
      url: `${streamBase}/series/${username}/${password}/${s.series_id}`,
      category: 'series' as const,
    })),
  ];
}

// ── Public API ──────────────────────────────────────────────

export async function parsePlaylistLocally(
  url: string,
  type: 'm3u' | 'xtream',
  username?: string,
  password?: string,
): Promise<ParseResult> {
  let items: ParsedItem[];
  let epgUrl: string | undefined;

  if (type === 'xtream' && username && password) {
    items = await parseXtream(url, username, password);
  } else {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'okhttp/4.9.2', Accept: '*/*' },
    });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const result = parseM3U(await response.text());
    items = result.items;
    epgUrl = result.epgUrl;
  }

  return {
    items,
    total: items.length,
    channels: items.filter(i => i.category === 'channel').length,
    movies: items.filter(i => i.category === 'movie').length,
    series: items.filter(i => i.category === 'series').length,
    epgUrl,
  };
}
