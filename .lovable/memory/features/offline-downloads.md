---
name: Offline Downloads
description: Native-only VOD download via Capacitor Filesystem with progress tracking and SQLite metadata.
type: feature
---
- Native-only (Android). Web hides the Download button and the /downloads page shows an info card.
- Storage: Capacitor Filesystem `Directory.Data/downloads/{sanitizedTitle}_{shortId}.{ext}`.
- Streaming write: fetch ReadableStream → base64 chunk → writeFile (first chunk) + appendFile (subsequent), throttled progress every 250ms.
- Cancellation: AbortController + cancelled flag; partial files cleaned up on failure.
- Persistence: `downloads` SQLite table (media_id PK, title, poster, category, file_path, file_uri, size, mime, source_id, created_at).
- Playback: `/downloads` page passes `file_uri` (file://) to existing VideoPlayer.
- Hooked into MediaDetail (movies only — series episodes deferred).
