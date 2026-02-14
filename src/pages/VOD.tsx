import { useMemo, useState } from 'react';
import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { PlayCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const VOD = () => {
  const media = useMedia();
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');

  const allVod = useMemo(() => media.filter(m => m.category === 'movie' || m.category === 'vod'), [media]);

  const groups = useMemo(() => {
    const g = [...new Set(allVod.map(i => i.group || 'Uncategorized'))].sort();
    return g;
  }, [allVod]);

  const vodItems = useMemo(() => {
    let items = allVod;
    if (selectedGroup !== 'all') {
      items = items.filter(i => (i.group || 'Uncategorized') === selectedGroup);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [allVod, search, selectedGroup]);

  if (allVod.length === 0) {
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

        {/* Sub-category filters */}
        {groups.length > 1 && (
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => setSelectedGroup('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedGroup === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({allVod.length})
              </button>
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedGroup === g ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        <MediaGrid items={vodItems} />
      </div>
    </AppLayout>
  );
};

export default VOD;
