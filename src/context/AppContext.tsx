import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isNativePlatform } from '@/lib/platform';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { IPTVSource, MediaItem } from './AppContext.types';
import {
  getSources,
  addSourceLocal,
  removeSourceLocal,
  getParsedMedia,
  insertParsedMedia,
  getFavorites,
  toggleFavoriteLocal,
  getWatchHistory,
  addToHistoryLocal,
  getEpgPrograms,
  insertEpgPrograms,
  initLocalDb,
} from '@/lib/localDb';
import { parseXmlTvLocal } from '@/lib/epgParser';
import { parsePlaylistLocally } from '@/lib/playlistParser';

export type { IPTVSource, MediaItem };

interface AppState {
  sources: IPTVSource[];
  favorites: string[];
  watchHistory: { id: string; progress: number; timestamp: string }[];
  addSource: (source: Omit<IPTVSource, 'id' | 'created_at'>) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  addToHistory: (id: string, progress: number) => Promise<void>;
  loadingSources: boolean;
  parsedMedia: MediaItem[];
  parsePlaylist: (source: IPTVSource) => Promise<void>;
  parsingPlaylist: boolean;
  epgPrograms: any[];
  parseEpg: (source: IPTVSource) => Promise<void>;
  parsingEpg: boolean;
}

const AppContext = createContext<AppState | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const useMedia = () => {
  const { parsedMedia } = useAppContext();
  return parsedMedia;
};

// ══════════════════════════════════════════════
// LOCAL (SQLite) provider — used on native builds
// ══════════════════════════════════════════════

const LocalAppProvider = ({ children }: { children: ReactNode }) => {
  const [sources, setSources] = useState<IPTVSource[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<{ id: string; progress: number; timestamp: string }[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [parsedMedia, setParsedMedia] = useState<MediaItem[]>([]);
  const [parsingPlaylist, setParsingPlaylist] = useState(false);
  const [epgPrograms, setEpgPrograms] = useState<any[]>([]);
  const [parsingEpg, setParsingEpg] = useState(false);
  const [autoEpgUrl, setAutoEpgUrl] = useState<string>('');
  const reload = useCallback(async () => {
    setLoadingSources(true);
    try {
      await initLocalDb();
      const [s, f, h, m] = await Promise.all([getSources(), getFavorites(), getWatchHistory(), getParsedMedia()]);
      setSources(s.map((r: any) => ({
        id: r.id, name: r.name, type: r.type, url: r.url,
        username: r.username || undefined, password: r.password || undefined,
        epg_url: r.epg_url || undefined,
        created_at: r.created_at,
      })));
      setFavorites(f);
      setWatchHistory(h);
      setParsedMedia(m.map((r: any) => ({
        id: r.id, title: r.title, poster: r.poster || '',
        category: r.category as MediaItem['category'],
        genre: r.genre || 'Uncategorized', description: r.description || '',
        sourceId: r.source_id, streamUrl: r.stream_url || '',
        group: r.group_name || undefined,
      })));
    } catch (e) {
      console.error('Local DB load error:', e);
    }
    setLoadingSources(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const addSource = async (source: Omit<IPTVSource, 'id' | 'created_at'>) => {
    await addSourceLocal(source);  await reload();
  };

  const removeSource = async (id: string) => {
    await removeSourceLocal(id);
    await reload();
  };

  const toggleFavorite = async (mediaId: string) => {
    await toggleFavoriteLocal(mediaId);
    const f = await getFavorites();
    setFavorites(f);
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const addToHistory = async (mediaId: string, progress: number) => {
    await addToHistoryLocal(mediaId, progress);
    const h = await getWatchHistory();
    setWatchHistory(h);
  };

  const parsePlaylist = async (source: IPTVSource) => {
    setParsingPlaylist(true);
    try {
      const result = await parsePlaylistLocally(source.url, source.type as 'm3u' | 'xtream', source.username, source.password);
      if (result.items.length > 0) {
        setEpgUrl(result.epgUrl);
        await insertParsedMedia(source.id, result.items.map(i => ({
          ...i, sourceName: source.name,
        })));
        const parts = [];
        if (result.channels) parts.push(`${result.channels} channels`);
        if (result.movies) parts.push(`${result.movies} movies`);
        if (result.series) parts.push(`${result.series} series`);
        toast.success(`Parsed ${result.total} items (${parts.join(', ')}) from ${source.name}`);
        logger.info('AppContext', `Parsed ${result.total} items from ${source.name}`, { channels: result.channels, movies: result.movies, series: result.series });
        await reload();
      } else {
        toast.info('No items found in playlist');
      }
    } catch (e: any) {
      logger.error('AppContext', `Failed to parse playlist: ${e.message || 'Unknown'}`, { source: source.name });
      console.error('Failed to parse playlist:', e);
      toast.error(`Failed to parse: ${e.message || 'Unknown error'}`);
    }
    setParsingPlaylist(false);
  };

  const parseEpg = async (_source: IPTVSource) => {
  if (!epgUrl) return;

  setParsingEpg(true);

  try {
    console.log("📥 Downloading EPG:", epgUrl);

    const res = await fetch(epg_url);
    const xml = await res.text();

    console.log("EPG size:", xml.length);

    const programmes = xml.match(/<programme/g) || [];

    console.log("Programs found:", programmes.length);

    toast.success(`Loaded ${programmes.length} programs`);

  } catch (e) {
    console.error("EPG parse error:", e);
    toast.error("Failed to parse EPG");
  }

  setParsingEpg(false);
};

  return (
    <AppContext.Provider value={{
      sources, favorites, watchHistory,
      addSource, removeSource, toggleFavorite, isFavorite, addToHistory,
      loadingSources, parsedMedia, parsePlaylist, parsingPlaylist,
      epgPrograms, parseEpg, parsingEpg,
    }}>
      {children}
    </AppContext.Provider>
  );
};

// ══════════════════════════════════════════════
// CLOUD (Supabase) provider — used on web
// ══════════════════════════════════════════════

const CloudAppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [sources, setSources] = useState<IPTVSource[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<{ id: string; progress: number; timestamp: string }[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [parsedMedia, setParsedMedia] = useState<MediaItem[]>([]);
  const [parsingPlaylist, setParsingPlaylist] = useState(false);
  const [epgPrograms, setEpgPrograms] = useState<any[]>([]);
  const [parsingEpg, setParsingEpg] = useState(false);

  const loadSources = useCallback(async () => {
    if (!user) { setSources([]); return; }
    setLoadingSources(true);
    const { data } = await supabase
      .from('iptv_sources')
      .select('*')
      .order('created_at', { ascending: false });
    setSources((data as IPTVSource[]) || []);
    setLoadingSources(false);
  }, [user]);

  const loadFavorites = useCallback(async () => {
    if (!user) { setFavorites([]); return; }
    const { data } = await supabase.from('favorites').select('media_id');
    setFavorites(data?.map(f => f.media_id) || []);
  }, [user]);

  const loadHistory = useCallback(async () => {
    if (!user) { setWatchHistory([]); return; }
    const { data } = await supabase
      .from('watch_history')
      .select('media_id, progress, watched_at')
      .order('watched_at', { ascending: false })
      .limit(50);
    setWatchHistory(data?.map(h => ({ id: h.media_id, progress: h.progress, timestamp: h.watched_at })) || []);
  }, [user]);

  const loadParsedMedia = useCallback(async () => {
    if (!user) { setParsedMedia([]); return; }
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabase
        .from('parsed_media')
        .select('*')
        .order('title', { ascending: true })
        .range(from, from + pageSize - 1);
      if (!page || page.length === 0) break;
      allData = allData.concat(page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    if (allData.length) {
      setParsedMedia(allData.map((row: any) => ({
        id: row.id, title: row.title, poster: row.poster || '',
        category: row.category as MediaItem['category'],
        genre: row.genre || 'Uncategorized', description: row.description || '',
        sourceId: row.source_id, streamUrl: row.stream_url || '',
        group: row.group_name || undefined,
      })));
    }
  }, [user]);

  useEffect(() => {
    loadSources();
    loadFavorites();
    loadHistory();
    loadParsedMedia();
  }, [loadSources, loadFavorites, loadHistory, loadParsedMedia]);

  const addSource = async (source: Omit<IPTVSource, 'id' | 'created_at'>) => {
    if (!user) return;
    await supabase.from('iptv_sources').insert({
      user_id: user.id, name: source.name, type: source.type,
      url: source.url, username: source.username || null, password: source.password || null,
      epg_url: source.epg_url || null,
    });
    await loadSources();
  };

  const removeSource = async (id: string) => {
    await supabase.from('iptv_sources').delete().eq('id', id);
    await loadSources();
    await loadParsedMedia();
  };

  const toggleFavorite = async (mediaId: string) => {
    if (!user) return;
    if (favorites.includes(mediaId)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('media_id', mediaId);
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, media_id: mediaId });
    }
    await loadFavorites();
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const addToHistory = async (mediaId: string, progress: number) => {
    if (!user) return;
    await supabase.from('watch_history').insert({ user_id: user.id, media_id: mediaId, progress });
    await loadHistory();
  };

  const parsePlaylist = async (source: IPTVSource) => {
    if (!user) return;
    setParsingPlaylist(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-playlist', {
        body: {
          url: source.url, type: source.type, username: source.username,
          password: source.password, sourceId: source.id, userId: user.id, sourceName: source.name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.inserted > 0 || data?.total > 0) {
        const parts = [];
        if (data.channels) parts.push(`${data.channels} channels`);
        if (data.movies) parts.push(`${data.movies} movies`);
        if (data.series) parts.push(`${data.series} series`);
        toast.success(`Parsed ${data.total} items (${parts.join(', ')}) from ${source.name}`);
        await loadParsedMedia();
      } else {
        toast.info('No items found in playlist');
      }
    } catch (e: any) {
      console.error('Failed to parse playlist:', e);
      toast.error(`Failed to parse: ${e.message || 'Unknown error'}`);
    }
    setParsingPlaylist(false);
  };

  const loadEpgPrograms = useCallback(async () => {
    if (!user) { setEpgPrograms([]); return; }
    const { data } = await supabase
      .from('epg_programs')
      .select('*')
      .gte('end_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true });
    setEpgPrograms(data || []);
  }, [user]);

  useEffect(() => {
    loadEpgPrograms();
  }, [loadEpgPrograms]);

  const parseEpg = async (source: IPTVSource) => {
    if (!user || !source.epg_url) return;
    setParsingEpg(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-epg', {
        body: { epgUrl: source.epg_url, sourceId: source.id, userId: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Loaded ${data?.total || 0} programs for ${data?.channels || 0} channels`);
      await loadEpgPrograms();
    } catch (e: any) {
      console.error('Failed to parse EPG:', e);
      toast.error(`Failed to load EPG: ${e.message || 'Unknown error'}`);
    }
    setParsingEpg(false);
  };

  return (
    <AppContext.Provider value={{
      sources, favorites, watchHistory,
      addSource, removeSource, toggleFavorite, isFavorite, addToHistory,
      loadingSources, parsedMedia, parsePlaylist, parsingPlaylist,
      epgPrograms, parseEpg, parsingEpg,
    }}>
      {children}
    </AppContext.Provider>
  );
};

// ══════════════════════════════════════════════
// Auto-selecting provider
// ══════════════════════════════════════════════

export const AppProvider = ({ children }: { children: ReactNode }) => {
  if (isNativePlatform()) {
    return <LocalAppProvider>{children}</LocalAppProvider>;
  }
  return <CloudAppProvider>{children}</CloudAppProvider>;
};
