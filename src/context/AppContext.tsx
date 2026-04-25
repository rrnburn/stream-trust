/* @jsxRuntime classic */
/* @jsx React.createElement */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isNativePlatform } from '@/lib/platform';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { IPTVSource, MediaItem, EpgProgram, SourceRow, MediaRow, WatchHistoryEntry } from './AppContext.types';
// Lazy imports for native-only modules (SQLite crashes on web at module load)
const getLocalDb = () => import('@/lib/localDb');
const getEpgParser = () => import('@/lib/epgParser');
const getPlaylistParser = () => import('@/lib/playlistParser');

export type { IPTVSource, MediaItem, WatchHistoryEntry };

export interface ResumeInfo {
  position: number;     // seconds
  duration: number;     // seconds (0 if unknown)
  progress: number;     // 0..1
  finished: boolean;
  lastEpisodeId?: string; // for series — id used to play the last episode
}

interface AppState {
  sources: IPTVSource[];
  favorites: string[];
  watchHistory: WatchHistoryEntry[];
  addSource: (source: Omit<IPTVSource, 'id' | 'created_at'>) => Promise<void>;
  updateSource: (id: string, fields: Partial<Omit<IPTVSource, 'id' | 'created_at'>>) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  /**
   * Save playback progress.
   * @param mediaId  Stable media id (for series episodes use the episode id, not the parent series id)
   * @param progress 0..1 fraction watched
   * @param positionSeconds Current playhead in seconds
   * @param durationSeconds Total length in seconds (0 when unknown / live)
   * @param parentSeriesId Optional parent series id, so we can remember "last episode of this series"
   */
  addToHistory: (
    mediaId: string,
    progress: number,
    positionSeconds?: number,
    durationSeconds?: number,
    parentSeriesId?: string,
  ) => Promise<void>;
  getResume: (mediaId: string) => ResumeInfo | null;
  clearResume: (mediaId: string) => Promise<void>;
  loadingSources: boolean;
  parsedMedia: MediaItem[];
  parsePlaylist: (source: IPTVSource) => Promise<void>;
  parsingPlaylist: boolean;
  epgPrograms: EpgProgram[];
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
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  // Map of seriesId -> last episode media_id played
  const [seriesLastEpisode, setSeriesLastEpisode] = useState<Record<string, string>>({});
  const [loadingSources, setLoadingSources] = useState(true);
  const [parsedMedia, setParsedMedia] = useState<MediaItem[]>([]);
  const [parsingPlaylist, setParsingPlaylist] = useState(false);
  const [epgPrograms, setEpgPrograms] = useState<EpgProgram[]>([]);
  const [parsingEpg, setParsingEpg] = useState(false);
  const [autoEpgUrl, setAutoEpgUrl] = useState<string>('');

  const reload = useCallback(async () => {
    setLoadingSources(true);
    try {
      const db = await getLocalDb();
      await db.initLocalDb();
      const [s, f, h, m, epg] = await Promise.all([
        db.getSources(),
        db.getFavorites(),
        db.getWatchHistory(),
        db.getParsedMedia(),
        db.getEpgPrograms(),
      ]);
      setSources(
        s.map((r: SourceRow) => ({
          id: r.id,
          name: r.name,
          type: r.type as IPTVSource['type'],
          url: r.url,
          username: r.username || undefined,
          password: r.password || undefined,
          epg_url: r.epg_url || undefined,
          created_at: r.created_at,
        })),
      );
      setFavorites(f);
      setWatchHistory(h);
      setParsedMedia(
        m.map((r: MediaRow) => ({
          id: r.id,
          title: r.title,
          poster: r.poster || '',
          category: r.category as MediaItem['category'],
          genre: r.genre || 'Uncategorized',
          description: r.description || '',
          sourceId: r.source_id,
          streamUrl: r.stream_url || '',
          group: r.group_name || undefined,
          tvgId: r.tvg_id || undefined,
        })),
      );
      setEpgPrograms(epg);
    } catch (e) {
      logger.error('AppContext', 'Local DB load error', { error: String(e) });
    }
    setLoadingSources(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addSource = async (source: Omit<IPTVSource, 'id' | 'created_at'>) => {
    const db = await getLocalDb();
    await db.addSourceLocal(source);
    await reload();
  };

  const updateSource = async (id: string, fields: Partial<Omit<IPTVSource, 'id' | 'created_at'>>) => {
    const db = await getLocalDb();
    await db.updateSourceLocal(id, fields);
    await reload();
  };

  const removeSource = async (id: string) => {
    const db = await getLocalDb();
    await db.removeSourceLocal(id);
    await reload();
  };

  const toggleFavorite = async (mediaId: string) => {
    const db = await getLocalDb();
    await db.toggleFavoriteLocal(mediaId);
    const f = await db.getFavorites();
    setFavorites(f);
  };

  const isFavorite = (id: string) => favorites.includes(id);

  // Persisted "last episode of series" map (lives in localStorage on native)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('series_last_episode');
      if (raw) setSeriesLastEpisode(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persistSeriesLastEp = (next: Record<string, string>) => {
    setSeriesLastEpisode(next);
    try {
      localStorage.setItem('series_last_episode', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const addToHistory = async (
    mediaId: string,
    progress: number,
    positionSeconds = 0,
    durationSeconds = 0,
    parentSeriesId?: string,
  ) => {
    const db = await getLocalDb();
    await db.addToHistoryLocal(mediaId, progress, positionSeconds, durationSeconds);
    if (parentSeriesId) {
      persistSeriesLastEp({ ...seriesLastEpisode, [parentSeriesId]: mediaId });
    }
    const h = await db.getWatchHistory();
    setWatchHistory(h);
  };

  const getResume = (mediaId: string): ResumeInfo | null => {
    const entry = watchHistory.find((h) => h.id === mediaId);
    const lastEpisodeId = seriesLastEpisode[mediaId];
    if (!entry && !lastEpisodeId) return null;
    return {
      position: entry?.position ?? 0,
      duration: entry?.duration ?? 0,
      progress: entry?.progress ?? 0,
      finished: entry?.finished ?? false,
      lastEpisodeId,
    };
  };

  const clearResume = async (mediaId: string) => {
    const db = await getLocalDb();
    await db.addToHistoryLocal(mediaId, 0, 0, 0);
    const h = await db.getWatchHistory();
    setWatchHistory(h);
  };

  const parsePlaylist = async (source: IPTVSource) => {
    setParsingPlaylist(true);
    try {
      const { parsePlaylistLocally } = await getPlaylistParser();
      const db = await getLocalDb();
      const result = await parsePlaylistLocally(
        source.url,
        source.type as 'm3u' | 'xtream',
        source.username,
        source.password,
      );
      if (result.items.length > 0) {
        setAutoEpgUrl(result.epgUrl);
        await db.insertParsedMedia(
          source.id,
          result.items.map((i) => ({
            ...i,
            sourceName: source.name,
          })),
        );
        const parts = [];
        if (result.channels) parts.push(`${result.channels} channels`);
        if (result.movies) parts.push(`${result.movies} movies`);
        if (result.series) parts.push(`${result.series} series`);
        toast.success(`Parsed ${result.total} items (${parts.join(', ')}) from ${source.name}`);
        logger.info('AppContext', `Parsed ${result.total} items from ${source.name}`, {
          channels: result.channels,
          movies: result.movies,
          series: result.series,
        });
        await reload();
      } else {
        toast.info('No items found in playlist');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown';
      logger.error('AppContext', `Failed to parse playlist: ${message}`, { source: source.name });
      toast.error(`Failed to parse: ${message}`);
    }
    setParsingPlaylist(false);
  };

  const parseEpg = async (source: IPTVSource) => {
    const url = source.epg_url || autoEpgUrl;
    if (!url) {
      toast.error('No EPG URL available for this source');
      return;
    }

    setParsingEpg(true);
    try {
      const db = await getLocalDb();
      const { parseXmlTvLocal } = await getEpgParser();
      logger.info('EPG', `📥 Downloading EPG from: ${url}`);

      // Download with timeout and size limit to prevent crashes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Encoding': 'gzip' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Check file size before loading into memory
      const contentLength = res.headers.get('content-length');
      const maxSize = 20 * 1024 * 1024; // Reduced to 20MB to prevent memory issues
      if (contentLength && parseInt(contentLength) > maxSize) {
        throw new Error('EPG file too large (>20MB). Consider using a smaller EPG source.');
      }

      let xml = await res.text();
      logger.info('EPG', `Downloaded EPG file: ${(xml.length / 1024).toFixed(1)} KB`);

      // Parse in chunks to avoid blocking UI
      toast.info('Parsing EPG data...');

      // Use setTimeout to yield to UI thread multiple times during parsing
      await new Promise((resolve) => setTimeout(resolve, 600));

      const programs = parseXmlTvLocal(xml);
      logger.info('EPG', `Parsed ${programs.length} programs from XML`);

      // Clear XML from memory immediately after parsing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      xml = null as any;

      if (programs.length > 0) {
        toast.info(`Saving ${programs.length} programs...`);

        // Yield to UI thread before heavy database operation
        await new Promise((resolve) => setTimeout(resolve, 500));

        await db.replaceEpgPrograms(source.id, programs);

        const epg = await db.getEpgPrograms();
        setEpgPrograms(epg);
        const channels = new Set(programs.map((p) => p.channel_id)).size;

        // Debug: Log first 10 unique EPG channel IDs for matching verification
        const uniqueChannelIds = [...new Set(programs.map((p) => p.channel_id))].slice(0, 10);
        logger.info('EPG', `📺 Parsed ${programs.length} programs from ${channels} unique channel IDs`);
        logger.info('EPG', '📺 EPG Channel IDs (first 10)', { channelIds: uniqueChannelIds });
        
        // Debug: Sample a few programs to see their structure
        const samplePrograms = programs.slice(0, 3).map((p) => ({
          channel_id: p.channel_id,
          title: p.title,
          start: p.start_time,
        }));
        logger.info('EPG', '📺 Sample programs', { samples: samplePrograms });

        // Debug: Log parsed media tvg_ids for comparison
        const media = await db.getParsedMedia();
        logger.info('EPG', `📺 Total parsed media items: ${media.length}`);
        const channelMedia = (media as MediaRow[]).filter((m) => m.category === 'channel');
        logger.info('EPG', `📺 Channel media items: ${channelMedia.length}`);
        const tvgIds = [...new Set(channelMedia.map((m) => m.tvg_id).filter(Boolean))].slice(0, 10);
        logger.info('EPG', '📺 Playlist TVG-IDs (first 10)', { tvgIds });
        
        // Debug: Sample a few channel media to see their structure
        const sampleChannels = channelMedia.slice(0, 3).map((m) => ({
          id: m.id,
          title: m.title,
          tvg_id: m.tvg_id,
        }));
        logger.info('EPG', '📺 Sample channels', { samples: sampleChannels });

        toast.success(`Loaded ${programs.length} programs for ${channels} channels`);
      } else {
        toast.info('No programs found in EPG data');
      }
    } catch (e: unknown) {
      logger.error('EPG', 'Parse error', { error: String(e) });
      if (e instanceof Error && e.name === 'AbortError') {
        toast.error('EPG download timeout - file too large or slow connection');
      } else {
        const message = e instanceof Error ? e.message : 'Unknown error';
        toast.error(`Failed to parse EPG: ${message}`);
      }
    } finally {
      setParsingEpg(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        sources,
        favorites,
        watchHistory,
        addSource,
        updateSource,
        removeSource,
        toggleFavorite,
        isFavorite,
        addToHistory,
        getResume,
        clearResume,
        loadingSources,
        parsedMedia,
        parsePlaylist,
        parsingPlaylist,
        epgPrograms,
        parseEpg,
        parsingEpg,
      }}
    >
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
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [seriesLastEpisode, setSeriesLastEpisode] = useState<Record<string, string>>({});
  const [loadingSources, setLoadingSources] = useState(false);
  const [parsedMedia, setParsedMedia] = useState<MediaItem[]>([]);
  const [parsingPlaylist, setParsingPlaylist] = useState(false);
  const [epgPrograms, setEpgPrograms] = useState<EpgProgram[]>([]);
  const [parsingEpg, setParsingEpg] = useState(false);

  const loadSources = useCallback(async () => {
    if (!user) {
      setSources([]);
      return;
    }
    setLoadingSources(true);
    const { data } = await supabase.from('iptv_sources').select('*').order('created_at', { ascending: false });
    setSources((data as IPTVSource[]) || []);
    setLoadingSources(false);
  }, [user]);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    const { data } = await supabase.from('favorites').select('media_id');
    setFavorites(data?.map((f) => f.media_id) || []);
  }, [user]);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setWatchHistory([]);
      return;
    }
    const { data } = await supabase
      .from('watch_history')
      .select('media_id, progress, position_seconds, duration_seconds, watched_at')
      .order('watched_at', { ascending: false })
      .limit(100);
    setWatchHistory(
      data?.map((h) => ({
        id: h.media_id,
        progress: h.progress || 0,
        position: h.position_seconds || 0,
        duration: h.duration_seconds || 0,
        finished: (h.progress || 0) >= 0.95,
        timestamp: h.watched_at,
      })) || [],
    );
  }, [user]);

  const loadParsedMedia = useCallback(async () => {
    if (!user) {
      setParsedMedia([]);
      return;
    }
    let allData: MediaRow[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabase
        .from('parsed_media')
        .select('*')
        .order('title', { ascending: true })
        .range(from, from + pageSize - 1);
      if (!page || page.length === 0) break;
      allData = allData.concat(page as MediaRow[]);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    if (allData.length) {
      setParsedMedia(
        allData.map((row: MediaRow) => ({
          id: row.id,
          title: row.title,
          poster: row.poster || '',
          category: row.category as MediaItem['category'],
          genre: row.genre || 'Uncategorized',
          description: row.description || '',
          sourceId: row.source_id,
          streamUrl: row.stream_url || '',
          group: row.group_name || undefined,
          tvgId: row.tvg_id || undefined,
        })),
      );
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
      user_id: user.id,
      name: source.name,
      type: source.type,
      url: source.url,
      username: source.username || null,
      password: source.password || null,
      epg_url: source.epg_url || null,
    });
    await loadSources();
  };

  const updateSource = async (id: string, fields: Partial<Omit<IPTVSource, 'id' | 'created_at'>>) => {
    if (!user) return;
    await supabase
      .from('iptv_sources')
      .update({
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.url !== undefined && { url: fields.url }),
        ...(fields.username !== undefined && { username: fields.username || null }),
        ...(fields.password !== undefined && { password: fields.password || null }),
        ...(fields.epg_url !== undefined && { epg_url: fields.epg_url || null }),
      })
      .eq('id', id);
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
          url: source.url,
          type: source.type,
          username: source.username,
          password: source.password,
          sourceId: source.id,
          userId: user.id,
          sourceName: source.name,
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error('AppContext', `Failed to parse playlist: ${message}`);
      toast.error(`Failed to parse: ${message}`);
    }
    setParsingPlaylist(false);
  };

  const loadEpgPrograms = useCallback(async () => {
    if (!user) {
      setEpgPrograms([]);
      return;
    }
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error('AppContext', `Failed to parse EPG: ${message}`);
      toast.error(`Failed to load EPG: ${message}`);
    }
    setParsingEpg(false);
  };

  return (
    <AppContext.Provider
      value={{
        sources,
        favorites,
        watchHistory,
        addSource,
        updateSource,
        removeSource,
        toggleFavorite,
        isFavorite,
        addToHistory,
        loadingSources,
        parsedMedia,
        parsePlaylist,
        parsingPlaylist,
        epgPrograms,
        parseEpg,
        parsingEpg,
      }}
    >
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
