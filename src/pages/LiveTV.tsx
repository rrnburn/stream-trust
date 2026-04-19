import { useState, useMemo, useEffect } from 'react';
import { useMedia, useAppContext } from '@/context/AppContext';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import VideoPlayer from '@/components/VideoPlayer';
import { Radio, ChevronDown, ChevronRight, Search, Calendar, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
  const [filterSearch, setFilterSearch] = useState('');

  // All available groups (sorted)
  const allGroups = useMemo(() => {
    return [...new Set(channels.map(c => c.group || 'Uncategorized'))].sort();
  }, [channels]);

  // Multi-select groups: empty Set = show all
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(() => {
    const initial = searchParams.get('group');
    return initial ? new Set([initial]) : new Set();
  });

  // Keep URL in sync (single value when one selected, none otherwise)
  useEffect(() => {
    if (selectedGroups.size === 1) {
      const only = [...selectedGroups][0];
      setSearchParams({ group: only }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroups]);

  const toggleSelectedGroup = (g: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const clearSelectedGroups = () => setSelectedGroups(new Set());
  const selectAllGroups = () => setSelectedGroups(new Set(allGroups));

  const filtered = useMemo(() => {
    let items = channels;
    if (selectedGroups.size > 0) {
      items = items.filter(c => selectedGroups.has(c.group || 'Uncategorized'));
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(c => c.title.toLowerCase().includes(q));
    }
    return items;
  }, [channels, search, selectedGroups]);

  const visibleFilterGroups = useMemo(() => {
    if (!filterSearch) return allGroups;
    const q = filterSearch.toLowerCase();
    return allGroups.filter(g => g.toLowerCase().includes(q));
  }, [allGroups, filterSearch]);

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
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  // Match EPG programs for the active channel using multiple identifiers
  const channelPrograms = useMemo(() => {
    if (!activeChannel || epgPrograms.length === 0) return [];
    
    const matchIds = new Set<string>();
    if (activeChannel.tvgId) matchIds.add(activeChannel.tvgId.toLowerCase());
    if (activeChannel.id) matchIds.add(activeChannel.id.toLowerCase());
    if (activeChannel.title) matchIds.add(activeChannel.title.toLowerCase());

    return epgPrograms
      .filter(p => {
        const chId = (p.channel_id || '').toLowerCase();
        return matchIds.has(chId);
      })
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

        {/* EPG Program Guide - Between player and channel list */}
        {activeChannel && (
          <div className="border-b border-border bg-card/50 p-4">
            {channelPrograms.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Program Guide</h3>
                  <span className="text-xs text-muted-foreground">({channelPrograms.length} programs)</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {channelPrograms.map((program) => {
                    const startTime = new Date(program.start_time);
                    const endTime = new Date(program.end_time);
                    const now = new Date();
                    const isNow = now >= startTime && now < endTime;
                    const isPast = now > endTime;

                    return (
                      <div
                        key={program.id || `${program.channel_id}-${program.start_time}`}
                        className={`shrink-0 w-56 p-3 rounded-lg border transition-colors ${
                          isNow
                            ? 'bg-primary/10 border-primary/40'
                            : isPast
                            ? 'bg-muted/30 border-muted-foreground/20 opacity-60'
                            : 'bg-card border-border'
                        }`}
                      >
                        <h4 className={`font-semibold text-xs mb-1 truncate ${isNow ? 'text-primary' : 'text-foreground'}`}>
                          {program.title}
                          {isNow && (
                            <span className="ml-1.5 text-[10px] font-normal bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              Live
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                        </p>
                        {program.description && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{program.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2 text-center">
                <Calendar className="w-4 h-4 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No EPG data for this channel</p>
              </div>
            )}
          </div>
        )}

        {/* Channel List */}
        <div className="flex-1 min-h-0 bg-card/50 flex flex-col">
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
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    <span className="text-xs">
                      {selectedGroups.size === 0
                        ? 'All groups'
                        : `${selectedGroups.size} group${selectedGroups.size === 1 ? '' : 's'}`}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-0">
                  <div className="p-2 border-b border-border space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filter groups..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={selectAllGroups}>
                        Select all
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={clearSelectedGroups}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1">
                    {visibleFilterGroups.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No groups match</p>
                    ) : (
                      visibleFilterGroups.map(g => {
                        const checked = selectedGroups.has(g);
                        return (
                          <button
                            key={g}
                            onClick={() => toggleSelectedGroup(g)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-xs hover:bg-secondary/60 transition-colors"
                          >
                            <Checkbox checked={checked} className="pointer-events-none" />
                            <span className="truncate flex-1">{g}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedGroups.size > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={clearSelectedGroups}>
                  <X className="w-3.5 h-3.5" />
                  <span className="text-xs">Reset</span>
                </Button>
              )}
              <p className="text-xs text-muted-foreground ml-auto">{filtered.length} channels</p>
            </div>
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
