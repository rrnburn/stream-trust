import { useMedia, useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Tv, History } from 'lucide-react';
import { useMemo } from 'react';

const Index = () => {
  const media = useMedia();
  const { watchHistory } = useAppContext();

  const watchedMedia = useMemo(() => {
    const seen = new Set<string>();
    return watchHistory
      .map(h => media.find(m => m.id === h.id))
      .filter((m): m is NonNullable<typeof m> => {
        if (!m || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
  }, [watchHistory, media]);

  const watchedChannels = watchedMedia.filter(m => m.category === 'channel');
  const watchedMovies = watchedMedia.filter(m => m.category === 'movie');
  const watchedSeries = watchedMedia.filter(m => m.category === 'series');

  if (media.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center p-4">
          <Tv className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg text-muted-foreground">No content yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Go to Sources, add an IPTV source, and parse it to see content here</p>
        </div>
      </AppLayout>
    );
  }

  const hasHistory = watchedMedia.length > 0;

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        {!hasHistory ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg text-muted-foreground">Nothing watched yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Start watching to see your history here</p>
          </div>
        ) : (
          <div className="space-y-10">
            {watchedChannels.length > 0 && <MediaGrid items={watchedChannels} title="📡 Recently Watched — Live TV" />}
            {watchedMovies.length > 0 && <MediaGrid items={watchedMovies} title="🎬 Recently Watched — Movies" />}
            {watchedSeries.length > 0 && <MediaGrid items={watchedSeries} title="📺 Recently Watched — Series" />}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
