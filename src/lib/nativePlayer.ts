import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

/**
 * Launch an external video player (VLC, MX Player, system default) via Android Intent URI.
 * The intent:// scheme with type=video/* triggers the OS app chooser for video players.
 */
export function isNativePlayerAvailable(): boolean {
  return isNativePlatform();
}

export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isNativePlatform()) return false;

  logger.info('NativePlayer', `Opening external player for: ${url.substring(0, 120)}`, { title });

  try {
    // Construct an Android Intent URI that forces the OS to use a video/* handler
    // This bypasses Chrome and shows the app chooser with VLC, MX Player, etc.
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title || 'Video');
    
    // intent:// scheme with ACTION_VIEW + video/* MIME type
    const intentUri = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;S.title=${encodedTitle};end`;
    
    logger.info('NativePlayer', `Intent URI: ${intentUri.substring(0, 150)}`);
    
    // Create a hidden iframe to fire the intent without navigating away from the app
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = intentUri;
    document.body.appendChild(iframe);
    
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);

    logger.info('NativePlayer', 'Intent URI fired via iframe');
    return true;
  } catch (err: any) {
    logger.warn('NativePlayer', `Intent URI failed: ${err?.message}, trying window.location fallback`);

    try {
      // Fallback: direct navigation to intent URI
      const intentUri = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
      window.location.href = intentUri;
      logger.info('NativePlayer', 'window.location.href intent fallback fired');
      return true;
    } catch (fallbackErr: any) {
      logger.error('NativePlayer', `All methods failed: ${fallbackErr?.message}`);
      return false;
    }
  }
}

// No-op: external players manage their own lifecycle
export async function stopNative(): Promise<void> {}
