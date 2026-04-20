/**
 * Client-side M3U / Xtream playlist parser.
 * Mirrors the logic from the parse-playlist edge function so native builds
 * can parse playlists without hitting the server.
 */

import { logger } from './logger';

export interface ParsedItem {
  title: string;
  group: string;
  logo: string;
  url: string;
  category: 'movie' | 'series' | 'vod' | 'channel';
  tvgId?: string;
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
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const items: ParsedItem[] = [];
  let i = 0;
  let epgUrl: string | undefined;

  // Detect EPG URL from header
  for (let j = 0; j < Math.min(lines.length, 5); j++) {
    if (lines[j].startsWith('#EXTM3U')) {
      const match =
        lines[j].match(/url-tvg="([^"]+)"/i) ||
        lines[j].match(/x-tvg-url="([^"]+)"/i) ||
        lines[j].match(/tvg-url="([^"]+)"/i);

      if (match?.[1]) {
        epgUrl = match[1].split(',')[0].trim(); // take first if multiple
        break;
      }
    }
  }
  while (i < lines.length) {
    if (lines[i].startsWith('#EXTINF:')) {
      const info = lines[i];
      const streamUrl = lines[i + 1] || '';
      i += 2;

      const titleMatch = info.match(/,(.+)$/);
      const groupMatch = info.match(/group-title="([^"]*)"/);
      const logoMatch = info.match(/tvg-logo="([^"]*)"/);
      const tvgIdMatch = info.match(/tvg-id="([^"]*)"/);

      const title = titleMatch?.[1]?.trim() || 'Unknown';
      const group = groupMatch?.[1] || 'Uncategorized';
      const logo = logoMatch?.[1] || '';
      const tvgId = tvgIdMatch?.[1] || undefined;

      const groupLower = group.toLowerCase();
      let category: ParsedItem['category'] = 'channel';
      if (groupLower.includes('movie') || groupLower.includes('film')) category = 'movie';
      else if (groupLower.includes('series') || groupLower.includes('show')) category = 'series';
      else if (groupLower.includes('vod')) category = 'vod';

      items.push({ title, group, logo, url: streamUrl, category, tvgId });
    } else {
      i++;
    }
  }

  return { items, epgUrl };
}

// ── Xtream parser ───────────────────────────────────────────

async function parseXtream(baseUrl: string, username: string, password: string): Promise<ParsedItem[]> {
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

  const [liveRes, vodRes, seriesRes, liveCatRes, vodCatRes, seriesCatRes] = await Promise.all([
    fetch(`${apiBase}&action=get_live_streams`, fetchOpts),
    fetch(`${apiBase}&action=get_vod_streams`, fetchOpts),
    fetch(`${apiBase}&action=get_series`, fetchOpts),
    fetch(`${apiBase}&action=get_live_categories`, fetchOpts),
    fetch(`${apiBase}&action=get_vod_categories`, fetchOpts),
    fetch(`${apiBase}&action=get_series_categories`, fetchOpts),
  ]);

  const [liveStreams, vodStreams, seriesStreams, liveCats, vodCats, seriesCats] = await Promise.all([
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
      if (c.category_id && c.category_name) map[String(c.category_id)] = c.category_name;
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
      tvgId: s.epg_channel_id || s.epg_channel || s.tvg_id || undefined,
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

    // Auto-build Xtream EPG URL
    let base = url.replace(/\/$/, '');
    base = base.replace(/^https?:\/\//i, '');
    base = base.replace(/\/player_api\.php.*$/i, '');
    base = base.replace(/\/get\.php.*$/i, '');

    epgUrl = `http://${base}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    logger.info('PlaylistParser', '📺 Xtream EPG URL generated', { epgUrl });
  } else {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'okhttp/4.9.2', Accept: '*/*' },
    });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const result = parseM3U(await response.text());
    items = result.items;
    epgUrl = result.epgUrl;
    if (epgUrl) {
      logger.info('PlaylistParser', '📺 M3U EPG URL found', { epgUrl });
    }
  }

  return {
    items,
    total: items.length,
    channels: items.filter((i) => i.category === 'channel').length,
    movies: items.filter((i) => i.category === 'movie').length,
    series: items.filter((i) => i.category === 'series').length,
    epgUrl,
  };
}

// ── Series info (native/local) ──────────────────────────────

export interface LocalEpisode {
  id: string;
  episodeNum: string;
  title: string;
  containerId: string;
  duration: string | null;
  plot: string | null;
  rating: string | null;
  image: string | null;
  streamUrl: string;
}

export interface LocalSeriesInfo {
  name: string;
  cover: string;
  plot: string;
  seasons: string[];
  episodes: Record<string, LocalEpisode[]>;
}

/**
 * Fetches series episode info directly from the Xtream API.
 * Used on native builds to avoid the Supabase edge function round-trip.
 */
export async function getSeriesInfoLocally(
  sourceUrl: string,
  username: string,
  password: string,
  streamUrl: string, // e.g. https://host/series/user/pass/12345
): Promise<LocalSeriesInfo> {
  // Extract series_id from the stream URL
  const parts = streamUrl.split('/');
  const seriesId = parts[parts.length - 1];

  let base = sourceUrl.replace(/\/$/, '');
  base = base.replace(/^https?:\/\//i, '');
  base = 'http://' + base;
  base = base.replace(/\/player_api\.php.*$/i, '');
  base = base.replace(/\/get\.php.*$/i, '');
  base = base.replace(/\/$/, '');

  const streamBase = base.replace(/^http:\/\//i, 'https://');
  const apiUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${seriesId}`;

  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'okhttp/4.9.2', Accept: '*/*' },
  });

  if (!res.ok) throw new Error(`Provider returned ${res.status}`);

  const data = await res.json();
  const info = data.info || {};
  const episodes: Record<string, LocalEpisode[]> = {};

  if (data.episodes) {
    for (const [seasonNum, eps] of Object.entries(data.episodes)) {
      if (Array.isArray(eps)) {
        episodes[seasonNum] = (eps as any[]).map((ep: any) => ({
          id: ep.id,
          episodeNum: ep.episode_num,
          title: ep.title || `Episode ${ep.episode_num}`,
          containerId: ep.container_extension || 'mp4',
          duration: ep.info?.duration || null,
          plot: ep.info?.plot || null,
          rating: ep.info?.rating || null,
          image: ep.info?.movie_image || null,
          streamUrl: `${streamBase}/series/${username}/${password}/${ep.id}.${ep.container_extension || 'mp4'}`,
        }));
      }
    }
  }

  return {
    name: info.name || '',
    cover: info.cover || '',
    plot: info.plot || '',
    seasons: Object.keys(episodes).sort((a, b) => Number(a) - Number(b)),
    episodes,
  };
}
