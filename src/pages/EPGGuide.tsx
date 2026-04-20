import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import TVGuide from '@/components/TVGuide';
import VideoPlayer from '@/components/VideoPlayer';
import { useMedia, useAppContext } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { CalendarDays, Search, ListFilter } from 'lucide-react';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const EPGGuide = () => {
  const media = useMedia();
  const { epgPrograms, parsingEpg } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [epgOnly, setEpgOnly] = useState(false);
  const [playing, setPlaying] = useState<{ title: string; src: string; poster: string } | null>(null);

  // Build set of channel keys that have at least one EPG program
  const channelsWithEpg = useMemo(() => {
    const keys = new Set<string>();
    for (const p of epgPrograms) {
      if (p.channel_id) keys.add(normalize(p.channel_id));
    }
    return keys;
  }, [epgPrograms]);

  const channels = useMemo(() => {
    let all = media.filter((m) => m.category === 'channel');
    if (epgOnly) {
      all = all.filter(
        (c) =>
          channelsWithEpg.has(normalize(c.tvgId || '')) ||
          channelsWithEpg.has(normalize(c.id || '')) ||
          channelsWithEpg.has(normalize(c.title || '')),
      );
    }
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((c) => c.title.toLowerCase().includes(q));
  }, [media, epgOnly, channelsWithEpg, search]);

  const handleChannelSelect = (channel: { id: string; title: string; poster: string; streamUrl?: string }) => {
    if (channel.streamUrl) {
      setPlaying({ title: channel.title, src: channel.streamUrl, poster: channel.poster });
    } else {
      navigate(`/media/${channel.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">TV Guide</h1>
            <p className="text-sm text-muted-foreground">
              {channels.length} channels · {epgPrograms.length} programs
            </p>
          </div>
        </div>

        {playing && (
          <VideoPlayer
            src={playing.src}
            title={playing.title}
            poster={playing.poster}
            onClose={() => setPlaying(null)}
          />
        )}

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filter channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <button
            onClick={() => setEpgOnly((v) => !v)}
            title={epgOnly ? 'Showing channels with EPG only — click to show all' : 'Show only channels with EPG'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors shrink-0 ${
              epgOnly
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            EPG only
          </button>
        </div>

        <TVGuide
          channels={channels}
          programs={epgPrograms}
          loading={parsingEpg}
          onChannelSelect={handleChannelSelect}
        />
      </div>
    </AppLayout>
  );
};

export default EPGGuide;
