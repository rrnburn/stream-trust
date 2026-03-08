import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

/**
 * Launch an external video player (VLC, MX Player, system default) via Android Intent URI.
 * Falls back to window.open() if the Intent scheme doesn't work.
 */
export function isNativePlayerAvailable(): boolean {
  return isNativePlatform();
}

export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isNativePlatform()) return false;

  logger.info('NativePlayer', `Opening external player for: ${url.substring(0, 100)}`, { title });

  try {
    // Android Intent URI: launches ACTION_VIEW with video/* MIME type
    // This will open VLC, MX Player, or the system default video player
    const intentUri = `intent://${url}#Intent;action=android.intent.action.VIEW;type=video/*;S.title=${encodeURIComponent(title || 'Video')};end`;

    logger.info('NativePlayer', 'Firing Android Intent URI');
    window.location.href = intentUri;

    // Give the OS a moment to handle the intent
    await new Promise(resolve => setTimeout(resolve, 1500));

    // If we're still here, the intent may have been handled or not.
    // On Android, if no app handles it, the browser stays on the page.
    // Try a direct window.open as fallback
    return true;
  } catch (err: any) {
    logger.warn('NativePlayer', `Intent URI failed: ${err?.message}, trying window.open fallback`);

    try {
      window.open(url, '_system');
      return true;
    } catch (fallbackErr: any) {
      logger.error('NativePlayer', `All external player methods failed: ${fallbackErr?.message}`);
      return false;
    }
  }
}

// No-op: external players manage their own lifecycle
export async function stopNative(): Promise<void> {
  // Nothing to do — the external player is a separate app
}
