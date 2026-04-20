import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import TVGuide from '@/components/TVGuide';
import VideoPlayer from '@/components/VideoPlayer';
import { useMedia, useAppContext } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { CalendarDays, Search } from 'lucide-react';

const EPGGuide = () => {
  const media = useMedia();
  const { epgPrograms, parsingEpg } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<{ title: string; src: string; poster: string } | null>(null);

  const channels = useMemo(() => {
    const all = media.filter((m) => m.category === 'channel');
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((c) => c.title.toLowerCase().includes(q));
  }, [media, search]);

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

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filter channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
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
