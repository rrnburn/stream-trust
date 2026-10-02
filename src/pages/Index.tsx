import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Info, Tv, Plus } from 'lucide-react';
import { useMedia, useAppContext, MediaItem } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaRail from '@/components/MediaRail';
import { Button } from '@/components/ui/button';

const pickRecent = (list: MediaItem[], n = 20) => list.slice(-n).reverse();

const Index = () => {
  const media = useMedia();
  const { watchHistory } = useAppContext();
  const navigate = useNavigate();

  const { byId, movies, series, channels } = useMemo(() => {
    const byId = new Map<string, MediaItem>();
    const movies: MediaItem[] = [];
    const series: MediaItem[] = [];
    const channels: MediaItem[] = [];
    for (const m of media) {
      byId.set(m.id, m);
      if (m.category === 'movie') movies.push(m);
      else if (m.category === 'series') series.push(m);
      else if (m.category === 'channel') channels.push(m);
    }
    return { byId, movies, series, channels };
  }, [media]);

  const { continueItems, progress, recentChannels } = useMemo(() => {
    const seen = new Set<string>();
    const continueItems: MediaItem[] = [];
    const recentChannels: MediaItem[] = [];
    const progress: Record<string, number> = {};
    for (const h of watchHistory) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const m = byId.get(h.id);
      if (!m) continue;
      if (m.category === 'channel') recentChannels.push(m);
      else if (!h.finished) {
        continueItems.push(m);
        progress[m.id] = h.progress;
      }
    }
    return { continueItems: continueItems.slice(0, 20), progress, recentChannels: recentChannels.slice(0, 20) };
  }, [watchHistory, byId]);

  const hero = useMemo(() => {
    if (continueItems[0]?.poster) return continueItems[0];
    const pool = [...movies.slice(-60), ...series.slice(-60)].filter((m) => m.poster);
    if (!pool.length) return undefined;
    return pool[new Date().getHours() % pool.length];
  }, [continueItems, movies, series]);

  if (media.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-6">
            <Tv className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Welcome to StreamVault</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">Add your IPTV playlist to start watching live TV, movies and series.</p>
          <Button asChild className="mt-6 gap-2">
            <Link to="/sources"><Plus className="w-4 h-4" /> Add Playlist</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const heroResuming = hero && progress[hero.id] !== undefined;

  return (
    <AppLayout>
      {hero && (
        <section className="relative h-[60vh] min-h-[380px] max-h-[560px] -mb-16 overflow-hidden">
          <img src={hero.poster} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm opacity-60" />
          <img src={hero.poster} alt={hero.title} className="absolute right-4 lg:right-12 top-6 h-[62%] aspect-[2/3] object-cover rounded-xl shadow-2xl hidden sm:block" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
          <div className="absolute bottom-20 left-0 right-0 px-4 lg:px-8 max-w-xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {heroResuming ? 'Continue watching' : 'Spotlight'}
            </span>
            <h1 className="text-3xl lg:text-5xl font-display font-bold text-foreground mt-1 line-clamp-2">{hero.title}</h1>
            {hero.group && <p className="text-xs text-muted-foreground mt-1">{hero.group}</p>}
            {heroResuming && (
              <div className="mt-3 h-1 w-40 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progress[hero.id] * 100}%` }} />
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Button onClick={() => navigate(`/media/${hero.id}`)} className="gap-2 px-6">
                <Play className="w-4 h-4 fill-current" /> {heroResuming ? 'Resume' : 'Play'}
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/media/${hero.id}`)} className="gap-2">
                <Info className="w-4 h-4" /> Details
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="relative space-y-8 py-6">
        <MediaRail title="Continue Watching" items={continueItems} progress={progress} />
        <MediaRail title="Recent Channels" items={recentChannels} seeAllTo="/live-tv" variant="wide" />
        <MediaRail title="Recently Added Movies" items={pickRecent(movies)} seeAllTo="/movies" />
        <MediaRail title="Recently Added Series" items={pickRecent(series)} seeAllTo="/series" />
        {recentChannels.length === 0 && (
          <MediaRail title="Live Channels" items={channels.slice(0, 20)} seeAllTo="/live-tv" variant="wide" />
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
