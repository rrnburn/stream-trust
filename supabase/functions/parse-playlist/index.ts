
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface M3UItem {
  title: string;
  group: string;
  logo: string;
  url: string;
  category: 'movie' | 'series' | 'vod' | 'channel';
}

function parseM3U(content: string): M3UItem[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const items: M3UItem[] = [];
  let i = 0;

  if (lines[0]?.startsWith('#EXTM3U')) i = 1;

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
      let category: M3UItem['category'] = 'channel';
      if (groupLower.includes('movie') || groupLower.includes('film')) category = 'movie';
      else if (groupLower.includes('series') || groupLower.includes('show')) category = 'series';
      else if (groupLower.includes('vod')) category = 'vod';

      items.push({ title, group, logo, url: streamUrl, category });
    } else {
      i++;
    }
  }

  return items;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, type, username, password, sourceId, userId, sourceName } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client for server-side DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let items: M3UItem[] = [];

    if (type === 'xtream' && username && password) {
      let base = url.replace(/\/$/, '');
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

      console.log('[XTREAM] API base:', apiBase);
      console.log('[XTREAM] Stream base (HTTPS):', streamBase);

      const fetchOpts = { headers: { 'User-Agent': 'okhttp/4.9.2', 'Accept': '*/*' } };
      const [liveRes, vodRes, seriesRes, liveCatRes, vodCatRes, seriesCatRes] = await Promise.all([
        fetch(`${apiBase}&action=get_live_streams`, fetchOpts),
        fetch(`${apiBase}&action=get_vod_streams`, fetchOpts),
        fetch(`${apiBase}&action=get_series`, fetchOpts),
        fetch(`${apiBase}&action=get_live_categories`, fetchOpts),
        fetch(`${apiBase}&action=get_vod_categories`, fetchOpts),
        fetch(`${apiBase}&action=get_series_categories`, fetchOpts),
      ]);

      const parseSafe = async (res: Response) => {
        if (!res.ok) return [];
        try { const j = await res.json(); return Array.isArray(j) ? j : []; }
        catch { return []; }
      };

      const [liveStreams, vodStreams, seriesStreams, liveCats, vodCats, seriesCats] = await Promise.all([
        parseSafe(liveRes), parseSafe(vodRes), parseSafe(seriesRes),
        parseSafe(liveCatRes), parseSafe(vodCatRes), parseSafe(seriesCatRes),
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

      console.log(`[XTREAM] Fetched: ${liveStreams.length} live, ${vodStreams.length} VOD, ${seriesStreams.length} series`);
      console.log(`[XTREAM] Categories: ${Object.keys(liveCatMap).length} live, ${Object.keys(vodCatMap).length} VOD, ${Object.keys(seriesCatMap).length} series`);

      items = [
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
          url: `${streamBase}/movie/${username}/${password}/${s.stream_id}.mp4`,
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
    } else {
      console.log('[FETCH] Requesting playlist from:', url);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'okhttp/4.9.2', 'Accept': '*/*' },
      });
      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch: ${response.status}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      items = parseM3U(await response.text());
    }

    // If sourceId and userId provided, insert directly into DB (server-side)
    if (sourceId && userId && items.length > 0) {
      console.log(`[DB] Inserting ${items.length} items for source ${sourceId}`);

      // Delete old records
      const { error: delErr } = await supabase.from('parsed_media').delete().eq('source_id', sourceId);
      if (delErr) console.error('[DB] Delete error:', delErr.message);

      // Batch insert 500 at a time
      let inserted = 0;
      const batchSize = 500;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize).map(item => ({
          user_id: userId,
          source_id: sourceId,
          title: item.title,
          poster: item.logo || '',
          category: item.category,
          genre: item.group || 'Uncategorized',
          description: `From ${sourceName || 'source'}`,
          stream_url: item.url,
          group_name: item.group || null,
        }));

        const { error: insErr } = await supabase.from('parsed_media').insert(batch);
        if (insErr) {
          console.error(`[DB] Insert batch ${i / batchSize} error:`, insErr.message);
        } else {
          inserted += batch.length;
        }
      }

      console.log(`[DB] Inserted ${inserted} of ${items.length} items`);

      return new Response(JSON.stringify({
        total: items.length,
        inserted,
        channels: items.filter(i => i.category === 'channel').length,
        movies: items.filter(i => i.category === 'movie').length,
        series: items.filter(i => i.category === 'series').length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: return items (legacy mode)
    return new Response(JSON.stringify({
      items,
      total: items.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PARSE] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
