import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface M3UItem {
  id: string;
  title: string;
  group: string;
  logo: string;
  url: string;
  tvgId: string;
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
      const groupMatch = info.match(/group-title=\"([^\"]*)\"/);
      const logoMatch = info.match(/tvg-logo=\"([^\"]*)\"/);
      const tvgIdMatch = info.match(/tvg-id=\"([^\"]*)\"/);

      const title = titleMatch?.[1]?.trim() || 'Unknown';
      const group = groupMatch?.[1] || 'Uncategorized';
      const logo = logoMatch?.[1] || '';
      const tvgId = tvgIdMatch?.[1] || '';

      const groupLower = group.toLowerCase();
      let category: M3UItem['category'] = 'channel';
      if (groupLower.includes('movie') || groupLower.includes('film')) category = 'movie';
      else if (groupLower.includes('series') || groupLower.includes('show')) category = 'series';
      else if (groupLower.includes('vod')) category = 'vod';

      items.push({
        id: crypto.randomUUID(),
        title,
        group,
        logo,
        url: streamUrl,
        tvgId,
        category,
      });
    } else {
      i++;
    }
  }

  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, type, username, password } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let playlistUrl = url;

    if (type === 'xtream' && username && password) {
      let base = url.replace(/\/$/, '');

      // Strip protocol and re-add as http
      base = base.replace(/^https?:\/\//i, '');
      base = 'http://' + base;

      // Remove any existing endpoint paths
      base = base.replace(/\/player_api\.php.*$/i, '');
      base = base.replace(/\/get\.php.*$/i, '');
      // Remove trailing port-path noise
      base = base.replace(/\/$/, '');

      playlistUrl =
        `${base}/player_api.php?username=${encodeURIComponent(username)}` +
        `&password=${encodeURIComponent(password)}&action=get_live_streams`;

      console.log('[XTREAM] Constructed URL:', playlistUrl);

      // For Xtream, fetch JSON and convert to M3U-style items
      console.log('[FETCH] Requesting Xtream API:', playlistUrl);
      const response = await fetch(playlistUrl, {
        headers: { 'User-Agent': 'okhttp/4.9.2', 'Accept': '*/*' },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return new Response(JSON.stringify({
          error: `Failed to fetch Xtream API: ${response.status} ${response.statusText}`,
          details: body.substring(0, 500),
          requestUrl: playlistUrl,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Xtream returns JSON array of streams
      const streams = await response.json();
      const items = (Array.isArray(streams) ? streams : []).map((s: any) => ({
        id: crypto.randomUUID(),
        title: s.name || 'Unknown',
        group: s.category_name || 'Uncategorized',
        logo: s.stream_icon || '',
        url: `${base.replace('/player_api.php', '')}/${username}/${password}/${s.stream_id}`,
        tvgId: s.epg_channel_id || '',
        category: 'channel' as const,
      }));

      const groups = [...new Set(items.map((i: any) => i.group))].sort();
      return new Response(JSON.stringify({ items, groups, total: items.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[FETCH] Requesting playlist from:', playlistUrl);

    const response = await fetch(playlistUrl, {
      headers: {
        'User-Agent': 'okhttp/4.9.2',
        'Accept': '*/*'
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return new Response(JSON.stringify({
        error: `Failed to fetch playlist: ${response.status} ${response.statusText}`,
        details: body.substring(0, 500),
        requestUrl: playlistUrl,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = await response.text();
    const items = parseM3U(content);
    const groups = [...new Set(items.map(i => i.group))].sort();

    return new Response(JSON.stringify({
      items,
      groups,
      total: items.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
