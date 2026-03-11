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
  tvgId?: string;
}

export interface EpgProgram {
  id?: string;
  channel_id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  source_id?: string;
}

export interface SourceRow {
  id: string;
  name: string;
  type: string;
  url: string;
  username?: string | null;
  password?: string | null;
  epg_url?: string | null;
  created_at: string;
}

export interface MediaRow {
  id: string;
  title: string;
  poster?: string | null;
  category: 'movie' | 'series' | 'vod' | 'channel';
  genre?: string | null;
  description?: string | null;
  source_id: string;
  stream_url?: string | null;
  group_name?: string | null;
  tvg_id?: string | null;
}
