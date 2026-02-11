import { motion } from 'framer-motion';
import { Play, Plus, Star } from 'lucide-react';
import { MediaItem } from '@/context/AppContext';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';

const HeroBanner = ({ item }: { item: MediaItem }) => {
  const { toggleFavorite, isFavorite } = useAppContext();

  return (
    <div className="relative h-[420px] lg:h-[480px] rounded-2xl overflow-hidden mb-10">
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30 z-10" />
      <div className="absolute inset-0 bg-secondary" />

      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute bottom-0 left-0 z-20 p-8 lg:p-12 max-w-xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold px-2 py-1 rounded bg-primary/20 text-primary uppercase tracking-wider">
            Featured
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="w-3 h-3 text-primary fill-primary" />
            {item.rating}
          </span>
          <span className="text-xs text-muted-foreground">{item.year}</span>
          <span className="text-xs text-muted-foreground">{item.duration}</span>
        </div>

        <h1 className="text-3xl lg:text-5xl font-display font-bold text-foreground mb-3">{item.title}</h1>
        <p className="text-sm text-muted-foreground mb-6 line-clamp-2">{item.description}</p>

        <div className="flex gap-3">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6">
            <Play className="w-4 h-4 fill-current" /> Watch Now
          </Button>
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-secondary gap-2"
            onClick={() => toggleFavorite(item.id)}
          >
            <Plus className={`w-4 h-4 ${isFavorite(item.id) ? 'rotate-45' : ''} transition-transform`} />
            {isFavorite(item.id) ? 'Remove' : 'My List'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default HeroBanner;
