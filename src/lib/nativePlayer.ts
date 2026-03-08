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
 * The plugin needs this element on Android for fullscreen mode.
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
    div.style.display = 'none';
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
    ensureFullscreenDiv();

    logger.info('NativePlayer', `VideoPlayer type: ${typeof VideoPlayer}`);
    if (VideoPlayer) {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(VideoPlayer) || VideoPlayer);
      logger.info('NativePlayer', `Plugin keys: [${methods.join(', ')}]`);
    }

    if (!VideoPlayer || typeof VideoPlayer.initPlayer !== 'function') {
      throw new Error('VideoPlayer.initPlayer is not a function — plugin not registered');
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
      VideoPlayer.initPlayer(initOptions),
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
    await VideoPlayer.stopAllPlayers();
  } catch {
    // ignore
  }
}
