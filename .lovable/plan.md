

## Add "Copy All Logs" Button to Debug Logs Page

**What**: Add a button next to the existing "Clear" button that copies all currently filtered log entries to the clipboard as formatted text.

**How**: In `src/pages/DebugLogs.tsx`, add a "Copy" button in the toolbar that:
1. Formats each visible (filtered) log entry as `[TIME] [LEVEL] [component] message`
2. Copies to clipboard via `navigator.clipboard.writeText()`
3. Shows a toast confirmation on success

Single file change — approximately 15 lines added to `src/pages/DebugLogs.tsx`.

