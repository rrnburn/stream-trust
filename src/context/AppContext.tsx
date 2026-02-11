import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface IPTVSource {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  url: string;
  username?: string;
  password?: string;
  addedAt: string;
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
}

interface AppState {
  sources: IPTVSource[];
  favorites: string[];
  watchHistory: { id: string; progress: number; timestamp: string }[];
  addSource: (source: Omit<IPTVSource, 'id' | 'addedAt'>) => void;
  removeSource: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  addToHistory: (id: string, progress: number) => void;
}

const AppContext = createContext<AppState | null>(null);

const MOCK_MEDIA: MediaItem[] = [
  { id: '1', title: 'The Last Frontier', poster: '', category: 'movie', genre: 'Action', year: 2024, duration: '2h 15m', rating: 8.2, description: 'A gripping tale of survival in the untamed wilderness.', sourceId: 'demo' },
  { id: '2', title: 'Neon Shadows', poster: '', category: 'movie', genre: 'Sci-Fi', year: 2024, duration: '1h 58m', rating: 7.9, description: 'In a cyberpunk city, a detective hunts an AI gone rogue.', sourceId: 'demo' },
  { id: '3', title: 'Echoes of Time', poster: '', category: 'series', genre: 'Drama', year: 2023, duration: '4 Seasons', rating: 9.1, description: 'A family saga spanning four generations across continents.', sourceId: 'demo' },
  { id: '4', title: 'Crimson Tide', poster: '', category: 'movie', genre: 'Thriller', year: 2024, duration: '2h 5m', rating: 7.6, description: 'A submarine crew faces a mutiny during a nuclear crisis.', sourceId: 'demo' },
  { id: '5', title: 'Starbound', poster: '', category: 'series', genre: 'Sci-Fi', year: 2024, duration: '2 Seasons', rating: 8.8, description: 'Humanity\'s first interstellar colony faces unexpected challenges.', sourceId: 'demo' },
  { id: '6', title: 'The Alchemist\'s Dream', poster: '', category: 'movie', genre: 'Fantasy', year: 2023, duration: '2h 30m', rating: 8.0, description: 'A young alchemist discovers the secret to eternal life.', sourceId: 'demo' },
  { id: '7', title: 'Dark Waters', poster: '', category: 'movie', genre: 'Horror', year: 2024, duration: '1h 45m', rating: 7.3, description: 'A coastal town discovers ancient terrors beneath the waves.', sourceId: 'demo' },
  { id: '8', title: 'Code Zero', poster: '', category: 'series', genre: 'Thriller', year: 2024, duration: '1 Season', rating: 8.5, description: 'Hackers uncover a conspiracy that could topple governments.', sourceId: 'demo' },
  { id: '9', title: 'Golden Hour', poster: '', category: 'movie', genre: 'Romance', year: 2023, duration: '1h 52m', rating: 7.8, description: 'Two strangers meet during the golden hour in Paris.', sourceId: 'demo' },
  { id: '10', title: 'Wildlands', poster: '', category: 'vod', genre: 'Documentary', year: 2024, duration: '1h 30m', rating: 9.0, description: 'An exploration of Earth\'s most remote ecosystems.', sourceId: 'demo' },
  { id: '11', title: 'Iron Will', poster: '', category: 'movie', genre: 'Action', year: 2024, duration: '2h 10m', rating: 7.5, description: 'A retired soldier returns for one final mission.', sourceId: 'demo' },
  { id: '12', title: 'The Void', poster: '', category: 'series', genre: 'Sci-Fi', year: 2023, duration: '3 Seasons', rating: 8.7, description: 'Astronauts discover a dimension-bending anomaly in deep space.', sourceId: 'demo' },
];

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const useMedia = () => MOCK_MEDIA;

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [sources, setSources] = useState<IPTVSource[]>(() => {
    const saved = localStorage.getItem('iptv-sources');
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('iptv-favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [watchHistory, setWatchHistory] = useState<{ id: string; progress: number; timestamp: string }[]>(() => {
    const saved = localStorage.getItem('iptv-history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => { localStorage.setItem('iptv-sources', JSON.stringify(sources)); }, [sources]);
  useEffect(() => { localStorage.setItem('iptv-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('iptv-history', JSON.stringify(watchHistory)); }, [watchHistory]);

  const addSource = (source: Omit<IPTVSource, 'id' | 'addedAt'>) => {
    setSources(prev => [...prev, { ...source, id: crypto.randomUUID(), addedAt: new Date().toISOString() }]);
  };

  const removeSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const addToHistory = (id: string, progress: number) => {
    setWatchHistory(prev => {
      const filtered = prev.filter(h => h.id !== id);
      return [{ id, progress, timestamp: new Date().toISOString() }, ...filtered].slice(0, 50);
    });
  };

  return (
    <AppContext.Provider value={{ sources, favorites, watchHistory, addSource, removeSource, toggleFavorite, isFavorite, addToHistory }}>
      {children}
    </AppContext.Provider>
  );
};
