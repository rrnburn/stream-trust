

## Running the App Fully From Phone with Local Storage

### Feasibility Assessment

**Yes, it's possible** — but with important trade-offs to understand.

### What Currently Relies on the Cloud

1. **Authentication** — login/signup via cloud auth
2. **Database** — sources, favorites, watch history, parsed media all stored in cloud tables
3. **Playlist parsing** — edge function fetches and parses M3U/Xtream playlists server-side
4. **Stream proxy** — edge function proxies video streams to bypass CORS/geo-blocks

### What Would Change

| Feature | Current (Cloud) | Local Mode |
|---|---|---|
| Auth | Cloud auth | Remove or use a simple local PIN/skip |
| Sources, favorites, history | Cloud DB | SQLite via `@capacitor-community/sqlite` |
| Playlist parsing | Edge function | Move parsing logic into the app (client-side JS) |
| Stream proxy | Edge function | **Not needed** — native apps don't have CORS restrictions, so streams can be fetched directly |

### Key Benefit

The stream proxy becomes unnecessary on a native app. The phone can hit IPTV streams directly without CORS issues, and uses a residential IP (avoiding datacenter blocks). This alone should fix most playback failures.

### Implementation Plan

1. **Add SQLite plugin** — Install `@capacitor-community/sqlite` for local persistence on-device
2. **Create a local data layer** — Build a service that mirrors the current Supabase calls (sources, favorites, history, parsed_media) but reads/writes to SQLite
3. **Move playlist parsing client-side** — Port the M3U/Xtream parsing logic from the edge function into a TypeScript utility that runs in-app
4. **Direct stream URLs** — Skip the stream-proxy entirely; pass raw stream URLs to the video player
5. **Remove auth requirement** — Make auth optional or replace with a simple local-only flow (since there's no cloud to sync with)
6. **Dual-mode toggle (optional)** — Keep cloud mode for the web version, use local mode when running as a Capacitor app (detect via `Capacitor.isNativePlatform()`)

### Complexity

This is a significant refactor — roughly 3-5 sessions of work. The biggest wins (direct streaming without proxy, no datacenter IP blocking) could be achieved faster by just removing the proxy layer for native builds first.

### Recommended Approach

Start with the **quick win**: detect native platform and skip the stream proxy, playing streams directly. Then layer in SQLite for offline storage incrementally.

