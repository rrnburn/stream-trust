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

  // Skip header
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

      // Categorize
      const groupLower = group.toLowerCase();
      let category: M3UItem['category'] = 'channel';
      if (groupLower.includes('movie') || groupLower.includes('film')) category = 'movie';
      else if (groupLower.includes('series') || groupLower.includes('show') || groupLower.includes('episode')) category = 'series';
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

    // Build Xtream API URL for playlist
    if (type === 'xtream' && username && password) {
      // Normalize base and ensure protocol
      let base = url.replace(/\/$/, '');
      if (!/^https?:\/\/i.test(base)) base = 'http://' + base;

      // If caller passed a full endpoint (get.php, player_api.php, or .m3u) append params properly,
      // otherwise use the standard /get.php endpoint.
      const hasEndpoint = /get\.php|player_api\.php|\.m3u/i.test(base);
      if (hasEndpoint) {
        const sep = base.includes('?') ? '&' : '?';
        playlistUrl = `${base}${sep}username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
      } else {
        playlistUrl = `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u`;
      }

      // One-line debug to help track constructed URL
      console.log('[XTREAM] Constructed URL:', playlistUrl);
    }

    console.log('[FETCH] Requesting playlist from:', playlistUrl);

    const response = await fetch(playlistUrl, {
      headers: { 'User-Agent': 'StreamVault/1.0' },
    });

    // If the initial request failed and this was an Xtream request, try a fallback to player_api.php
    if (!response.ok && type === 'xtream' && username && password) {
      console.log('[RESPONSE] Primary status:', response.status, response.statusText);

      // Attempt a fallback URL using player_api.php
      try {
        let fallbackUrl = playlistUrl;

        // If playlistUrl already contains player_api.php, just reuse it; otherwise construct one.
        if (!/player_api\.php/i.test(fallbackUrl)) {
          if (/get\.php/i.test(fallbackUrl)) {
            fallbackUrl = fallbackUrl.replace(/get\.php/i, 'player_api.php');
          } else {
            // Remove query portion and append player_api.php with params
            const baseNoQuery = playlistUrl.split('?')[0].replace(/\/$/, '');
            fallbackUrl = `${baseNoQuery}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`;
          }
        }

        console.log('[XTREAM] Trying fallback URL:', fallbackUrl);
        const fallbackResp = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'StreamVault/1.0' },
        });

        console.log('[FALLBACK RESPONSE] Status:', fallbackResp.status, fallbackResp.statusText);

        if (fallbackResp.ok) {
          const content = await fallbackResp.text();
          const items = parseM3U(content);
          const groups = [...new Set(items.map(i => i.group))].sort();
          return new Response(JSON.stringify({
            items,
            groups,
            total: items.length,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Read a snippet of the fallback body to help debugging
          const fbBody = await fallbackResp.text().catch(() => '');
          return new Response(JSON.stringify({
            error: `Failed to fetch playlist (primary: ${response.status} ${response.statusText}; fallback: ${fallbackResp.status} ${fallbackResp.statusText})`,
            primary: { url: playlistUrl, status: response.status, statusText: response.statusText },
            fallback: { url: fallbackUrl, status: fallbackResp.status, statusText: fallbackResp.statusText, body: fbBody.substring(0, 500) },
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (fbErr) {
        console.error('[FALLBACK ERROR]', fbErr);
        return new Response(JSON.stringify({
          error: `Failed to fetch playlist: primary returned ${response.status} ${response.statusText}`,
          fallbackError: fbErr.message,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Existing behavior for non-xtream or if no fallback applies
    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      console.log('[ERROR] Response body:', responseBody.substring(0, 500));
      return new Response(JSON.stringify({
        error: `Failed to fetch playlist: ${response.status} ${response.statusText}`,
        details: responseBody.substring(0, 500),
        requestUrl: playlistUrl,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = await response.text();
    const items = parseM3U(content);

    // Get unique groups
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
