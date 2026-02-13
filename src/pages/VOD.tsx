import { useMemo, useState } from 'react';
import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { PlayCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const VOD = () => {
  const media = useMedia();
  const [search, setSearch] = useState('');

  const vodItems = useMemo(() => {
    const items = media.filter(m => m.category === 'movie' || m.category === 'vod');
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.title.toLowerCase().includes(q));
  }, [media, search]);

  if (media.filter(m => m.category === 'movie' || m.category === 'vod').length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center p-4">
          <PlayCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg text-muted-foreground">No VOD content</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Parse an IPTV source to see movies and VOD here</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground">VOD / Movies</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <MediaGrid items={vodItems} />
      </div>
    </AppLayout>
  );
};

export default VOD;
