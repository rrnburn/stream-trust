import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';
import { Browser } from '@capacitor/browser';

/**
 * Launch an external video player (VLC, MX Player, system default) via Capacitor Browser plugin.
 * This opens the stream URL in the system browser / app chooser, which handles video/* content.
 */
export function isNativePlayerAvailable(): boolean {
  return isNativePlatform();
}

export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isNativePlatform()) return false;

  logger.info('NativePlayer', `Opening external player for: ${url.substring(0, 100)}`, { title });

  try {
    // Use Capacitor Browser to open the URL in the system browser / external app
    // On Android, if VLC or MX Player is installed and registered for .m3u8/.mp4,
    // the OS will show the app chooser or open directly in the preferred player.
    await Browser.open({ url, windowName: '_system' });
    logger.info('NativePlayer', 'Browser.open() succeeded — external player should launch');
    return true;
  } catch (err: any) {
    logger.warn('NativePlayer', `Browser.open failed: ${err?.message}, trying window.open fallback`);

    try {
      // Fallback: try window.open with _system target
      window.open(url, '_system');
      logger.info('NativePlayer', 'window.open(_system) fallback fired');
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
