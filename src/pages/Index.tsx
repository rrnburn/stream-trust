import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import HeroBanner from '@/components/HeroBanner';
import MediaGrid from '@/components/MediaGrid';
import { Tv } from 'lucide-react';

const Index = () => {
  const media = useMedia();
  const featured = media.length > 0 ? media[Math.floor(Math.random() * Math.min(media.length, 10))] : null;
  const movies = media.filter(m => m.category === 'movie');
  const series = media.filter(m => m.category === 'series');
  const channels = media.filter(m => m.category === 'channel');
  const trending = [...media].slice(0, 12);

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

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        {featured && <HeroBanner item={featured} />}
        <div className="space-y-10">
          {trending.length > 0 && <MediaGrid items={trending} title="🔥 Recent" />}
          {movies.length > 0 && <MediaGrid items={movies.slice(0, 12)} title="🎬 Movies" />}
          {series.length > 0 && <MediaGrid items={series.slice(0, 12)} title="📺 Series" />}
          {channels.length > 0 && <MediaGrid items={channels.slice(0, 12)} title="📡 Channels" />}
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
