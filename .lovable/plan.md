
## Live TV and VOD Sections

### Overview
Add a dedicated **Live TV** page for live channel streams and a **VOD** page for video-on-demand content. Both will integrate with the existing parsed media data and video player.

### Changes

#### 1. Edge Function -- Fetch VOD and Movies from Xtream
Currently the edge function only fetches `get_live_streams` for Xtream sources. It needs to also fetch `get_vod_streams` and `get_series` so that Movies/VOD content is actually populated.

- After fetching live streams, make two additional API calls:
  - `player_api.php?...&action=get_vod_streams` -- map these as category `movie`
  - `player_api.php?...&action=get_series` -- map these as category `series`
- Merge all three result sets into one `items` array before returning
- Construct VOD stream URLs as `http://server/movie/username/password/stream_id.ext`
- Construct series URLs as `http://server/series/username/password/stream_id.ext`

#### 2. New Page -- Live TV (`src/pages/LiveTV.tsx`)
- Filter `parsedMedia` to `category === 'channel'`
- Display channels in a grid layout (using `MediaGrid`)
- Clicking a channel opens an inline `VideoPlayer` directly on the page (no detail page needed for live TV -- instant playback)
- Group channels by their `group` field with collapsible sections or tabs

#### 3. New Page -- VOD (`src/pages/VOD.tsx`)  
- Filter `parsedMedia` to `category === 'vod'` or `category === 'movie'`
- Display in the standard `MediaGrid` linking to `MediaDetail` for playback

#### 4. Sidebar Navigation Update (`src/components/AppSidebar.tsx`)
- Add "Live TV" nav item with `Radio` icon pointing to `/live-tv`
- Add "VOD" nav item with `PlayCircle` icon pointing to `/vod`

#### 5. Routes (`src/App.tsx`)
- Add protected routes for `/live-tv` and `/vod`

#### 6. Home Page Update (`src/pages/Index.tsx`)
- Add a "Live TV" row showing up to 12 channels

### Technical Details

**Edge function changes** (`supabase/functions/parse-playlist/index.ts`):
- Three parallel fetches for Xtream: `get_live_streams`, `get_vod_streams`, `get_series`
- Different URL patterns per type: `/username/password/id` (live), `/movie/username/password/id.mp4` (VOD), `/series/username/password/id.mp4` (series)

**Live TV page** will feature:
- Inline video player that plays the selected channel immediately
- Channel list alongside the player (split layout on desktop, stacked on mobile)
- Active channel highlighting

**Files to create:**
- `src/pages/LiveTV.tsx`
- `src/pages/VOD.tsx`

**Files to modify:**
- `supabase/functions/parse-playlist/index.ts`
- `src/components/AppSidebar.tsx`
- `src/App.tsx`
- `src/pages/Index.tsx`
