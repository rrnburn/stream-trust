const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get('TMDB_API_KEY');
    if (!key) return json({ error: 'TMDB_API_KEY not configured' }, 500);
    const { title, year, type } = await req.json();
    if (typeof title !== 'string' || !title.trim() || title.length > 200) return json({ error: 'Invalid title' }, 400);
    const kind = type === 'series' ? 'tv' : 'movie';
    const y = Number.isInteger(year) && year > 1880 && year < 2100 ? year : undefined;

    // Support both v3 API keys and v4 read tokens
    const isBearer = key.length > 40;
    const call = async (path: string, params: Record<string, string> = {}) => {
      const u = new URL(`https://api.themoviedb.org/3${path}`);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      if (!isBearer) u.searchParams.set('api_key', key);
      const r = await fetch(u, { headers: isBearer ? { Authorization: `Bearer ${key}` } : {} });
      if (!r.ok) throw new Error(`TMDB ${r.status}`);
      return r.json();
    };

    const search = async (withYear: boolean) => {
      const p: Record<string, string> = { query: title.trim(), include_adult: 'false' };
      if (withYear && y) p[kind === 'tv' ? 'first_air_date_year' : 'year'] = String(y);
      return (await call(`/search/${kind}`, p)).results?.[0];
    };
    const hit = (await search(true)) || (y ? await search(false) : undefined);
    if (!hit) return json({ found: false });

    const d = await call(`/${kind}/${hit.id}`, { append_to_response: 'credits' });
    const img = (p?: string | null, size = 'w185') => (p ? `https://image.tmdb.org/t/p/${size}${p}` : '');
    const directors =
      kind === 'tv'
        ? (d.created_by || []).map((c: any) => c.name)
        : (d.credits?.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => c.name);

    return json({
      found: true,
      tmdbId: d.id,
      overview: d.overview || '',
      tagline: d.tagline || '',
      year: (d.release_date || d.first_air_date || '').slice(0, 4),
      rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
      runtime: d.runtime || d.episode_run_time?.[0] || undefined,
      genres: (d.genres || []).map((g: any) => g.name),
      backdrop: img(d.backdrop_path, 'w1280'),
      poster: img(d.poster_path, 'w500'),
      directorLabel: kind === 'tv' ? 'Created by' : 'Director',
      directors,
      cast: (d.credits?.cast || []).slice(0, 8).map((c: any) => ({
        name: c.name,
        character: c.character || '',
        photo: img(c.profile_path),
      })),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
