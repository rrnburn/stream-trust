import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle2, RotateCcw, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import DownloadButton from '@/components/DownloadButton';
import { isNativePlatform } from '@/lib/platform';
import { useAppContext } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface Episode {
  id: string;
  episodeNum: string;
  title: string;
  duration: string | null;
  plot: string | null;
  rating: string | null;
  image: string | null;
  streamUrl: string;
}

interface SeriesInfo {
  name: string;
  cover: string;
  plot: string;
  seasons: string[];
  episodes: Record<string, Episode[]>;
}

interface EpisodeModalProps {
  open: boolean;
  onClose: () => void;
  seriesId: string; // parent series media id (used to namespace per-episode download keys)
  seriesTitle: string;
  seriesPoster?: string;
  sourceId?: string;
  streamUrl: string; // e.g. https://host/series/user/pass/12345
  sourceUrl: string; // iptv source base url
  sourceUsername?: string;
  sourcePassword?: string;
  onPlay: (url: string, title: string) => void;
}

const EpisodeModal = ({
  open,
  onClose,
  seriesId,
  seriesTitle,
  seriesPoster,
  sourceId,
  streamUrl,
  sourceUrl,
  sourceUsername,
  sourcePassword,
  onPlay,
}: EpisodeModalProps) => {
  const { getResume, watchHistory } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  // Which episode was last played for this series?
  const lastEpisodeId = getResume(seriesId)?.lastEpisodeId;

  useEffect(() => {
    if (!open || !streamUrl || !sourceUsername || !sourcePassword) return;

    const fetchInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        if (isNativePlatform()) {
          // On native: call the Xtream API directly, no Supabase round-trip
          const { getSeriesInfoLocally } = await import('@/lib/playlistParser');
          const data = await getSeriesInfoLocally(sourceUrl, sourceUsername, sourcePassword, streamUrl);
          setSeriesInfo(data);
          if (data.seasons?.length > 0) setSelectedSeason(data.seasons[0]);
        } else {
          // On web: use the Supabase edge function
          // Extract series_id from URL pattern: .../series/user/pass/ID
          const parts = streamUrl.split('/');
          const seriesId = parts[parts.length - 1];

          const { data, error: fnError } = await supabase.functions.invoke('get-series-info', {
            body: { baseUrl: sourceUrl, username: sourceUsername, password: sourcePassword, seriesId },
          });

          if (fnError) throw fnError;
          if (data?.error) throw new Error(data.error);

          setSeriesInfo(data);
          if (data.seasons?.length > 0) setSelectedSeason(data.seasons[0]);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load series info');
      }
      setLoading(false);
    };

    fetchInfo();
  }, [open, streamUrl, sourceUrl, sourceUsername, sourcePassword]);

  const currentEpisodes = seriesInfo?.episodes?.[selectedSeason] || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">{seriesTitle}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading episodes...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-destructive mb-2">{error}</p>
            <p className="text-sm text-muted-foreground">Episode data may not be available for this series.</p>
          </div>
        )}

        {!loading && !error && seriesInfo && (
          <>
            {/* Season tabs */}
            {seriesInfo.seasons.length > 1 && (
              <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <div className="flex gap-2 pb-2 w-max">
                  {seriesInfo.seasons.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSeason(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedSeason === s
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Season {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Episode list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1 pr-2">
                {currentEpisodes.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">No episodes found for this season.</p>
                )}
                {currentEpisodes.map((ep) => {
                  const epLabel = `${seriesTitle} - S${selectedSeason}E${ep.episodeNum}`;
                  // Stable per-episode id so downloads + history are tracked separately per episode.
                  const epDownloadId = `${seriesId}:s${selectedSeason}e${ep.episodeNum}:${ep.id}`;
                  const epHistory = watchHistory.find((h) => h.id === epDownloadId);
                  const isFinished = !!epHistory?.finished;
                  const inProgress = !isFinished && !!epHistory && epHistory.progress > 0.02;
                  const isLastPlayed = lastEpisodeId === epDownloadId;
                  const progressPct = Math.round((epHistory?.progress ?? 0) * 100);
                  return (
                    <div
                      key={ep.id}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg transition-colors group border',
                        isLastPlayed
                          ? 'bg-primary/10 border-primary/40 hover:bg-primary/15'
                          : 'border-transparent hover:bg-secondary/80',
                      )}
                    >
                      <button
                        onClick={() => {
                          onPlay(ep.streamUrl, epLabel);
                          onClose();
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left"
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                            isFinished
                              ? 'bg-emerald-500/15 group-hover:bg-emerald-500/25'
                              : isLastPlayed
                                ? 'bg-primary/25 group-hover:bg-primary/35'
                                : 'bg-primary/10 group-hover:bg-primary/20',
                          )}
                        >
                          {isFinished ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label="Watched" />
                          ) : inProgress ? (
                            <RotateCcw className="w-4 h-4 text-primary" aria-label="Resume" />
                          ) : (
                            <Play className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">E{ep.episodeNum}</span>
                            <span
                              className={cn(
                                'text-sm font-medium truncate',
                                isFinished ? 'text-muted-foreground' : 'text-foreground',
                              )}
                            >
                              {ep.title}
                            </span>
                            {isLastPlayed && (
                              <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/20 text-primary inline-flex items-center gap-1">
                                <PlayCircle className="w-3 h-3" /> Last played
                              </span>
                            )}
                            {isFinished && (
                              <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                                Watched
                              </span>
                            )}
                          </div>
                          {ep.plot && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.plot}</p>}
                          {inProgress && (
                            <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.min(100, Math.max(2, progressPct))}%` }}
                              />
                            </div>
                          )}
                        </div>
                        {ep.duration && <span className="text-xs text-muted-foreground shrink-0">{ep.duration}</span>}
                      </button>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <DownloadButton
                          mediaId={epDownloadId}
                          title={epLabel}
                          poster={ep.image || seriesPoster || ''}
                          category="series"
                          streamUrl={ep.streamUrl}
                          sourceId={sourceId}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        {!loading && !error && !seriesInfo && !sourceUsername && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Episode browsing is only available for Xtream sources.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EpisodeModal;
