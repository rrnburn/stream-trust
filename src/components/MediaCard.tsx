import { memo } from 'react';
import { Star, Play, Heart } from 'lucide-react';
import { MediaItem } from '@/context/AppContext';
import { useAppContext } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';

const MediaCard = memo(({ item }: { item: MediaItem }) => {
  const { toggleFavorite, isFavorite } = useAppContext();
  const navigate = useNavigate();
  const fav = isFavorite(item.id);

  return (
    <div
      className="group relative cursor-pointer"
      onClick={() => navigate(`/media/${item.id}`)}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary card-hover">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <div className="text-6xl font-display font-bold text-muted-foreground/20">
              {item.title.charAt(0)}
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex gap-2 mb-2">
            <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors">
              <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
              className={`w-9 h-9 rounded-full border border-border flex items-center justify-center transition-colors ${
                fav ? 'bg-primary/20 border-primary' : 'bg-background/60 hover:bg-background/80'
              }`}
            >
              <Heart className={`w-4 h-4 ${fav ? 'text-primary fill-primary' : 'text-foreground'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {item.year && <span>{item.year}</span>}
          {item.rating && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-primary fill-primary" />
              {item.rating}
            </span>
          )}
          {item.genre && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
              {item.genre}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

MediaCard.displayName = 'MediaCard';

export default MediaCard;
