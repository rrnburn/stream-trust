

## Home Page: Show Watch History & Fix Favorite Labelling

### Changes

**1. `src/pages/Index.tsx`** — Replace current content grids with watch-history-based layout:
- Import `useAppContext` to access `watchHistory`
- Cross-reference `watchHistory` IDs with `parsedMedia` to get the actual MediaItem objects
- Group watched items by category: `channel` (Live TV), `movie` (Movies), `series` (Series)
- Show each group only if it has watched items; show nothing if history is empty (empty state with a message like "Start watching to see your history here")
- Remove the HeroBanner, trending, and static category grids
- Keep the "No content yet" empty state for when no sources are parsed

**2. `src/components/HeroBanner.tsx`** — Fix "My List" inconsistency:
- Change line 47 from `'My List'` to `'Favourite'` (and `'Remove'` to `'Unfavourite'`) to match the Heart icon used elsewhere in MediaCard and the Favorites page naming

### Technical Detail

In Index.tsx, the watch history lookup:
```
const { watchHistory } = useAppContext();
const watchedMedia = watchHistory
  .map(h => media.find(m => m.id === h.id))
  .filter(Boolean);
const watchedMovies = watchedMedia.filter(m => m.category === 'movie');
const watchedSeries = watchedMedia.filter(m => m.category === 'series');
const watchedChannels = watchedMedia.filter(m => m.category === 'channel');
```

Each group rendered with `<MediaGrid>` only if non-empty. If all groups are empty but media exists, show "Nothing watched yet" message.

