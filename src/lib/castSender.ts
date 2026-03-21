/**
 * Google Cast (Chromecast) sender helpers.
 *
 * Streams are sent via the proxied URL so the cast receiver fetches
 * through our edge-function proxy, which adds CORS headers and avoids
 * mixed-content / provider-IP issues.
 */
import { logger } from '@/lib/logger';

/* eslint-disable @typescript-eslint/no-explicit-any */

let castInitialized = false;

// Access Cast SDK globals that are injected by the script tag
const getChrome = (): any => (window as any).chrome;
const getCast = (): any => (window as any).cast;

/** Load the Google Cast SDK script (idempotent). */
export function loadCastSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (castInitialized) { resolve(); return; }

    const chr = getChrome();
    if (chr?.cast) {
      initCast();
      castInitialized = true;
      resolve();
      return;
    }

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
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
    const c = getCast();
    const chr = getChrome();
    if (!c?.framework || !chr?.cast) return;
    const context = c.framework.CastContext.getInstance();
    context.setOptions({
      receiverApplicationId: chr.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chr.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    logger.info('Cast', 'Cast SDK initialized');
  } catch (e: any) {
    logger.error('Cast', `Init failed: ${e?.message}`);
  }
}

/** Returns true when the Cast SDK is loaded and a cast-capable device is found. */
export function isCastAvailable(): boolean {
  try {
    const c = getCast();
    if (!c?.framework) return false;
    const ctx = c.framework.CastContext.getInstance();
    const state = ctx.getCastState();
    return state !== c.framework.CastState.NO_DEVICES_AVAILABLE;
  } catch {
    return false;
  }
}

/** Returns true if currently casting. */
export function isCasting(): boolean {
  try {
    const c = getCast();
    if (!c?.framework) return false;
    const ctx = c.framework.CastContext.getInstance();
    return ctx.getCastState() === c.framework.CastState.CONNECTED;
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
    const c = getCast();
    const chr = getChrome();
    if (!c?.framework || !chr?.cast) {
      logger.warn('Cast', 'Cast SDK not available');
      return false;
    }

    const ctx = c.framework.CastContext.getInstance();
    await ctx.requestSession();

    const session = ctx.getCurrentSession();
    if (!session) {
      logger.warn('Cast', 'No session after requestSession');
      return false;
    }

    const mediaInfo = new chr.cast.media.MediaInfo(streamUrl, 'video/*');
    mediaInfo.metadata = new chr.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = title || 'Video';
    if (poster) {
      mediaInfo.metadata.images = [new chr.cast.Image(poster)];
    }

    const request = new chr.cast.media.LoadRequest(mediaInfo);
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
    const c = getCast();
    if (!c?.framework) return;
    const ctx = c.framework.CastContext.getInstance();
    ctx.endCurrentSession(true);
    logger.info('Cast', 'Cast session ended');
  } catch (e: any) {
    logger.warn('Cast', `Stop cast error: ${e?.message}`);
  }
}
