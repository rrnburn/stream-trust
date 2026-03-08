import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';
import { VideoPlayer } from '@capgo/capacitor-video-player';

const PLAYER_ID = 'streamvault';
const INIT_TIMEOUT_MS = 15000;

/** Whether native player failed and we should use web fallback */
let nativeUnavailable = false;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform() && !nativeUnavailable;
}

/**
 * Ensure the required <div id="fullscreen"> exists in the DOM.
 * The @capgo/capacitor-video-player plugin needs this element on Android.
 */
function ensureFullscreenDiv() {
  if (!document.getElementById('fullscreen')) {
    const div = document.createElement('div');
    div.id = 'fullscreen';
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100vw';
    div.style.height = '100vh';
    div.style.zIndex = '99999';
    div.style.display = 'none'; // plugin will show it
    document.body.appendChild(div);
    logger.info('NativePlayer', 'Created <div id="fullscreen"> for native player');
  }
}

/**
 * Launch the native ExoPlayer (Android) / AVPlayer (iOS) fullscreen.
 * Returns false if native player is unavailable (caller should use web player).
 */
export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isNativePlatform()) {
    logger.warn('NativePlayer', 'playNative called on non-native platform, ignoring');
    return false;
  }

  if (nativeUnavailable) {
    logger.info('NativePlayer', 'Native player previously failed, skipping (using web fallback)');
    return false;
  }

  logger.info('NativePlayer', `Playing: ${url.substring(0, 100)}`, { title });

  try {
    // Ensure the fullscreen container div exists (required by Android)
    ensureFullscreenDiv();

    // Log plugin availability
    logger.info('NativePlayer', `CapacitorVideoPlayer type: ${typeof CapacitorVideoPlayer}`);
    if (CapacitorVideoPlayer) {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(CapacitorVideoPlayer) || CapacitorVideoPlayer);
      logger.info('NativePlayer', `Plugin keys: [${methods.join(', ')}]`);
    }

    if (!CapacitorVideoPlayer || typeof CapacitorVideoPlayer.initPlayer !== 'function') {
      throw new Error('CapacitorVideoPlayer.initPlayer is not a function — plugin not registered');
    }

    const initOptions = {
      mode: 'fullscreen' as const,
      url,
      playerId: PLAYER_ID,
      componentTag: 'div',
      title: title || 'Video',
      showControls: true,
      exitOnEnd: true,
      loopOnEnd: false,
      pipEnabled: true,
      displayMode: 'landscape' as const,
    };

    logger.info('NativePlayer', 'Calling initPlayer...');
    logger.debug('NativePlayer', `Options: ${JSON.stringify(initOptions)}`);

    const result = await withTimeout(
      CapacitorVideoPlayer.initPlayer(initOptions),
      INIT_TIMEOUT_MS,
      'initPlayer'
    );

    logger.info('NativePlayer', `initPlayer result: ${JSON.stringify(result)}`);
    return true;
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error('NativePlayer', `Playback error: ${msg}`, { url: url.substring(0, 80) });

    if (msg.includes('timed out') || msg.includes('not a function') || msg.includes('not registered')) {
      nativeUnavailable = true;
      logger.warn('NativePlayer', 'Marking native player as unavailable — will use web player fallback');
    }

    return false;
  }
}

export async function stopNative(): Promise<void> {
  if (!isNativePlatform() || nativeUnavailable) return;
  try {
    await CapacitorVideoPlayer.stopAllPlayers();
  } catch {
    // ignore
  }
}
