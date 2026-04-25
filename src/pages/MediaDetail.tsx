import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Heart, Star, Clock, Calendar, Tv, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useMedia, useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import VideoPlayer from '@/components/VideoPlayer';
import EpisodeModal from '@/components/EpisodeModal';
import DownloadButton from '@/components/DownloadButton';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const formatPos = (s: number) => {
  if (!s || s < 1) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const MediaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const media = useMedia();
  const { toggleFavorite, isFavorite, addToHistory, clearResume, getResume, sources } = useAppContext();
  const item = media.find((m) => m.id === id);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [playingUrl, setPlayingUrl] = useState('');
  const [playingTitle, setPlayingTitle] = useState('');
  const [playingMediaId, setPlayingMediaId] = useState('');
  const [resumeFrom, setResumeFrom] = useState(0);

  if (!item) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Content not found</div>
      </AppLayout>
    );
  }

  const fav = isFavorite(item.id);
  const similar = media.filter((m) => m.genre === item.genre && m.id !== item.id).slice(0, 6);
  const hasStream = !!item.streamUrl;
  const isSeries = item.category === 'series';

  // Find the source for this item to get credentials
  const source = sources.find((s) => s.id === item.sourceId);

  // For movies/VOD: resume info on the item itself.
  // For series: resume info points at the LAST episode played (lastEpisodeId).
  const resume = getResume(item.id);
  const lastEpisodeResume = isSeries && resume?.lastEpisodeId ? getResume(resume.lastEpisodeId) : null;
  const movieResumeSeconds = !isSeries && resume && !resume.finished ? Math.floor(resume.position) : 0;
  const hasMovieResume = movieResumeSeconds > 5;
  const movieFinished = !isSeries && (resume?.finished ?? false);

  const startPlayback = (url: string, mediaId: string, title: string, fromSeconds: number) => {
    setPlayingUrl(url);
    setPlayingMediaId(mediaId);
    setPlayingTitle(title);
    setResumeFrom(fromSeconds);
    setShowPlayer(true);
  };

  const handlePlayMovie = (fromStart: boolean) => {
    if (!hasStream || isSeries) return;
    startPlayback(item.streamUrl || '', item.id, item.title, fromStart ? 0 : movieResumeSeconds);
  };

  const handleEpisodePlay = (url: string, title: string, episodeMediaId?: string) => {
    const epId = episodeMediaId || `${item.id}:ep:${title}`;
    // Track that this episode is the most recent for the series
    addToHistory(epId, 0, 0, 0, item.id);
    startPlayback(url, epId, title, 0);
  };

  const handleResumeLastEpisode = () => {
    if (!resume?.lastEpisodeId || !lastEpisodeResume) return;
    // We don't have a direct stream URL stored; open the episode modal so user can confirm
    setShowEpisodeModal(true);
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Video Player */}
        {showPlayer && playingUrl && (
          <div className="mb-8">
            <VideoPlayer
              src={playingUrl}
              title={playingTitle}
              resumeFrom={resumeFrom}
              onProgress={(p, pos, dur) =>
                addToHistory(playingMediaId || item.id, p, pos ?? 0, dur ?? 0, isSeries ? item.id : undefined)
              }
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
              {item.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {item.year}
                </span>
              )}
              {item.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {item.duration}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-medium uppercase">{item.category}</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-medium">
                {item.genre}
              </span>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">{item.description}</p>

            {/* Resume hint */}
            {!isSeries && hasMovieResume && !movieFinished && (
              <p className="mb-3 text-xs text-muted-foreground">
                Continue from <span className="text-foreground font-medium">{formatPos(movieResumeSeconds)}</span>
                {resume?.duration ? ` of ${formatPos(resume.duration)}` : ''}
              </p>
            )}
            {!isSeries && movieFinished && (
              <p className="mb-3 text-xs text-primary inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Watched
              </p>
            )}
            {isSeries && lastEpisodeResume && (
              <p className="mb-3 text-xs text-muted-foreground">
                Last episode: {lastEpisodeResume.finished ? 'finished' : `${formatPos(lastEpisodeResume.position)} watched`}
              </p>
            )}

            <div className="flex gap-3 flex-wrap">
              {isSeries ? (
                <>
                  <Button
                    onClick={() => setShowEpisodeModal(true)}
                    disabled={!hasStream}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
                  >
                    <Tv className="w-4 h-4" /> Browse Episodes
                  </Button>
                  {lastEpisodeResume && !lastEpisodeResume.finished && (
                    <Button
                      variant="outline"
                      onClick={handleResumeLastEpisode}
                      className="border-border gap-2 text-foreground hover:bg-secondary"
                    >
                      <Play className="w-4 h-4 fill-current" /> Continue Episode
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={() => handlePlayMovie(!hasMovieResume)}
                    disabled={!hasStream}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {showPlayer ? 'Playing' : hasMovieResume ? `Resume ${formatPos(movieResumeSeconds)}` : 'Play'}
                  </Button>
                  {hasMovieResume && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        clearResume(item.id);
                        handlePlayMovie(true);
                      }}
                      className="border-border gap-2 text-foreground hover:bg-secondary"
                    >
                      <RotateCcw className="w-4 h-4" /> Restart
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="outline"
                onClick={() => toggleFavorite(item.id)}
                className={`border-border gap-2 ${fav ? 'bg-primary/10 border-primary text-primary' : 'text-foreground hover:bg-secondary'}`}
              >
                <Heart className={`w-4 h-4 ${fav ? 'fill-primary' : ''}`} />
                {fav ? 'Favorited' : 'Favorite'}
              </Button>
              {!isSeries && (
                <DownloadButton
                  mediaId={item.id}
                  title={item.title}
                  poster={item.poster}
                  category={item.category}
                  streamUrl={item.streamUrl || ''}
                  sourceId={item.sourceId}
                />
              )}
            </div>
            {isSeries && (
              <p className="mt-3 text-xs text-muted-foreground">
                Tap <span className="text-foreground font-medium">Browse Episodes</span> to play or download individual
                episodes offline.
              </p>
            )}
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
            seriesId={item.id}
            seriesTitle={item.title}
            seriesPoster={item.poster}
            sourceId={item.sourceId}
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
