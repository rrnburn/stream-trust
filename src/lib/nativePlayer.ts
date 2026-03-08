import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

/**
 * Launch an external video player via Android Intent URI or app deep links.
 * Tries multiple strategies since Capacitor WebView handles intents differently.
 */
export function isNativePlayerAvailable(): boolean {
  return isNativePlatform();
}

export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isNativePlatform()) return false;

  logger.info('NativePlayer', `Opening external player for: ${url.substring(0, 120)}`, { title });

  // Strategy 1: Direct intent via window.location.href (most likely to work in Capacitor WebView)
  try {
    const intentUri = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;S.title=${encodeURIComponent(title || 'Video')};end`;
    logger.info('NativePlayer', `Trying window.location.href intent`);
    window.location.href = intentUri;
    
    // Wait briefly to see if it worked (page won't unload if it failed silently)
    await new Promise(resolve => setTimeout(resolve, 1500));
    logger.info('NativePlayer', 'Intent via location.href attempted');
    return true;
  } catch (err: any) {
    logger.warn('NativePlayer', `location.href intent failed: ${err?.message}`);
  }

  // Strategy 2: Try VLC deep link directly
  try {
    const vlcUri = `vlc://${url}`;
    logger.info('NativePlayer', `Trying VLC deep link: ${vlcUri.substring(0, 80)}`);
    window.location.href = vlcUri;
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  } catch (err: any) {
    logger.warn('NativePlayer', `VLC deep link failed: ${err?.message}`);
  }

  // Strategy 3: Try MX Player deep link
  try {
    const mxUri = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end`;
    logger.info('NativePlayer', `Trying MX Player intent`);
    window.location.href = mxUri;
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  } catch (err: any) {
    logger.warn('NativePlayer', `MX Player intent failed: ${err?.message}`);
  }

  // Strategy 4: window.open as last resort
  try {
    logger.info('NativePlayer', 'Trying window.open fallback');
    window.open(url, '_system');
    return true;
  } catch (err: any) {
    logger.error('NativePlayer', `All methods failed: ${err?.message}`);
    return false;
  }
}

// No-op: external players manage their own lifecycle
export async function stopNative(): Promise<void> {}
