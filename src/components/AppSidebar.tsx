import { Link, useLocation } from 'react-router-dom';
import { Home, Film, Tv, Search, Heart, Settings, Play, Radio, PlayCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/live-tv', icon: Radio, label: 'Live TV' },
  { to: '/vod', icon: PlayCircle, label: 'VOD' },
  { to: '/movies', icon: Film, label: 'Movies' },
  { to: '/series', icon: Tv, label: 'Series' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/favorites', icon: Heart, label: 'Favorites' },
  { to: '/sources', icon: Settings, label: 'Sources' },
];

const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      <div className="flex items-center gap-3 px-4 py-6 lg:px-6">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Play className="w-5 h-5 text-primary fill-primary" />
        </div>
        <span className="hidden lg:block font-display font-bold text-xl text-foreground">StreamVault</span>
      </div>

      <nav className="flex-1 px-2 lg:px-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
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

      <div className="p-4 lg:px-6 border-t border-sidebar-border space-y-3">
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
