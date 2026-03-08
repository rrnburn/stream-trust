

## Add In-App Debug Log Viewer

Since Options 1 and 2 require a connected computer, an in-app log viewer would let you inspect logs directly on the phone.

### Implementation

1. **Create `src/lib/logger.ts`** — A singleton that captures log entries in a circular buffer (last 200 entries), intercepts `console.log/warn/error`, and stores structured entries with timestamp, level, component, and message.

2. **Create `src/pages/DebugLogs.tsx`** — A scrollable page showing all captured logs with color-coded levels (red for errors, yellow for warnings), a clear button, and auto-scroll to bottom. Accessible from settings or a hidden gesture.

3. **Add route `/debug`** — Protected route, accessible from the sidebar or by navigating directly.

4. **Instrument key components** — Add `logger.info/error` calls in `VideoPlayer`, `AppContext` (source parsing, favorites), and `playlistParser` so meaningful events are captured beyond raw console output.

5. **Add sidebar link** — A "Logs" entry in `AppSidebar.tsx` with a bug/terminal icon, possibly only visible on native builds.

### Files to create/edit
- Create `src/lib/logger.ts`
- Create `src/pages/DebugLogs.tsx`
- Edit `src/App.tsx` — add route
- Edit `src/components/AppSidebar.tsx` — add nav link
- Edit `src/components/VideoPlayer.tsx` — add log calls at key points
- Edit `src/context/AppContext.tsx` — add log calls for source/parse operations

