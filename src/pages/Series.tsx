import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';

const Series = () => {
  const media = useMedia();
  const series = media.filter(m => m.category === 'series');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">TV Series</h1>
        <MediaGrid items={series} />
      </div>
    </AppLayout>
  );
};

export default Series;
