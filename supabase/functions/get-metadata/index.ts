const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const PLATFORMS =
  /^\s*(?:NF|NETFLIX|AMZN|AMAZON|PRIME(?:\s*VIDEO)?|DSNP|DISNEY\+?|HBO(?:\s*MAX)?|MAX|ATVP|APPLE(?:\s*TV\+?)?|HULU|PEACOCK|PARAMOUNT\+?|P\+|BBC|ITV|SKY(?:\s*CINEMA)?|STARZ|SHOWTIME|NOW)\s*[-|:–•/]\s*/i;
const NOISE =
  /\b(4K|UHD|FHD|HD|SD|HDR(?:10\+?)?|DV|DOLBY(?:\s*VISION)?|IMAX|1080[pi]?|720[pi]?|2160[pi]?|480[pi]?|x264|x265|HEVC|H\.?26[45]|AVC|10bit|WEB-?DL|WEBRip|BluRay|BDRip|BRRip|DVDRip|HDTV|REMUX|DDP?5\.1|AAC|AC3|TrueHD|Atmos|DTS(?:-HD)?|MULTI|SUB|DUB|VOSTFR|PROPER|REPACK|EXTENDED|UNRATED|REMASTERED)\b/gi;

function clean(raw: string): { title: string; year?: number } {
  let t = raw;
  if (t.includes('.') && !t.includes(' ')) t = t.replace(/\./g, ' ');
  const ym = t.match(/(?:^|[([\s_.-])(19\d{2}|20\d{2})(?:[)\]\s_.-]|$)/);
  const year = ym ? Number(ym[1]) : undefined;
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^\s*(?:\|[^|]{1,12}\||\[[^\]]{1,12}\])\s*/, ' ')
      .replace(PLATFORMS, ' ')
      .replace(/^\s*[A-Z]{2,4}\s*[-|:–•/]\s*/, ' ');
  }
  t = t
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\bS\d{1,2}(?:\s*E\d{1,3})?\b/gi, ' ')
    .replace(/\bSeason\s*\d+\b/gi, ' ')
    .replace(NOISE, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[._]/g, ' ')
    .replace(/^\s*[-|:–•/]+\s*|\s*[-|:–•/]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { title: t || raw.trim(), year };
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
function similarity(a: string, b: string) {
  const A = new Set(norm(a).split(' ')), B = new Set(norm(b).split(' '));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return (2 * inter) / (A.size + B.size);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get('TMDB_API_KEY');
    if (!key) return json({ error: 'TMDB_API_KEY not configured' }, 500);
    const body = await req.json();
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)
      return json({ error: 'Invalid title' }, 400);
    const c = clean(body.title);
    const title = c.title;
    const y = Number.isInteger(body.year) && body.year > 1880 && body.year < 2100 ? body.year : c.year;
    const primary = body.type === 'series' ? 'tv' : 'movie';

    const isBearer = key.length > 40;
    const call = async (path: string, params: Record<string, string> = {}) => {
      const u = new URL(`https://api.themoviedb.org/3${path}`);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      if (!isBearer) u.searchParams.set('api_key', key);
      const r = await fetch(u, { headers: isBearer ? { Authorization: `Bearer ${key}` } : {} });
      if (!r.ok) throw new Error(`TMDB ${r.status}`);
      return r.json();
    };

    const search = async (kind: string, q: string, withYear: boolean): Promise<any[]> => {
      const p: Record<string, string> = { query: q, include_adult: 'false' };
      if (withYear && y) p[kind === 'tv' ? 'first_air_date_year' : 'year'] = String(y);
      return (await call(`/search/${kind}`, p)).results || [];
    };

    const pick = (results: any[], q: string) => {
      let best: any, bestScore = 0;
      for (const r of results.slice(0, 10)) {
        const name = r.title || r.name || '';
        const ry = Number((r.release_date || r.first_air_date || '').slice(0, 4));
        let s = Math.max(similarity(q, name), similarity(q, r.original_title || r.original_name || ''));
        if (y && ry) s += Math.abs(ry - y) <= 1 ? 0.3 : -0.2;
        s += Math.min(Math.log10((r.vote_count || 0) + 1) / 20, 0.15);
        if (s > bestScore) { best = r; bestScore = s; }
      }
      return bestScore >= 0.45 ? best : undefined;
    };

    const variants = [title];
    const sub = title.split(/\s[-–:]\s|:\s/)[0].trim();
    if (sub && sub !== title && sub.length > 2) variants.push(sub);

    let hit: any, kind = primary;
    outer: for (const k of [primary, primary === 'tv' ? 'movie' : 'tv']) {
      for (const q of variants) {
        for (const withYear of y ? [true, false] : [false]) {
          const h = pick(await search(k, q, withYear), q);
          if (h) { hit = h; kind = k; break outer; }
        }
      }
    }
    if (!hit) return json({ found: false, query: title });

    const d = await call(`/${kind}/${hit.id}`, { append_to_response: 'credits' });
    const img = (p?: string | null, size = 'w185') => (p ? `https://image.tmdb.org/t/p/${size}${p}` : '');
    const directors =
      kind === 'tv'
        ? (d.created_by || []).map((x: any) => x.name)
        : (d.credits?.crew || []).filter((x: any) => x.job === 'Director').map((x: any) => x.name);

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
      cast: (d.credits?.cast || []).slice(0, 8).map((x: any) => ({
        name: x.name,
        character: x.character || '',
        photo: img(x.profile_path),
      })),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
