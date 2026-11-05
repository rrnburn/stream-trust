import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import MediaCard from './MediaCard';
import { MediaItem } from '@/context/AppContext';

const PAGE_SIZE = 30;

const MediaGrid = ({ items, title, onLoadMore, hasMore = false, loading = false }: {
  items: MediaItem[]; title?: string; onLoadMore?: () => void; hasMore?: boolean; loading?: boolean;
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when items change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [items, onLoadMore]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (onLoadMore) {
            if (hasMore && !loading) onLoadMore();
          } else setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, onLoadMore, hasMore, loading]);

  const visibleItems = useMemo(() => onLoadMore ? items : items.slice(0, visibleCount), [items, visibleCount, onLoadMore]);

  if (items.length === 0 && !hasMore) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg" role="status">{loading ? 'Searching…' : 'No content found'}</p>
      </div>
    );
  }

  return (
    <section>
      {title && <h2 className="text-xl font-display font-bold text-foreground mb-4">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {visibleItems.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
      {(onLoadMore ? hasMore || loading : visibleCount < items.length) && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center text-muted-foreground text-sm">
          {onLoadMore ? 'Loading more…' : `Loading more... (${visibleCount} of ${items.length})`}
        </div>
      )}
    </section>
  );
};

export default MediaGrid;
