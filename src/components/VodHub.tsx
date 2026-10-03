import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, Rows3, X } from 'lucide-react';
import { useMedia, useAppContext, MediaItem } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import MediaRail from '@/components/MediaRail';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MAX_RAILS = 14;
const RAIL_ITEMS = 20;

interface Props {
  category: 'movie' | 'series';
  title: string;
}

const VodHub = ({ category, title }: Props) => {
  const media = useMedia();
  const { watchHistory } = useAppContext();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [grid, setGrid] = useState(false);
  const group = params.get('group') || 'all';
  const setGroup = (g: string) => setParams(g === 'all' ? {} : { group: g });

  const { items, groups, byId } = useMemo(() => {
    const items: MediaItem[] = [];
    const byId = new Map<string, MediaItem>();
    const groups = new Map<string, MediaItem[]>();
    for (const m of media) {
      if (m.category !== category) continue;
      items.push(m);
      byId.set(m.id, m);
      const g = m.group || 'Uncategorized';
      let arr = groups.get(g);
      if (!arr) groups.set(g, (arr = []));
      arr.push(m);
    }
    return { items, groups, byId };
  }, [media, category]);

  const groupNames = useMemo(
    () => [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([g]) => g),
    [groups],
  );

  const { continueItems, progress } = useMemo(() => {
    const seen = new Set<string>();
    const continueItems: MediaItem[] = [];
    const progress: Record<string, number> = {};
    for (const h of watchHistory) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const m = byId.get(h.id);
      if (!m || h.finished) continue;
      continueItems.push(m);
      progress[m.id] = h.progress;
    }
    return { continueItems: continueItems.slice(0, RAIL_ITEMS), progress };
  }, [watchHistory, byId]);

  const filtered = useMemo(() => {
    let list = group === 'all' ? items : groups.get(group) || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q));
    }
    return list;
  }, [items, groups, group, search]);

  const showGrid = grid || group !== 'all' || !!search;

  return (
    <AppLayout>
      <div className="pb-6">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-8 pt-4 lg:pt-8">
          <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
              className={cn('p-2 rounded-full', searchOpen ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setGrid((g) => !g)}
              aria-label={grid ? 'Show rows' : 'Show grid'}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground"
            >
              {grid ? <Rows3 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="relative px-4 lg:px-8 mt-3">
            <Search className="absolute left-7 lg:left-11 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input autoFocus placeholder={`Search ${title.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-9 rounded-full" />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear" className="absolute right-7 lg:right-11 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl mt-3 py-2">
          <div className="flex gap-2 overflow-x-auto px-4 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {['all', ...groupNames].map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  group === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/60 text-muted-foreground border-border hover:text-foreground',
                )}
              >
                {g === 'all' ? 'All' : g}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No {title.toLowerCase()} yet. Add a source in Settings.</p>
        ) : showGrid ? (
          <div className="px-4 lg:px-8 mt-4">
            <p className="text-xs text-muted-foreground mb-3">{filtered.length.toLocaleString()} titles</p>
            <MediaGrid items={filtered} />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <MediaRail title="Continue Watching" items={continueItems} progress={progress} variant="wide" />
            <MediaRail title="Recently Added" items={items.slice(-RAIL_ITEMS).reverse()} />
            {groupNames.slice(0, MAX_RAILS).map((g) => {
              const list = groups.get(g)!;
              return (
                <MediaRail
                  key={g}
                  title={g}
                  items={list.slice(-RAIL_ITEMS).reverse()}
                  seeAllTo={`?group=${encodeURIComponent(g)}`}
                />
              );
            })}
            {groupNames.length > MAX_RAILS && (
              <p className="text-center text-xs text-muted-foreground px-4">
                More categories available in the chips above.
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default VodHub;
