

## Problem

The `window.location.href = intentUri` approach silently fails inside Capacitor's WebView. The WebView intercepts the navigation and does nothing — it doesn't forward to Android's intent resolver. The logs say "success" but no player actually opens because the code always returns `true` after the 1.5s timeout regardless of whether anything happened.

## Solution

Replace the single "Open in external player" button with **separate buttons for specific players**, each using a different launch strategy:

1. **VLC** — Use `@capacitor/browser` with `Browser.open({ url: 'vlc://...', windowName: '_system' })`. VLC registers the `vlc://` scheme at the OS level, so the system browser hands it off correctly.
2. **MX Player** — Use `Browser.open` with an intent URI targeting MX Player's package name.
3. **Just Play (System)** — Use `Browser.open({ url: streamUrl, windowName: '_system' })` to open the raw URL in the system browser, which will then offer the Android "Open with" chooser if a video app is registered for the MIME type.
4. **Web Player fallback** — A button to dismiss native mode and use the built-in hls.js/HTML5 player instead.

### Changes

**`src/lib/nativePlayer.ts`** — Export individual launch functions instead of one `playNative` that tries everything sequentially:
- `playInVlc(url)` — `Browser.open({ url: 'vlc://' + url, windowName: '_system' })`
- `playInMxPlayer(url)` — `Browser.open` with MX Player intent URI
- `playInSystemChooser(url)` — `Browser.open({ url, windowName: '_system' })` (lets OS decide)
- Remove the sequential fallback logic and fake "success" returns

**`src/components/VideoPlayer.tsx`** — Replace the native UI section (lines 588-612):
- Show 3-4 buttons in a grid: "VLC", "MX Player", "System Player", "Use Web Player"
- Each button calls the corresponding function from `nativePlayer.ts`
- "Use Web Player" sets `nativeActive = false` to fall through to the hls.js player
- Keep poster image as background

**Files to modify:**
- `src/lib/nativePlayer.ts`
- `src/components/VideoPlayer.tsx`

