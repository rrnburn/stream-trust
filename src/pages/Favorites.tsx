import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, History, Download, ChevronRight } from 'lucide-react';
import { useMedia, useAppContext, MediaItem } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import MediaGrid from '@/components/MediaGrid';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'favourites', label: 'Favourites', icon: Heart },
  { key: 'history', label: 'History', icon: History },
  { key: 'downloads', label: 'Downloads', icon: Download },
] as const;

const Empty = ({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <Icon className="w-14 h-14 text-muted-foreground/30 mb-4" />
    <p className="text-lg text-muted-foreground">{title}</p>
    <p className="text-sm text-muted-foreground/60 mt-1">{hint}</p>
  </div>
);

const Favorites = () => {
  const media = useMedia();
  const { favorites, watchHistory } = useAppContext();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as (typeof tabs)[number]['key']) || 'favourites';

  const byId = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const favMedia = useMemo(() => favorites.map((id) => byId.get(id)).filter(Boolean) as MediaItem[], [favorites, byId]);
  const historyMedia = useMemo(() => {
    const seen = new Set<string>();
    const out: MediaItem[] = [];
    for (const h of watchHistory) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const m = byId.get(h.id);
      if (m) out.push(m);
    }
    return out;
  }, [watchHistory, byId]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-4">Library</h1>
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 mb-6 max-w-md">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setParams(t.key === 'favourites' ? {} : { tab: t.key })}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'favourites' &&
          (favMedia.length ? <MediaGrid items={favMedia} /> : <Empty icon={Heart} title="No favourites yet" hint="Tap Favourite on anything you love" />)}
        {tab === 'history' &&
          (historyMedia.length ? <MediaGrid items={historyMedia} /> : <Empty icon={History} title="Nothing watched yet" hint="Your watch history appears here" />)}
        {tab === 'downloads' && (
          <Link to="/downloads" className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 max-w-md">
            <span className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Download className="w-5 h-5" /></span>
            <span className="flex-1">
              <span className="block font-medium text-foreground">Open Downloads</span>
              <span className="block text-xs text-muted-foreground">Watch saved titles offline</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        )}
      </div>
    </AppLayout>
  );
};

export default Favorites;
