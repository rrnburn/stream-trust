import { useState, useMemo, useRef, useEffect } from 'react';
import { format, differenceInMinutes, addHours, startOfHour } from 'date-fns';
import { Radio, Clock, Loader2 } from 'lucide-react';
import type { EpgProgram } from '@/context/AppContext.types';

export type { EpgProgram };

interface Channel {
  id: string;
  title: string;
  poster: string;
  tvgId?: string;
  streamUrl?: string;
  group?: string;
}

interface TVGuideProps {
  channels: Channel[];
  programs: EpgProgram[];
  loading: boolean;
  onChannelSelect?: (channel: Channel) => void;
}

const HOUR_WIDTH = 240; // px per hour
const ROW_HEIGHT = 56;
const TIMELINE_HOURS = 24;
const CHANNEL_COL_WIDTH = 160;

const TVGuide = ({ channels, programs, loading, onChannelSelect }: TVGuideProps) => {
  // Single scroll container — both x and y handled together, no sync needed
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const timelineStart = startOfHour(now);

  // Build time slots
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    for (let i = 0; i < TIMELINE_HOURS; i++) {
      slots.push(addHours(timelineStart, i));
    }
    return slots;
  }, [timelineStart]);

  // Normalize channel ids (alphanumerics-only lowercase) so EPG ids like
  // "BBC.One.uk", "bbc1", and channel titles like "BBC One" all match.
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const programsByChannel = useMemo(() => {
    const map: Record<string, EpgProgram[]> = {};
    for (const p of programs) {
      const key = normalize(p.channel_id || '');
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return map;
  }, [programs]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const offsetMinutes = differenceInMinutes(now, timelineStart);
      const scrollTo = Math.max(0, (offsetMinutes / 60) * HOUR_WIDTH - 100);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [now, timelineStart]);

  const totalWidth = TIMELINE_HOURS * HOUR_WIDTH;
  const nowOffset = (differenceInMinutes(now, timelineStart) / 60) * HOUR_WIDTH;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground text-sm">Loading program guide...</span>
      </div>
    );
  }

  const hasPrograms = programs.length > 0;

  return (
    // Single scroll container — x and y scroll together, no dual-container desync
    <div
      ref={scrollRef}
      className="border border-border rounded-lg overflow-auto max-h-[60vh] bg-card"
    >
      <div style={{ width: CHANNEL_COL_WIDTH + totalWidth }}>

        {/* ── Sticky time header ─────────────────────────────── */}
        <div className="flex sticky top-0 z-30 bg-card border-b border-border">
          {/* Corner cell — sticky both left and top */}
          <div
            className="shrink-0 sticky left-0 z-40 bg-card border-r border-border px-2 py-2 text-xs font-medium text-muted-foreground flex items-center"
            style={{ width: CHANNEL_COL_WIDTH }}
          >
            Channels
          </div>
          <div className="flex">
            {timeSlots.map((slot, i) => (
              <div
                key={i}
                className="shrink-0 px-2 py-2 text-xs text-muted-foreground border-r border-border font-mono"
                style={{ width: HOUR_WIDTH }}
              >
                {format(slot, 'HH:mm')}
              </div>
            ))}
          </div>
        </div>

        {/* ── Channel rows ───────────────────────────────────── */}
        <div className="relative">
          {/* Now indicator — single element spanning all rows */}
          {hasPrograms && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
              style={{ left: CHANNEL_COL_WIDTH + nowOffset }}
            />
          )}

          {channels.map((ch) => {
            const chPrograms =
              programsByChannel[normalize(ch.tvgId || '')] ||
              programsByChannel[normalize(ch.id || '')] ||
              programsByChannel[normalize(ch.title || '')] ||
              [];
            return (
              <div key={ch.id} className="flex border-b border-border" style={{ height: ROW_HEIGHT }}>
                {/* Channel name — sticky left, always visible during horizontal scroll */}
                <button
                  onClick={() => onChannelSelect?.(ch)}
                  className="shrink-0 sticky left-0 z-20 bg-card border-r border-border flex items-center gap-2 px-2 hover:bg-secondary/50 transition-colors text-left"
                  style={{ width: CHANNEL_COL_WIDTH, height: ROW_HEIGHT }}
                >
                  {ch.poster ? (
                    <img src={ch.poster} alt="" className="w-6 h-6 rounded object-cover shrink-0 bg-muted" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                      <Radio className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs text-foreground truncate">{ch.title}</span>
                </button>

                {/* Programs */}
                <div className="relative shrink-0" style={{ width: totalWidth, height: ROW_HEIGHT }}>
                  {chPrograms.map((prog, progIdx) => {
                    const pStart = new Date(prog.start_time);
                    const pEnd = new Date(prog.end_time);
                    const left = Math.max(0, (differenceInMinutes(pStart, timelineStart) / 60) * HOUR_WIDTH);
                    const duration = differenceInMinutes(pEnd, pStart);
                    const width = Math.max(30, (duration / 60) * HOUR_WIDTH - 2);
                    const isNow = now >= pStart && now < pEnd;

                    return (
                      <div
                        key={prog.id ?? `${ch.id}-${progIdx}`}
                        className={`absolute top-1 rounded px-2 py-1 text-xs overflow-hidden cursor-default transition-colors ${
                          isNow
                            ? 'bg-primary/20 border border-primary/40 text-primary'
                            : 'bg-secondary/60 border border-border text-foreground hover:bg-secondary'
                        }`}
                        style={{ left: `${left}px`, width: `${width}px`, height: ROW_HEIGHT - 8 }}
                        title={`${prog.title}\n${format(pStart, 'HH:mm')} - ${format(pEnd, 'HH:mm')}${prog.description ? '\n' + prog.description : ''}`}
                      >
                        <div className="font-medium truncate leading-tight">{prog.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {format(pStart, 'HH:mm')} - {format(pEnd, 'HH:mm')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* No EPG overlay — channels loaded but no programs parsed yet */}
          {!hasPrograms && channels.length > 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ left: CHANNEL_COL_WIDTH }}
            >
              <div className="text-center">
                <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No EPG data available</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Add an EPG URL in Sources to see the program guide
                </p>
              </div>
            </div>
          )}

          {/* Empty state — no channels at all */}
          {channels.length === 0 && (
            <div className="py-10 text-center" style={{ width: CHANNEL_COL_WIDTH + totalWidth }}>
              <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No channels available</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add an IPTV source in Sources</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TVGuide;
