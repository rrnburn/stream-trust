import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Radio, Film, Tv, Library, Search, Settings, Play,
  Database, Terminal, Download, CalendarDays, LogOut, ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/live-tv', icon: Radio, label: 'Live TV' },
  { to: '/movies', icon: Film, label: 'Movies' },
  { to: '/series', icon: Tv, label: 'Series' },
  { to: '/favorites', icon: Library, label: 'Library', also: ['/downloads'] },
];

const settingsLinks = [
  { to: '/sources', icon: Database, label: 'IPTV Sources', hint: 'Add or refresh playlists' },
  { to: '/epg', icon: CalendarDays, label: 'TV Guide', hint: 'Full programme grid' },
  { to: '/downloads', icon: Download, label: 'Downloads', hint: 'Offline titles' },
  { to: '/debug', icon: Terminal, label: 'Debug Logs', hint: 'View and copy app logs' },
];

const MobileShell = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (t: (typeof tabs)[number]) =>
    t.to === '/' ? pathname === '/' : pathname.startsWith(t.to) || !!t.also?.some((a) => pathname.startsWith(a));

  return (
    <>
      <header className="md:hidden fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="h-14 flex items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Play className="w-4 h-4 text-primary-foreground fill-current" />
            </span>
            <span className="font-display font-bold text-lg tracking-tight">StreamVault</span>
          </Link>
          <div className="flex items-center gap-1">
            <button aria-label="Search" onClick={() => navigate('/search')} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground/80 active:bg-secondary">
              <Search className="w-5 h-5" />
            </button>
            <button aria-label="Settings" onClick={() => setOpen(true)} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground/80 active:bg-secondary">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        <div className="h-16 grid grid-cols-5">
          {tabs.map((t) => {
            const active = isActive(t);
            return (
              <Link key={t.to} to={t.to} className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground')}>
                <t.icon className={cn('w-6 h-6', active && 'drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]')} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm pt-[calc(1.5rem+env(safe-area-inset-top))]">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>{user?.email ?? 'Local profile'}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {settingsLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 active:bg-secondary">
                <span className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><l.icon className="w-5 h-5" /></span>
                <span className="flex-1">
                  <span className="block font-medium">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.hint}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
            <button onClick={() => { setOpen(false); signOut(); }} className="w-full flex items-center gap-3 p-3 rounded-xl text-destructive active:bg-secondary mt-4">
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileShell;
