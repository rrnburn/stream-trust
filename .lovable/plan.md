

## Problem

`Browser.open({ url: 'vlc://...' })` does nothing because Capacitor's Browser plugin opens URLs in an in-app Chrome Custom Tab, which does not forward custom URI schemes (`vlc://`, `intent:`) to the Android intent resolver. The buttons look like they work (no error thrown) but no external app ever launches.

## Solution

Use `@capgo/capacitor-intent-launcher` to fire a proper Android `ACTION_VIEW` intent with the stream URL and `video/*` MIME type. This calls `startActivity()` at the native Android level, which is the reliable way to launch VLC or any video player.

From the VLC Android docs, the correct intent is:
- Action: `android.intent.action.VIEW`
- Package: `org.videolan.vlc` (for VLC specifically)
- Data: the stream URL
- Type: `video/*`
- Extras: `title` string

### Changes

**Install dependency**: `@capgo/capacitor-intent-launcher`

**`src/lib/nativePlayer.ts`** — Replace `Browser.open()` calls with proper Android intents:
- `playInVlc(url)` → `startActivityAsync` with ACTION_VIEW targeting `org.videolan.vlc` package, data=url, type=`video/*`
- `playInMxPlayer(url)` → `startActivityAsync` with ACTION_VIEW targeting `com.mxtech.videoplayer.ad` package
- `playInSystemChooser(url)` → `startActivityAsync` with ACTION_VIEW, type=`video/*`, no specific package (shows Android app picker)
- Wrap each in try/catch so if the target app isn't installed, show a toast error

**`src/components/VideoPlayer.tsx`** — Simplify the native player UI:
- Make VLC the primary large button (most common player)
- Keep MX Player and System Player as secondary options
- Keep Web Player fallback
- Add error handling with toast notifications when a player isn't installed

**Files to modify:**
- `package.json` (add `@capgo/capacitor-intent-launcher`)
- `src/lib/nativePlayer.ts`
- `src/components/VideoPlayer.tsx`

After building, the user must run `npx cap sync android` to register the new native plugin before building the APK.

