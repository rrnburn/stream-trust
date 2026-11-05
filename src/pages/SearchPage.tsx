import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useMediaSearch } from '@/hooks/useMediaSearch';
import type { SearchCategory } from '@/lib/mediaSearch';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const search = useMediaSearch(query, category);

  const categories: { value: SearchCategory; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'channel', label: 'Live TV' },
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
              aria-label="Search library"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-12"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Button
                key={c.value}
                variant={category === c.value ? 'default' : 'secondary'}
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  category === c.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {search.error ? (
          <div className="text-center py-12">
            <p role="alert" className="text-muted-foreground mb-4">Couldn’t search your library.</p>
            <Button variant="outline" onClick={search.retry}>Retry</Button>
          </div>
        ) : (
          <MediaGrid items={search.items} onLoadMore={search.loadMore} hasMore={search.hasMore} loading={search.loading} />
        )}
      </div>
    </AppLayout>
  );
};

export default SearchPage;
