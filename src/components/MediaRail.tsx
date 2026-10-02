import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Radio } from 'lucide-react';
import { MediaItem } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface RailProps {
  title: string;
  items: MediaItem[];
  seeAllTo?: string;
  progress?: Record<string, number>;
  variant?: 'poster' | 'wide';
}

const RailCard = memo(({ item, pct, wide }: { item: MediaItem; pct?: number; wide: boolean }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/media/${item.id}`)}
      className={cn('shrink-0 snap-start text-left group', wide ? 'w-56' : 'w-28 sm:w-36')}
    >
      <div className={cn('relative rounded-lg overflow-hidden bg-secondary card-hover', wide ? 'aspect-video' : 'aspect-[2/3]')}>
        {item.poster ? (
          <img src={item.poster} alt={item.title} loading="lazy" className={cn('absolute inset-0 w-full h-full', wide && item.category === 'channel' ? 'object-contain p-6' : 'object-cover')} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-display font-bold text-muted-foreground/30">
            {item.title.charAt(0)}
          </div>
        )}
        {item.category === 'channel' && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
            <Radio className="w-3 h-3" /> LIVE
          </span>
        )}
        {pct !== undefined && pct > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-background/60">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct * 100)}%` }} />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium text-foreground line-clamp-1">{item.title}</p>
    </button>
  );
});
RailCard.displayName = 'RailCard';

const MediaRail = ({ title, items, seeAllTo, progress, variant = 'poster' }: RailProps) => {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between px-4 lg:px-8 mb-2">
        <h2 className="text-base sm:text-lg font-display font-semibold text-foreground">{title}</h2>
        {seeAllTo && (
          <Link to={seeAllTo} className="flex items-center text-xs text-primary font-medium">
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x px-4 lg:px-8 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <RailCard key={it.id} item={it} pct={progress?.[it.id]} wide={variant === 'wide'} />
        ))}
      </div>
    </section>
  );
};

export default MediaRail;
