## Fix Movie URL Construction

### Problems Found

**1. Forced HTTPS on stream URLs**
In `src/lib/playlistParser.ts` line 76 (and `supabase/functions/parse-playlist/index.ts` line 84):

```js
const streamBase = base.replace(/^http:\/\//i, 'https://');
```

The API base is forced to HTTP, then stream URLs are forced to HTTPS. Many IPTV providers only serve streams over HTTP — HTTPS returns errors, redirects, or connection failures. This explains why ALL players fail with the same error: they're all hitting an HTTPS URL that the provider doesn't support.

**2. Hardcoded `.mp4` extension ignores `container_extension**`
The Xtream API returns a `container_extension` field per VOD item (e.g. `mkv`, `avi`, `ts`). The series parser already uses it (`ep.container_extension || 'mp4'`), but the VOD parser hardcodes `.mp4` on line 137. If a movie's actual container is `.mkv`, the URL is wrong.

### Plan

**File 1: `src/lib/playlistParser.ts**`

- Line 76: Use the original protocol from the user's source URL instead of forcing HTTPS. For native platforms (which don't need the proxy), keep the original protocol. For web, keep HTTPS to avoid mixed-content issues.
- Line 137: Use `s.container_extension || 'mp4'` instead of hardcoded `.mp4`

**File 2: `supabase/functions/parse-playlist/index.ts**`  

- Same two fixes: respect original protocol, use `container_extension`

**File 3: `src/components/VideoPlayer.tsx**`

- Update the movie detection logic (lines 203, 545-548) to not assume `.mp4` — check for `/movie/` path instead of `.mp4` extension

**File 4: `src/lib/nativePlayer.ts**`

- No changes needed — the URL itself was the problem, not the intent construction

### Why this fixes "all players fail"

Every player receives the same broken HTTPS URL. Fixing the URL protocol to match what the provider actually serves will fix playback across VLC, MX Player, system chooser, and the web player simultaneously.

&nbsp;

**DO NOT CHANGE HOW LIVE TV OR SERIES WORK!**