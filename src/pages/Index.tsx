import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import HeroBanner from '@/components/HeroBanner';
import MediaGrid from '@/components/MediaGrid';

const Index = () => {
  const media = useMedia();
  const featured = media[4]; // Starbound
  const movies = media.filter(m => m.category === 'movie');
  const series = media.filter(m => m.category === 'series');
  const trending = [...media].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <HeroBanner item={featured} />
        <div className="space-y-10">
          <MediaGrid items={trending} title="🔥 Trending Now" />
          <MediaGrid items={movies} title="🎬 Movies" />
          <MediaGrid items={series} title="📺 Series" />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
