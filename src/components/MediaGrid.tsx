import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import MediaCard from './MediaCard';
import { MediaItem } from '@/context/AppContext';

const PAGE_SIZE = 30;

const MediaGrid = ({ items, title }: { items: MediaItem[]; title?: string }) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when items change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [items]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, items.length));
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">No content found</p>
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
      {visibleCount < items.length && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center text-muted-foreground text-sm">
          Loading more... ({visibleCount} of {items.length})
        </div>
      )}
    </section>
  );
};

export default MediaGrid;
