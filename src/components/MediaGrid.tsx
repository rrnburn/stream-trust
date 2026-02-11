import MediaCard from './MediaCard';
import { MediaItem } from '@/context/AppContext';

const MediaGrid = ({ items, title }: { items: MediaItem[]; title?: string }) => {
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
        {items.map((item, i) => (
          <MediaCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </section>
  );
};

export default MediaGrid;
