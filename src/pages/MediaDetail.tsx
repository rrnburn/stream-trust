import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Heart, Star, Clock, Calendar } from 'lucide-react';
import { useMedia, useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const MediaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const media = useMedia();
  const { toggleFavorite, isFavorite, addToHistory } = useAppContext();
  const item = media.find(m => m.id === id);

  if (!item) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Content not found</div>
      </AppLayout>
    );
  }

  const fav = isFavorite(item.id);
  const similar = media.filter(m => m.genre === item.genre && m.id !== item.id).slice(0, 6);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-8"
        >
          {/* Poster */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
              <span className="text-8xl font-display font-bold text-muted-foreground/15">{item.title.charAt(0)}</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1">
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground mb-3">{item.title}</h1>

            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-muted-foreground">
              {item.rating && (
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Star className="w-4 h-4 fill-primary" /> {item.rating}
                </span>
              )}
              {item.year && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {item.year}</span>}
              {item.duration && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {item.duration}</span>}
              <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-medium uppercase">{item.category}</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-medium">{item.genre}</span>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">{item.description}</p>

            <div className="flex gap-3">
              <Button
                onClick={() => addToHistory(item.id, 0)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
              >
                <Play className="w-4 h-4 fill-current" /> Play
              </Button>
              <Button
                variant="outline"
                onClick={() => toggleFavorite(item.id)}
                className={`border-border gap-2 ${fav ? 'bg-primary/10 border-primary text-primary' : 'text-foreground hover:bg-secondary'}`}
              >
                <Heart className={`w-4 h-4 ${fav ? 'fill-primary' : ''}`} />
                {fav ? 'Favorited' : 'Favorite'}
              </Button>
            </div>
          </div>
        </motion.div>

        {similar.length > 0 && (
          <div className="mt-12">
            <MediaGrid items={similar} title="Similar Content" />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MediaDetail;
