

## Fix Movie Playback on Native (Android)

### Root Cause

The current code sends the `.m3u8` version of movie URLs to VLC on Android (line 553-554). However, Xtream providers typically **do not serve HLS for VOD/movies** -- they only serve the `.mp4` file directly. VLC receives a non-existent `.m3u8` URL, fails silently, and the user sees no playback. When falling back to the web player, the provider rejects the request from a datacenter IP with an HTTP error.

Tivimate works because it sends the **original `.mp4` URL** directly from the device's residential IP.

### Plan

**1. Fix native player to use original `.mp4` URL for movies**

In `src/components/VideoPlayer.tsx`, change the native player section (lines 550-559):
- The main "Open in VLC" button should send the **original `.mp4` URL** (not `.m3u8`) for movies
- Keep the `.m3u8` variant as a secondary fallback button instead
- Same fix for MX Player and System Chooser defaults

**2. Reorder the fallback buttons**

For movies on native, the button layout should be:
- Primary: "Open in VLC" → sends original `.mp4`
- Secondary row: "VLC (HLS)" and "VLC (Direct/bare)" as alternatives
- MX Player / Other also default to `.mp4`

This matches what Tivimate does -- send the raw MP4 stream URL to an external player that handles it natively with the device's residential IP.

### Technical Detail

The change is isolated to the native player chooser UI in `VideoPlayer.tsx` (lines ~542-617). No changes to the web playback logic, stream proxy, or native player intents are needed.

