import { useState, useMemo } from 'react';
import { useMedia, useAppContext } from '@/context/AppContext';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import VideoPlayer from '@/components/VideoPlayer';
import TVGuide from '@/components/TVGuide';
import { Radio, ChevronDown, ChevronRight, Search, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { format } from 'date-fns';

const LiveTV = () => {
  const media = useMedia();
  const { epgPrograms } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const channels = media.filter(m => m.category === 'channel');
  const [activeChannel, setActiveChannel] = useState<typeof channels[0] | null>(null);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const selectedGroup = searchParams.get('group') || 'all';
  const setSelectedGroup = (g: string) => {
    if (g === 'all') { setSearchParams({}); } else { setSearchParams({ group: g }); }
  };

  const filtered = useMemo(() => {
    let items = channels;
    if (selectedGroup !== 'all') {
      items = items.filter(c => (c.group || 'Uncategorized') === selectedGroup);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(c => c.title.toLowerCase().includes(q));
    }
    return items;
  }, [channels, search, selectedGroup]);

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
      if (next.has(g)) {
        next.delete(g);
      } else {
        next.add(g);
      }
      return next;
    });
  };

  // Filter EPG programs for the active channel
  const channelPrograms = useMemo(() => {
    if (!activeChannel) return [];
    // Match by tvgId first (the standard EPG identifier), then fall back to ID or title
    return epgPrograms
      .filter(p => 
        p.channel_id === (activeChannel.tvgId || activeChannel.id) || 
        p.channel_id === activeChannel.title
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [activeChannel, epgPrograms]);

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
      <div className="flex flex-col h-[calc(100vh-0px)]">
        {/* Video Player - Always at top */}
        <div className="w-full p-4 lg:p-6 border-b border-border bg-card">
          {activeChannel ? (
            <>
              <VideoPlayer
                src={activeChannel.streamUrl || ''}
                title={activeChannel.title}
                poster={activeChannel.poster}
              />
              <div className="mt-3">
                <h2 className="text-lg font-display font-bold text-foreground">{activeChannel.title}</h2>
                <p className="text-sm text-muted-foreground">{activeChannel.group}</p>
              </div>
            </>
          ) : (
            <div className="aspect-video flex items-center justify-center bg-muted/30 rounded-xl">
              <div className="text-center">
                <Radio className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">Select a channel to start watching</p>
              </div>
            </div>
          )}
        </div>

        {/* Channel List and EPG Grid */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Channel list */}
          <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-border bg-card/50 flex flex-col max-h-[50vh] lg:max-h-full">
            <div className="p-3 border-b border-border space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search channels..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <p className="text-xs text-muted-foreground">{filtered.length} channels</p>
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

          {/* EPG for selected channel */}
          <div className="flex-1 overflow-auto p-4 bg-background">
            {activeChannel ? (
              channelPrograms.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">Program Guide</h3>
                  </div>
                  <div className="space-y-2">
                    {channelPrograms.map((program) => {
                      const startTime = new Date(program.start_time);
                      const endTime = new Date(program.end_time);
                      const now = new Date();
                      const isNow = now >= startTime && now < endTime;
                      const isPast = now > endTime;

                      return (
                        <div
                          key={program.id}
                          className={`p-4 rounded-lg border transition-colors ${
                            isNow
                              ? 'bg-primary/10 border-primary/40'
                              : isPast
                              ? 'bg-muted/30 border-muted-foreground/20 opacity-60'
                              : 'bg-card border-border hover:bg-secondary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-semibold text-sm mb-1 ${isNow ? 'text-primary' : 'text-foreground'}`}>
                                {program.title}
                                {isNow && (
                                  <span className="ml-2 text-xs font-normal bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    On Now
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-muted-foreground mb-2 font-mono">
                                {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                                <span className="mx-2">•</span>
                                {format(startTime, 'MMM d, yyyy')}
                              </p>
                              {program.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{program.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No EPG data available for this channel</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Program guide will appear here when available</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Select a channel to view its program guide</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveTV;
