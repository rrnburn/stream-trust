

## Fix APK Auto-Install After Download

### Problem
Currently `downloadAndInstallApk` opens the APK URL in the system browser via `@capacitor/browser`. The browser downloads the file but doesn't trigger Android's package installer — the user just sees a download page with no install prompt.

### Solution
Use `@capacitor/filesystem` to download the APK to the device cache, then use `@capgo/capacitor-intent-launcher` to fire an `ACTION_VIEW` intent with the correct MIME type (`application/vnd.android.package-archive`) pointing to the downloaded file via a `content://` URI from the FileProvider (already configured in the GitHub Actions workflow).

### Plan

**File: `src/lib/appUpdater.ts`** — rewrite `downloadAndInstallApk`:

1. Use `Filesystem.downloadFile()` to download the APK to the cache directory with progress reporting
2. Get the file's URI using `Filesystem.getUri()`
3. Launch an install intent via `IntentLauncher.startActivityAsync` with:
   - `action: 'android.intent.action.VIEW'`
   - `data: <file URI>`
   - `type: 'application/vnd.android.package-archive'`
   - `flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK`
4. Keep the `Browser.open` fallback if the download/intent approach fails
5. Report download progress via `onProgress` callback

**File: `src/pages/Sources.tsx`** — add download progress UI:
- Add a `downloadProgress` state to show a progress indicator while the APK downloads
- Pass it as the `onProgress` callback to `downloadUpdate`

