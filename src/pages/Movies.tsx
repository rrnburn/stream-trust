import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';

const Movies = () => {
  const media = useMedia();
  const movies = media.filter(m => m.category === 'movie');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">Movies</h1>
        <MediaGrid items={movies} />
      </div>
    </AppLayout>
  );
};

export default Movies;
