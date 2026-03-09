import { useMemo, useState } from 'react';
import { useMedia } from '@/context/AppContext';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';


const Movies = () => {
  const media = useMedia();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const selectedGroup = searchParams.get('group') || 'all';
  const setSelectedGroup = (g: string) => {
    if (g === 'all') { setSearchParams({}); } else { setSearchParams({ group: g }); }
  };

  const allMovies = useMemo(() => media.filter(m => m.category === 'movie'), [media]);


  const filtered = useMemo(() => {
    let items = allMovies;
    if (selectedGroup !== 'all') items = items.filter(i => (i.group || 'Uncategorized') === selectedGroup);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [allMovies, search, selectedGroup]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground">Movies</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>


        <MediaGrid items={filtered} />
      </div>
    </AppLayout>
  );
};

export default Movies;
