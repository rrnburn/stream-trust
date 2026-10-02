import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { useMedia, useAppContext } from '@/context/AppContext';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import VideoPlayer from '@/components/VideoPlayer';
import { Radio, Search, X, Clock, Tv } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Channel = ReturnType<typeof useMedia>[number];
type Program = ReturnType<typeof useAppContext>['epgPrograms'][number];

const PAGE = 30;
const RECENT_KEY = 'livetv:recent';
const ALL = '__all__';
const RECENT = '__recent__';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** Re-render every 30s so live progress bars advance. */
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const programsFor = (index: Map<string, Program[]>, c: Channel): Program[] => {
  for (const key of [c.tvgId, c.title, c.id]) {
    if (!key) continue;
    const hit = index.get(normalize(key));
    if (hit) return hit;
  }
  return [];
};

const nowNext = (progs: Program[], now: number) => {
  const i = progs.findIndex((p) => new Date(p.end_time).getTime() > now);
  if (i < 0) return { current: undefined, next: undefined };
  const p = progs[i];
  const isCurrent = new Date(p.start_time).getTime() <= now;
  return isCurrent ? { current: p, next: progs[i + 1] } : { current: undefined, next: p };
};

const pct = (p: Program, now: number) => {
  const s = new Date(p.start_time).getTime();
  const e = new Date(p.end_time).getTime();
  return Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100));
};

const ChannelRow = memo(
  ({
    channel,
    current,
    next,
    progress,
    active,
    onSelect,
  }: {
    channel: Channel;
    current?: Program;
    next?: Program;
    progress: number;
    active: boolean;
    onSelect: (c: Channel) => void;
  }) => (
    <button
      onClick={() => onSelect(channel)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2',
        active ? 'bg-primary/10 border-primary' : 'border-transparent active:bg-secondary/60 hover:bg-secondary/40',
      )}
    >
      <div className="w-14 h-14 shrink-0 rounded-lg bg-secondary/70 flex items-center justify-center overflow-hidden">
        {channel.poster ? (
          <img src={channel.poster} alt="" loading="lazy" className="w-full h-full object-contain p-1" />
        ) : (
          <span className="font-display font-bold text-muted-foreground">{channel.title.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('font-semibold text-sm truncate', active ? 'text-primary' : 'text-foreground')}>
            {channel.title}
          </p>
          {active && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
              Live
            </span>
          )}
        </div>
        {current ? (
          <>
            <p className="text-xs text-foreground/80 truncate mt-0.5">{current.title}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {format(new Date(current.end_time), 'HH:mm')}
              </span>
            </div>
            {next && (
              <p className="text-[11px] text-muted-foreground truncate mt-1">
                Next {format(new Date(next.start_time), 'HH:mm')} · {next.title}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{channel.group || 'Live channel'}</p>
        )}
      </div>
    </button>
  ),
);
ChannelRow.displayName = 'ChannelRow';

const LiveTV = () => {
  const media = useMedia();
  const { epgPrograms } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow();

  const channels = useMemo(() => media.filter((m) => m.category === 'channel'), [media]);
  const [active, setActive] = useState<Channel | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [category, setCategory] = useState<string>(() => searchParams.get('group') || ALL);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    channels.forEach((c) => {
      const g = c.group || 'Uncategorized';
      counts.set(g, (counts.get(g) || 0) + 1);
    });
    return [...counts.keys()].sort((a, b) => a.localeCompare(b));
  }, [channels]);

  // Index EPG once: normalized channel id -> programmes sorted by start.
  const epgIndex = useMemo(() => {
    const map = new Map<string, Program[]>();
    for (const p of epgPrograms) {
      const k = normalize(p.channel_id || '');
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    map.forEach((list) => list.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [epgPrograms]);

  const filtered = useMemo(() => {
    let items: Channel[];
    if (category === RECENT) {
      const byId = new Map(channels.map((c) => [c.id, c]));
      items = recent.map((id) => byId.get(id)).filter(Boolean) as Channel[];
    } else if (category === ALL) {
      items = channels;
    } else {
      items = channels.filter((c) => (c.group || 'Uncategorized') === category);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(q));
    }
    return items;
  }, [channels, category, recent, search]);

  useEffect(() => {
    setLimit(PAGE);
    if (category !== ALL && category !== RECENT) setSearchParams({ group: category }, { replace: true });
    else setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setLimit((l) => Math.min(l + PAGE, filtered.length)),
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const select = (c: Channel) => {
    setActive(c);
    setRecent((prev) => {
      const next = [c.id, ...prev.filter((id) => id !== c.id)].slice(0, 20);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const activeInfo = useMemo(
    () => (active ? nowNext(programsFor(epgIndex, active), now) : { current: undefined, next: undefined }),
    [active, epgIndex, now],
  );

  if (channels.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center p-4">
          <Radio className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg text-muted-foreground">No live channels</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Add an IPTV source to see live channels here</p>
        </div>
      </AppLayout>
    );
  }

  const chips: { id: string; label: string }[] = [
    { id: ALL, label: 'All' },
    ...(recent.length ? [{ id: RECENT, label: 'Recent' }] : []),
    ...groups.map((g) => ({ id: g, label: g })),
  ];

  return (
    <AppLayout>
      <div className="md:flex md:h-screen">
        {/* Player column — sticky on phones */}
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] md:static z-30 bg-background md:flex-1 md:overflow-y-auto md:p-6">
          {active ? (
            <VideoPlayer key={active.id} src={active.streamUrl || ''} title={active.title} poster={active.poster} />
          ) : (
            <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-secondary to-background md:rounded-xl">
              <div className="text-center">
                <Tv className="w-10 h-10 text-primary/60 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Pick a channel to start watching</p>
              </div>
            </div>
          )}
          {active && (
            <div className="px-4 py-3 md:px-0 border-b border-border/50 md:border-0">
              <h2 className="font-display font-bold text-foreground truncate">{active.title}</h2>
              {activeInfo.current ? (
                <>
                  <p className="text-sm text-foreground/80 truncate">
                    {activeInfo.current.title}{' '}
                    <span className="text-muted-foreground font-mono text-xs">
                      {format(new Date(activeInfo.current.start_time), 'HH:mm')}–
                      {format(new Date(activeInfo.current.end_time), 'HH:mm')}
                    </span>
                  </p>
                  <div className="h-1 mt-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct(activeInfo.current, now)}%` }} />
                  </div>
                  {activeInfo.current.description && (
                    <p className="hidden md:block text-sm text-muted-foreground mt-3">
                      {activeInfo.current.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{active.group}</p>
              )}
            </div>
          )}

          {/* Category chips + search */}
          <div className="bg-background/95 backdrop-blur-xl border-b border-border/50 md:hidden">
            <ChipBar
              chips={chips}
              value={category}
              onChange={setCategory}
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              search={search}
              setSearch={setSearch}
            />
          </div>
        </div>

        {/* Channel list */}
        <div className="md:w-[420px] md:border-l md:border-border md:overflow-y-auto md:h-screen">
          <div className="hidden md:block sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50">
            <ChipBar
              chips={chips}
              value={category}
              onChange={setCategory}
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              search={search}
              setSearch={setSearch}
            />
          </div>
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
            {category === RECENT && <Clock className="w-3.5 h-3.5" />}
            {filtered.length.toLocaleString()} channels
          </div>
          <div className="divide-y divide-border/40">
            {filtered.slice(0, limit).map((c) => {
              const { current, next } = nowNext(programsFor(epgIndex, c), now);
              return (
                <ChannelRow
                  key={c.id}
                  channel={c}
                  current={current}
                  next={next}
                  progress={current ? pct(current, now) : 0}
                  active={active?.id === c.id}
                  onSelect={select}
                />
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">No channels match</p>
          )}
          <div ref={sentinel} className="h-8" />
        </div>
      </div>
    </AppLayout>
  );
};

const ChipBar = ({
  chips,
  value,
  onChange,
  showSearch,
  setShowSearch,
  search,
  setSearch,
}: {
  chips: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
}) => (
  <div className="py-2">
    {showSearch ? (
      <div className="px-4 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-10 bg-secondary border-0 h-10 rounded-full"
        />
        <button
          aria-label="Close search"
          onClick={() => {
            setSearch('');
            setShowSearch(false);
          }}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-2 overflow-x-auto px-4 scrollbar-none">
        <button
          aria-label="Search channels"
          onClick={() => setShowSearch(true)}
          className="shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground/80"
        >
          <Search className="w-4 h-4" />
        </button>
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              'shrink-0 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              value === c.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground/80 hover:bg-secondary/80',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

export default LiveTV;
