

## Plan: Replace Capacitor Video Player with Android Intent

### Problem
The `@capgo/capacitor-video-player` plugin is unreliable — it crashes, hangs, or fails to register. 

### Solution
Use a **custom Capacitor plugin** that fires an Android `ACTION_VIEW` Intent to launch the device's default video player (VLC, MX Player, system default). This is the most reliable approach for native playback. The web/hls.js player remains as fallback.

### Implementation

**1. Create a custom Capacitor plugin (Edge Function not needed — this is pure client-side)**

Since we can't write native Android Java/Kotlin code directly in Lovable, we'll use Capacitor's `@capacitor/core` `registerPlugin` API combined with a **web fallback** that opens the URL in a new browser tab. The actual native Intent handling requires a small Android plugin class.

However, given Lovable's constraints (no native code editing), the practical approach is:

**Option A — Use `window.open()` + Android deep link pattern:**
- On native Android, calling `window.open(url)` or `window.location.href = "intent://..."` can trigger the OS to open a video player
- Use an Android Intent URI scheme: `intent://URL#Intent;type=video/*;end`

**2. Rewrite `src/lib/nativePlayer.ts`**
- Remove all `@capgo/capacitor-video-player` code
- Replace `playNative()` with a function that constructs an Android Intent URI and opens it via `window.open()`
- Format: `intent://{url}#Intent;action=android.intent.action.VIEW;type=video/*;end`
- Fallback: if Intent URI fails, try `window.open(url)` to let the OS handle it

**3. Update `src/components/VideoPlayer.tsx`**
- Remove `stopNative()` import (no longer needed — external player manages its own lifecycle)
- Simplify the native UI section — just show a "Play in External Player" button
- Keep the web hls.js player as automatic fallback when not on native

**4. Remove `@capgo/capacitor-video-player` dependency**
- Remove from `package.json`

**5. Files changed:**
- `src/lib/nativePlayer.ts` — complete rewrite (~40 lines)
- `src/components/VideoPlayer.tsx` — simplify native section, remove `stopNative`
- `package.json` — remove `@capgo/capacitor-video-player`

