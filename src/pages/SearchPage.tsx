import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Input } from '@/components/ui/input';

const SearchPage = () => {
  const media = useMedia();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = media.filter(m => {
    const matchesQuery = !query || m.title.toLowerCase().includes(query.toLowerCase()) || m.genre.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'all' || m.category === category;
    return matchesQuery && matchesCategory;
  });

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'movie', label: 'Movies' },
    { value: 'series', label: 'Series' },
    { value: 'vod', label: 'VOD' },
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">Search</h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search movies, series, genres..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-12"
            />
          </div>
          <div className="flex gap-2">
            {categories.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  category === c.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <MediaGrid items={filtered} />
      </div>
    </AppLayout>
  );
};

export default SearchPage;
