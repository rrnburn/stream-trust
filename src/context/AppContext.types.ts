export interface IPTVSource {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  url: string;
  username?: string;
  password?: string;
  epg_url?: string;
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
