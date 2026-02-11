import { useMedia, useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Heart } from 'lucide-react';

const Favorites = () => {
  const media = useMedia();
  const { favorites } = useAppContext();
  const favMedia = media.filter(m => favorites.includes(m.id));

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">My Favorites</h1>
        {favMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg text-muted-foreground">No favorites yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Browse content and add items to your favorites</p>
          </div>
        ) : (
          <MediaGrid items={favMedia} />
        )}
      </div>
    </AppLayout>
  );
};

export default Favorites;
