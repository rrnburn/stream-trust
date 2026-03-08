import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Film, Tv, Search, Heart, Settings, Play, Radio, PlayCircle, LogOut, Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMedia } from '@/context/AppContext';
import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  category?: string; // media category to pull groups from
}

const navItems: NavItem[] = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/live-tv', icon: Radio, label: 'Live TV', category: 'channel' },
  { to: '/movies', icon: Film, label: 'Movies', category: 'movie' },
  { to: '/series', icon: Tv, label: 'Series', category: 'series' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/favorites', icon: Heart, label: 'Favorites' },
  { to: '/sources', icon: Settings, label: 'Sources' },
  { to: '/debug', icon: Terminal, label: 'Logs' },
];

const AppSidebar = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signOut, user } = useAuth();
  const media = useMedia();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Build groups per category
  const groupsByCategory = useMemo(() => {
    const map: Record<string, string[]> = {};
    
    // channels
    const channels = media.filter(m => m.category === 'channel');
    map['channel'] = [...new Set(channels.map(c => c.group || 'Uncategorized'))].sort();
    
    // movies
    const movies = media.filter(m => m.category === 'movie');
    map['movie'] = [...new Set(movies.map(c => c.group || 'Uncategorized'))].sort();
    
    // series
    const series = media.filter(m => m.category === 'series');
    map['series'] = [...new Set(series.map(c => c.group || 'Uncategorized'))].sort();
    
    
    return map;
  }, [media]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const currentGroup = searchParams.get('group');

  return (
    <aside className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      <div className="flex items-center gap-3 px-4 py-4 lg:px-6 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Play className="w-5 h-5 text-primary fill-primary" />
        </div>
        <span className="hidden lg:block font-display font-bold text-xl text-foreground">StreamVault</span>
      </div>

      <nav className="flex-1 px-2 lg:px-4 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {navItems.map(({ to, icon: Icon, label, category }) => {
          const active = location.pathname === to;
          const groups = category ? groupsByCategory[category] || [] : [];
          const hasSubMenu = groups.length > 1;
          const isExpanded = expandedSections.has(to);

          if (hasSubMenu) {
            return (
              <div key={to}>
                <div className="flex items-center">
                  <Link
                    to={to}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex-1 min-w-0 ${
                      active && !currentGroup
                        ? 'bg-primary/15 text-primary'
                        : active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="hidden lg:block truncate">{label}</span>
                  </Link>
                  <button
                    onClick={() => toggleSection(to)}
                    className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {isExpanded && (
                  <div className="hidden lg:block ml-8 mt-0.5 space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {groups.map(g => {
                      const isActiveGroup = active && currentGroup === g;
                      return (
                        <Link
                          key={g}
                          to={`${to}?group=${encodeURIComponent(g)}`}
                          className={`block px-3 py-1.5 rounded-md text-xs font-medium truncate transition-colors ${
                            isActiveGroup
                              ? 'bg-primary/15 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                          }`}
                          title={g}
                        >
                          {g}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 lg:px-6 border-t border-sidebar-border space-y-3 shrink-0">
        {user && (
          <p className="text-xs text-muted-foreground truncate hidden lg:block">{user.email}</p>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
