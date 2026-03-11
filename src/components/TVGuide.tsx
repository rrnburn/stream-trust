import { useState, useMemo, useRef, useEffect } from 'react';
import { format, differenceInMinutes, addHours, startOfHour } from 'date-fns';
import { Radio, Clock, Loader2 } from 'lucide-react';

export interface EpgProgram {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  category: string;
}

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

  // Group programs by channel_id
  const programsByChannel = useMemo(() => {
    const map: Record<string, EpgProgram[]> = {};
    for (const p of programs) {
      if (!map[p.channel_id]) map[p.channel_id] = [];
      map[p.channel_id].push(p);
    }
    // Sort each channel's programs by start time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return map;
  }, [programs]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const offsetMinutes = differenceInMinutes(now, timelineStart);
      const scrollTo = (offsetMinutes / 60) * HOUR_WIDTH - 100;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
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

  if (programs.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No EPG data available</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add an EPG URL in Sources to see the program guide</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card">
      {/* Header: timeline */}
      <div className="flex">
        <div
          className="shrink-0 bg-card border-r border-b border-border px-2 py-2 text-xs font-medium text-muted-foreground flex items-center"
          style={{ width: CHANNEL_COL_WIDTH }}
        >
          Channels
        </div>
        <div className="overflow-hidden flex-1" ref={scrollRef} style={{ overflowX: 'auto' }}>
          {/* Time header */}
          <div className="relative" style={{ width: totalWidth }}>
            <div className="flex border-b border-border">
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
        </div>
      </div>

      {/* Body: channels + programs */}
      <div className="flex max-h-[60vh] overflow-y-auto">
        {/* Channel column */}
        <div className="shrink-0 border-r border-border" style={{ width: CHANNEL_COL_WIDTH }}>
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onChannelSelect?.(ch)}
              className="flex items-center gap-2 w-full px-2 border-b border-border hover:bg-secondary/50 transition-colors text-left"
              style={{ height: ROW_HEIGHT }}
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
          ))}
        </div>

        {/* Program grid */}
        <div
          className="flex-1 overflow-x-auto"
          ref={scrollRef}
        >
          <div className="relative" style={{ width: totalWidth }}>
            {channels.map((ch) => {
              const chPrograms = programsByChannel[ch.tvgId || ''] || programsByChannel[ch.id] || programsByChannel[ch.title] || [];
              return (
                <div
                  key={ch.id}
                  className="relative border-b border-border"
                  style={{ height: ROW_HEIGHT }}
                >
                  {chPrograms.map((prog) => {
                    const pStart = new Date(prog.start_time);
                    const pEnd = new Date(prog.end_time);
                    const left = Math.max(0, (differenceInMinutes(pStart, timelineStart) / 60) * HOUR_WIDTH);
                    const duration = differenceInMinutes(pEnd, pStart);
                    const width = Math.max(30, (duration / 60) * HOUR_WIDTH - 2);

                    const isNow = now >= pStart && now < pEnd;

                    return (
                      <div
                        key={prog.id}
                        className={`absolute top-1 rounded px-2 py-1 text-xs overflow-hidden cursor-default transition-colors ${
                          isNow
                            ? 'bg-primary/20 border border-primary/40 text-primary'
                            : 'bg-secondary/60 border border-border text-foreground hover:bg-secondary'
                        }`}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          height: ROW_HEIGHT - 8,
                        }}
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
              );
            })}

            {/* Now indicator line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
              style={{ left: `${nowOffset}px` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVGuide;
