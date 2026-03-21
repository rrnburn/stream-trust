/**
 * Google Cast (Chromecast) sender helpers.
 *
 * Streams are sent via the proxied URL so the cast receiver fetches
 * through our edge-function proxy, which adds CORS headers and avoids
 * mixed-content / provider-IP issues.
 */
import { logger } from '@/lib/logger';

let castInitialized = false;
let castSession: chrome.cast.Session | null = null;

// Augment window for the Cast SDK callback
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

/** Load the Google Cast SDK script (idempotent). */
export function loadCastSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (castInitialized) { resolve(); return; }
    if (document.getElementById('cast-sdk')) {
      // Script tag exists but SDK might still be loading
      if (typeof chrome !== 'undefined' && chrome.cast) {
        castInitialized = true;
        resolve();
        return;
      }
    }

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        initCast();
        castInitialized = true;
      }
      resolve();
    };

    if (!document.getElementById('cast-sdk')) {
      const script = document.createElement('script');
      script.id = 'cast-sdk';
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

function initCast() {
  try {
    const context = cast.framework.CastContext.getInstance();
    context.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    logger.info('Cast', 'Cast SDK initialized');
  } catch (e: any) {
    logger.error('Cast', `Init failed: ${e?.message}`);
  }
}

/** Returns true when the Cast SDK is loaded and a cast-capable device is found. */
export function isCastAvailable(): boolean {
  try {
    if (typeof cast === 'undefined' || !cast.framework) return false;
    const ctx = cast.framework.CastContext.getInstance();
    const state = ctx.getCastState();
    return state !== cast.framework.CastState.NO_DEVICES_AVAILABLE;
  } catch {
    return false;
  }
}

/** Returns the current cast session (if connected). */
export function getCastSession(): chrome.cast.Session | null {
  return castSession;
}

/** Returns true if currently casting. */
export function isCasting(): boolean {
  try {
    const ctx = cast.framework.CastContext.getInstance();
    return ctx.getCastState() === cast.framework.CastState.CONNECTED;
  } catch {
    return false;
  }
}

/** Request the user to pick a cast device and start casting the given URL. */
export async function startCasting(
  streamUrl: string,
  title?: string,
  poster?: string,
): Promise<boolean> {
  try {
    await loadCastSDK();
    const ctx = cast.framework.CastContext.getInstance();
    await ctx.requestSession();

    const session = ctx.getCurrentSession();
    if (!session) {
      logger.warn('Cast', 'No session after requestSession');
      return false;
    }

    const mediaInfo = new chrome.cast.media.MediaInfo(streamUrl, 'video/*');
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = title || 'Video';
    if (poster) {
      mediaInfo.metadata.images = [new chrome.cast.Image(poster)];
    }

    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;

    await session.loadMedia(request);
    logger.info('Cast', `Now casting: ${title || streamUrl.substring(0, 80)}`);
    return true;
  } catch (e: any) {
    logger.error('Cast', `Cast failed: ${e?.message}`);
    return false;
  }
}

/** Stop the current cast session. */
export function stopCasting(): void {
  try {
    const ctx = cast.framework.CastContext.getInstance();
    ctx.endCurrentSession(true);
    logger.info('Cast', 'Cast session ended');
  } catch (e: any) {
    logger.warn('Cast', `Stop cast error: ${e?.message}`);
  }
}
