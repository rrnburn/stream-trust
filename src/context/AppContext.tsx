import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface IPTVSource {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  url: string;
  username?: string;
  password?: string;
  created_at: string;
}

export interface MediaItem {
  id: string;
  title: string;
  poster: string;
  category: 'movie' | 'series' | 'vod' | 'channel';
  genre: string;
  year?: number;
  duration?: string;
  rating?: number;
  description: string;
  sourceId: string;
  streamUrl?: string;
  group?: string;
}

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

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [sources, setSources] = useState<IPTVSource[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<{ id: string; progress: number; timestamp: string }[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [parsedMedia, setParsedMedia] = useState<MediaItem[]>([]);
  const [parsingPlaylist, setParsingPlaylist] = useState(false);

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
    // Fetch all media in pages to avoid 1000-row default limit
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
    const data = allData;
    if (data) {
      setParsedMedia(data.map((row: any) => ({
        id: row.id,
        title: row.title,
        poster: row.poster || '',
        category: row.category as MediaItem['category'],
        genre: row.genre || 'Uncategorized',
        description: row.description || '',
        sourceId: row.source_id,
        streamUrl: row.stream_url || '',
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
      user_id: user.id,
      name: source.name,
      type: source.type,
      url: source.url,
      username: source.username || null,
      password: source.password || null,
    });
    await loadSources();
  };

  const removeSource = async (id: string) => {
    await supabase.from('iptv_sources').delete().eq('id', id);
    await loadSources();
    // parsed_media cascade-deletes with source
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
    await supabase.from('watch_history').insert({
      user_id: user.id,
      media_id: mediaId,
      progress,
    });
    await loadHistory();
  };

  const parsePlaylist = async (source: IPTVSource) => {
    if (!user) return;
    setParsingPlaylist(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-playlist', {
        body: { url: source.url, type: source.type, username: source.username, password: source.password },
      });
      if (error) throw error;
      if (data?.items?.length) {
        // Delete old parsed media for this source
        await supabase.from('parsed_media').delete().eq('source_id', source.id);

        // Insert new items in batches of 500
        const rows = data.items.map((item: any) => ({
          user_id: user.id,
          source_id: source.id,
          title: item.title,
          poster: item.logo || '',
          category: item.category,
          genre: item.group || 'Uncategorized',
          description: `From ${source.name}`,
          stream_url: item.url,
          group_name: item.group || null,
        }));

        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error: insertError } = await supabase.from('parsed_media').insert(batch);
          if (insertError) {
            console.error('Insert batch error:', insertError);
            throw insertError;
          }
        }

        toast.success(`Parsed ${data.items.length} items from ${source.name}`);
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

  return (
    <AppContext.Provider value={{
      sources, favorites, watchHistory,
      addSource, removeSource, toggleFavorite, isFavorite, addToHistory,
      loadingSources, parsedMedia, parsePlaylist, parsingPlaylist,
    }}>
      {children}
    </AppContext.Provider>
  );
};
