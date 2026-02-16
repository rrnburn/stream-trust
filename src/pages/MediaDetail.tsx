import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Heart, Star, Clock, Calendar, Tv } from 'lucide-react';
import { useMedia, useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import VideoPlayer from '@/components/VideoPlayer';
import EpisodeModal from '@/components/EpisodeModal';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const MediaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const media = useMedia();
  const { toggleFavorite, isFavorite, addToHistory, sources } = useAppContext();
  const item = media.find(m => m.id === id);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [playingUrl, setPlayingUrl] = useState('');
  const [playingTitle, setPlayingTitle] = useState('');

  if (!item) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Content not found</div>
      </AppLayout>
    );
  }

  const fav = isFavorite(item.id);
  const similar = media.filter(m => m.genre === item.genre && m.id !== item.id).slice(0, 6);
  const hasStream = !!item.streamUrl;
  const isSeries = item.category === 'series';

  // Find the source for this item to get credentials
  const source = sources.find(s => s.id === item.sourceId);

  const handlePlay = () => {
    if (!hasStream) return;
    if (isSeries) {
      setShowEpisodeModal(true);
      return;
    }
    addToHistory(item.id, 0);
    setPlayingUrl(item.streamUrl || '');
    setPlayingTitle(item.title);
    setShowPlayer(true);
  };

  const handleEpisodePlay = (url: string, title: string) => {
    addToHistory(item.id, 0);
    setPlayingUrl(url);
    setPlayingTitle(title);
    setShowPlayer(true);
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Video Player */}
        {showPlayer && playingUrl && (
          <div className="mb-8">
            <VideoPlayer
              src={playingUrl}
              title={playingTitle}
              onProgress={(p) => addToHistory(item.id, p)}
              onClose={() => setShowPlayer(false)}
            />
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-8"
        >
          {/* Poster */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
              {item.poster ? (
                <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-8xl font-display font-bold text-muted-foreground/15">{item.title.charAt(0)}</span>
              )}
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
                onClick={handlePlay}
                disabled={!hasStream}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
              >
                {isSeries ? (
                  <>
                    <Tv className="w-4 h-4" /> Browse Episodes
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> {showPlayer ? 'Playing' : hasStream ? 'Play' : 'No Stream'}
                  </>
                )}
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

        {/* Episode Modal for Series */}
        {isSeries && (
          <EpisodeModal
            open={showEpisodeModal}
            onClose={() => setShowEpisodeModal(false)}
            seriesTitle={item.title}
            streamUrl={item.streamUrl || ''}
            sourceUrl={source?.url || ''}
            sourceUsername={source?.username}
            sourcePassword={source?.password}
            onPlay={handleEpisodePlay}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default MediaDetail;
