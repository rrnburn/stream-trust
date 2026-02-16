import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  seriesTitle: string;
  streamUrl: string; // e.g. https://host/series/user/pass/12345
  sourceUrl: string; // iptv source base url
  sourceUsername?: string;
  sourcePassword?: string;
  onPlay: (url: string, title: string) => void;
}

const EpisodeModal = ({ open, onClose, seriesTitle, streamUrl, sourceUrl, sourceUsername, sourcePassword, onPlay }: EpisodeModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  useEffect(() => {
    if (!open || !streamUrl || !sourceUsername || !sourcePassword) return;

    const fetchInfo = async () => {
      setLoading(true);
      setError(null);

      // Extract series_id from URL pattern: .../series/user/pass/ID
      const parts = streamUrl.split('/');
      const seriesId = parts[parts.length - 1];

      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-series-info', {
          body: { baseUrl: sourceUrl, username: sourceUsername, password: sourcePassword, seriesId },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setSeriesInfo(data);
        if (data.seasons?.length > 0) {
          setSelectedSeason(data.seasons[0]);
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
                  {seriesInfo.seasons.map(s => (
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
                {currentEpisodes.map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => {
                      onPlay(ep.streamUrl, `${seriesTitle} - S${selectedSeason}E${ep.episodeNum}`);
                      onClose();
                    }}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/80 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Play className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">E{ep.episodeNum}</span>
                        <span className="text-sm font-medium text-foreground truncate">{ep.title}</span>
                      </div>
                      {ep.plot && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.plot}</p>
                      )}
                    </div>
                    {ep.duration && (
                      <span className="text-xs text-muted-foreground shrink-0">{ep.duration}</span>
                    )}
                  </button>
                ))}
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
