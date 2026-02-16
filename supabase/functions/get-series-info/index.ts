import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, username, password, seriesId } = await req.json();

    if (!baseUrl || !username || !password || !seriesId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize base URL
    let base = baseUrl.replace(/\/$/, '');
    base = base.replace(/^https?:\/\//i, '');
    base = 'http://' + base;
    base = base.replace(/\/player_api\.php.*$/i, '');
    base = base.replace(/\/get\.php.*$/i, '');
    base = base.replace(/\/$/, '');

    const apiUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${seriesId}`;
    
    console.log('[SERIES-INFO] Fetching:', apiUrl);

    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'okhttp/4.9.2', 'Accept': '*/*' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Provider returned ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    
    // Build HTTPS stream base for episode URLs
    const streamBase = base.replace(/^http:\/\//i, 'https://');

    // Structure the response
    const info = data.info || {};
    const episodes: Record<string, any[]> = {};

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

    return new Response(JSON.stringify({
      name: info.name || '',
      cover: info.cover || '',
      plot: info.plot || '',
      cast: info.cast || '',
      genre: info.genre || '',
      rating: info.rating || null,
      seasons: Object.keys(episodes).sort((a, b) => Number(a) - Number(b)),
      episodes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SERIES-INFO] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
