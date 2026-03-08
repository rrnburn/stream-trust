import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, ArrowDown } from 'lucide-react';
import { logger, type LogEntry, type LogLevel } from '@/lib/logger';

const levelColor: Record<LogLevel, string> = {
  debug: 'text-muted-foreground',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const levelBadgeVariant: Record<LogLevel, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  debug: 'outline',
  info: 'secondary',
  warn: 'default',
  error: 'destructive',
};

const DebugLogs = () => {
  const [entries, setEntries] = useState<LogEntry[]>(logger.getEntries());
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return logger.subscribe(() => setEntries(logger.getEntries()));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.level === filter);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] gap-3 p-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Debug Logs</h1>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'error', 'warn', 'info', 'debug'] as const).map(lvl => (
              <Button
                key={lvl}
                size="sm"
                variant={filter === lvl ? 'default' : 'outline'}
                onClick={() => setFilter(lvl)}
                className="text-xs capitalize shrink-0 h-7 px-2"
              >
                {lvl}
              </Button>
            ))}
            <Button size="sm" variant="destructive" onClick={() => logger.clear()} className="shrink-0 h-7 px-2">
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 rounded-lg border border-border bg-card p-2 font-mono text-xs">
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No logs yet</p>
          )}
          {filtered.map(entry => (
            <div key={entry.id} className="py-1.5 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground text-[10px] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <Badge variant={levelBadgeVariant[entry.level]} className="text-[10px] h-4 shrink-0 uppercase">
                  {entry.level}
                </Badge>
                <span className="text-primary/70 text-[11px] shrink-0">[{entry.component}]</span>
              </div>
              <p className={`${levelColor[entry.level]} text-[11px] mt-0.5 break-words`}>{entry.message}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </ScrollArea>
      </div>
    </AppLayout>
  );
};

export default DebugLogs;
