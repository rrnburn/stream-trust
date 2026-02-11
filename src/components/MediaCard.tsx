import { motion } from 'framer-motion';
import { Star, Play, Heart } from 'lucide-react';
import { MediaItem } from '@/context/AppContext';
import { useAppContext } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';

const MediaCard = ({ item, index = 0 }: { item: MediaItem; index?: number }) => {
  const { toggleFavorite, isFavorite } = useAppContext();
  const navigate = useNavigate();
  const fav = isFavorite(item.id);

  const genreColors: Record<string, string> = {
    Action: 'bg-red-500/20 text-red-400',
    'Sci-Fi': 'bg-blue-500/20 text-blue-400',
    Drama: 'bg-purple-500/20 text-purple-400',
    Thriller: 'bg-orange-500/20 text-orange-400',
    Fantasy: 'bg-emerald-500/20 text-emerald-400',
    Horror: 'bg-rose-500/20 text-rose-400',
    Romance: 'bg-pink-500/20 text-pink-400',
    Documentary: 'bg-teal-500/20 text-teal-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group relative cursor-pointer"
      onClick={() => navigate(`/media/${item.id}`)}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary card-hover">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <div className="text-6xl font-display font-bold text-muted-foreground/20">
            {item.title.charAt(0)}
          </div>
        </div>
        
        {/* Overlay on hover */}
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
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${genreColors[item.genre] || 'bg-muted text-muted-foreground'}`}>
              {item.genre}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MediaCard;
