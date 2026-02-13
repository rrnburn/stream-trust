import { useState, useMemo } from 'react';
import { useMedia } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import VideoPlayer from '@/components/VideoPlayer';
import { Radio, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const LiveTV = () => {
  const media = useMedia();
  const channels = media.filter(m => m.category === 'channel');
  const [activeChannel, setActiveChannel] = useState<typeof channels[0] | null>(null);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter(c => c.title.toLowerCase().includes(q));
  }, [channels, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof channels>();
    filtered.forEach(c => {
      const g = c.group || 'Uncategorized';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggleGroup = (g: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  if (channels.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center p-4">
          <Radio className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg text-muted-foreground">No live channels</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Parse an IPTV source to see live channels here</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-0px)]">
        {/* Player area */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col">
          {activeChannel ? (
            <>
              <VideoPlayer
                src={activeChannel.streamUrl || ''}
                title={activeChannel.title}
                poster={activeChannel.poster}
              />
              <h2 className="text-lg font-display font-bold text-foreground mt-3">{activeChannel.title}</h2>
              <p className="text-sm text-muted-foreground">{activeChannel.group}</p>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-xl">
              <div className="text-center">
                <Radio className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">Select a channel to start watching</p>
              </div>
            </div>
          )}
        </div>

        {/* Channel list */}
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/50 flex flex-col max-h-[50vh] lg:max-h-full">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{filtered.length} channels</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {grouped.map(([group, items]) => (
              <Collapsible key={group} open={openGroups.has(group)} onOpenChange={() => toggleGroup(group)}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                  {openGroups.has(group) ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{group}</span>
                  <span className="ml-auto text-xs text-muted-foreground/60">{items.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {items.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannel(ch)}
                      className={`flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors ${
                        activeChannel?.id === ch.id
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      {ch.poster ? (
                        <img src={ch.poster} alt="" className="w-8 h-8 rounded object-cover bg-muted shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Radio className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate">{ch.title}</span>
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveTV;
