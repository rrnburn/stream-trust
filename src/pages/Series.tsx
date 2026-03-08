import { useMemo, useState } from 'react';
import { useMedia } from '@/context/AppContext';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';


const Series = () => {
  const media = useMedia();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const selectedGroup = searchParams.get('group') || 'all';
  const setSelectedGroup = (g: string) => {
    if (g === 'all') { setSearchParams({}); } else { setSearchParams({ group: g }); }
  };

  const allSeries = useMemo(() => media.filter(m => m.category === 'series'), [media]);

  const groups = useMemo(() => {
    return [...new Set(allSeries.map(i => i.group || 'Uncategorized'))].sort();
  }, [allSeries]);

  const filtered = useMemo(() => {
    let items = allSeries;
    if (selectedGroup !== 'all') items = items.filter(i => (i.group || 'Uncategorized') === selectedGroup);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [allSeries, search, selectedGroup]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground">TV Series</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {groups.length > 1 && (
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <div className="flex gap-2 pb-2 w-max">
              <button
                onClick={() => setSelectedGroup('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedGroup === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({allSeries.length})
              </button>
              {groups.map(g => (
                <button key={g} onClick={() => setSelectedGroup(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedGroup === g ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >{g}</button>
              ))}
            </div>
          </div>
        )}

        <MediaGrid items={filtered} />
      </div>
    </AppLayout>
  );
};

export default Series;
