import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface CastMember { name: string; character: string; photo: string }
export interface Metadata {
  found: boolean;
  overview?: string;
  tagline?: string;
  year?: string;
  rating?: number;
  runtime?: number;
  genres?: string[];
  backdrop?: string;
  poster?: string;
  directorLabel?: string;
  directors?: string[];
  cast?: CastMember[];
}

const CACHE_PREFIX = 'meta:v1:';
const MISS_TTL = 7 * 24 * 3600 * 1000;

/** Strips IPTV noise (quality tags, codecs, language prefixes) to get a searchable title + year. */
export function cleanTitle(raw: string): { title: string; year?: number } {
  let t = raw;
  const yearMatch = t.match(/[([\s](19\d{2}|20\d{2})[)\]\s]?/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  t = t
    .replace(/^\s*[A-Z]{2,4}\s*[|:\-–]\s*/, '') // "EN | ", "UK - "
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(4K|UHD|FHD|HD|SD|HDR|1080p|720p|2160p|480p|x264|x265|HEVC|H\.?264|WEB-?DL|BluRay|DDP?5\.1|AAC|AC3|MULTI|SUB|DUB|VOSTFR)\b/gi, ' ')
    .replace(/[._]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { title: t || raw.trim(), year };
}

const inflight = new Map<string, Promise<Metadata>>();

export async function getMetadata(mediaId: string, rawTitle: string, type: 'movie' | 'series'): Promise<Metadata> {
  const key = CACHE_PREFIX + mediaId;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { at, data } = JSON.parse(cached);
      if (data.found || Date.now() - at < MISS_TTL) return data;
    }
  } catch { /* ignore */ }

  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const { title, year } = cleanTitle(rawTitle);
    const { data, error } = await supabase.functions.invoke('get-metadata', { body: { title, year, type } });
    if (error || data?.error) {
      logger.warn('Metadata', 'Lookup failed', { title, error: error?.message || data?.error });
      return { found: false } as Metadata;
    }
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* quota */ }
    return data as Metadata;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

import { useEffect, useState } from 'react';
export function useMetadata(mediaId?: string, title?: string, category?: string) {
  const [meta, setMeta] = useState<Metadata | null>(null);
  useEffect(() => {
    setMeta(null);
    if (!mediaId || !title || (category !== 'movie' && category !== 'series' && category !== 'vod')) return;
    let alive = true;
    getMetadata(mediaId, title, category === 'series' ? 'series' : 'movie').then((m) => alive && setMeta(m));
    return () => { alive = false; };
  }, [mediaId, title, category]);
  return meta;
}
