import { isNativePlatform } from '@/lib/platform';

/**
 * Configure the native status bar so the WebView does not draw underneath it.
 * Combined with CSS env(safe-area-inset-*) this prevents content overlap on Android.
 */
export async function initStatusBar(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Don't let the WebView render behind the status bar
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f1318' });
  } catch (e) {
    // Plugin not available (web preview) — safe to ignore
  }
}
