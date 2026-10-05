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

const CACHE_PREFIX = 'meta:v2:';
const MISS_TTL = 10 * 60 * 1000; // retry misses after 10 minutes (in-memory only)
const misses = new Map<string, number>();

/** Extracts year; full cleaning happens server-side so all devices benefit. */
export function cleanTitle(raw: string): { title: string; year?: number } {
  const m = raw.match(/(?:^|[([\s_.-])(19\d{2}|20\d{2})(?:[)\]\s_.-]|$)/);
  return { title: raw.trim(), year: m ? Number(m[1]) : undefined };
}

const inflight = new Map<string, Promise<Metadata>>();

export async function getMetadata(mediaId: string, rawTitle: string, type: 'movie' | 'series'): Promise<Metadata> {
  const key = CACHE_PREFIX + mediaId;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data } = JSON.parse(cached);
      if (data?.found) return data;
    }
  } catch { /* ignore */ }
  const missAt = misses.get(key);
  if (missAt && Date.now() - missAt < MISS_TTL) return { found: false };

  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const { title, year } = cleanTitle(rawTitle);
    const { data, error } = await supabase.functions.invoke('get-metadata', { body: { title, year, type } });
    if (error || data?.error || !data?.found) {
      if (error || data?.error) logger.warn('Metadata', 'Lookup failed', { title, error: error?.message || data?.error });
      else logger.info('Metadata', 'No match', { title, query: data?.query });
      misses.set(key, Date.now());
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
