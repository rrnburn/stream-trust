import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

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

const DEMO_MEDIA: MediaItem[] = [
  { id: 'd1', title: 'The Last Frontier', poster: '', category: 'movie', genre: 'Action', year: 2024, duration: '2h 15m', rating: 8.2, description: 'A gripping tale of survival in the untamed wilderness.', sourceId: 'demo' },
  { id: 'd2', title: 'Neon Shadows', poster: '', category: 'movie', genre: 'Sci-Fi', year: 2024, duration: '1h 58m', rating: 7.9, description: 'In a cyberpunk city, a detective hunts an AI gone rogue.', sourceId: 'demo' },
  { id: 'd3', title: 'Echoes of Time', poster: '', category: 'series', genre: 'Drama', year: 2023, duration: '4 Seasons', rating: 9.1, description: 'A family saga spanning four generations across continents.', sourceId: 'demo' },
  { id: 'd4', title: 'Crimson Tide', poster: '', category: 'movie', genre: 'Thriller', year: 2024, duration: '2h 5m', rating: 7.6, description: 'A submarine crew faces a mutiny during a nuclear crisis.', sourceId: 'demo' },
  { id: 'd5', title: 'Starbound', poster: '', category: 'series', genre: 'Sci-Fi', year: 2024, duration: '2 Seasons', rating: 8.8, description: "Humanity's first interstellar colony faces unexpected challenges.", sourceId: 'demo' },
  { id: 'd6', title: "The Alchemist's Dream", poster: '', category: 'movie', genre: 'Fantasy', year: 2023, duration: '2h 30m', rating: 8.0, description: 'A young alchemist discovers the secret to eternal life.', sourceId: 'demo' },
  { id: 'd7', title: 'Dark Waters', poster: '', category: 'movie', genre: 'Horror', year: 2024, duration: '1h 45m', rating: 7.3, description: 'A coastal town discovers ancient terrors beneath the waves.', sourceId: 'demo' },
  { id: 'd8', title: 'Code Zero', poster: '', category: 'series', genre: 'Thriller', year: 2024, duration: '1 Season', rating: 8.5, description: 'Hackers uncover a conspiracy that could topple governments.', sourceId: 'demo' },
  { id: 'd9', title: 'Golden Hour', poster: '', category: 'movie', genre: 'Romance', year: 2023, duration: '1h 52m', rating: 7.8, description: 'Two strangers meet during the golden hour in Paris.', sourceId: 'demo' },
  { id: 'd10', title: 'Wildlands', poster: '', category: 'vod', genre: 'Documentary', year: 2024, duration: '1h 30m', rating: 9.0, description: "An exploration of Earth's most remote ecosystems.", sourceId: 'demo' },
  { id: 'd11', title: 'Iron Will', poster: '', category: 'movie', genre: 'Action', year: 2024, duration: '2h 10m', rating: 7.5, description: 'A retired soldier returns for one final mission.', sourceId: 'demo' },
  { id: 'd12', title: 'The Void', poster: '', category: 'series', genre: 'Sci-Fi', year: 2023, duration: '3 Seasons', rating: 8.7, description: 'Astronauts discover a dimension-bending anomaly in deep space.', sourceId: 'demo' },
];

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const useMedia = () => {
  const { parsedMedia } = useAppContext();
  return [...DEMO_MEDIA, ...parsedMedia];
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [sources, setSources] = useState<IPTVSource[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<{ id: string; progress: number; timestamp: string }[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [parsedMedia, setParsedMedia] = useState<MediaItem[]>([]);
  const [parsingPlaylist, setParsingPlaylist] = useState(false);

  // Load sources from DB
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

  // Load favorites from DB
  const loadFavorites = useCallback(async () => {
    if (!user) { setFavorites([]); return; }
    const { data } = await supabase.from('favorites').select('media_id');
    setFavorites(data?.map(f => f.media_id) || []);
  }, [user]);

  // Load watch history from DB
  const loadHistory = useCallback(async () => {
    if (!user) { setWatchHistory([]); return; }
    const { data } = await supabase
      .from('watch_history')
      .select('media_id, progress, watched_at')
      .order('watched_at', { ascending: false })
      .limit(50);
    setWatchHistory(data?.map(h => ({ id: h.media_id, progress: h.progress, timestamp: h.watched_at })) || []);
  }, [user]);

  useEffect(() => {
    loadSources();
    loadFavorites();
    loadHistory();
  }, [loadSources, loadFavorites, loadHistory]);

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
    setParsingPlaylist(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-playlist', {
        body: { url: source.url, type: source.type, username: source.username, password: source.password },
      });
      if (error) throw error;
      if (data?.items) {
        const media: MediaItem[] = data.items.map((item: any) => ({
          id: `parsed-${item.id}`,
          title: item.title,
          poster: item.logo || '',
          category: item.category,
          genre: item.group || 'Uncategorized',
          description: `From ${source.name}`,
          sourceId: source.id,
          streamUrl: item.url,
          group: item.group,
        }));
        setParsedMedia(prev => [...prev.filter(m => m.sourceId !== source.id), ...media]);
      }
    } catch (e) {
      console.error('Failed to parse playlist:', e);
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
