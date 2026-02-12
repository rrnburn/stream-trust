import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

      if (!/^https?:\/\//i.test(base)) {
        base = 'http://' + base;
      }

      base = base.replace(/\/player_api\.php.*$/i, '');
      base = base.replace(/\/get\.php.*$/i, '');

      playlistUrl =
        `${base}/get.php?username=${encodeURIComponent(username)}` +
        `&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;

      console.log('[XTREAM] Constructed URL:', playlistUrl);
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
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
