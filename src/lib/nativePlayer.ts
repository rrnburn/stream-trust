import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

const PLAYER_ID = 'streamvault';
const IMPORT_TIMEOUT_MS = 8000;
const INIT_TIMEOUT_MS = 15000;

let nativeUnavailable = false;
let cachedPlugin: any = null;

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

/**
 * Dynamically import the plugin with timeout. Cache the result.
 * The package exports { VideoPlayer } (not CapacitorVideoPlayer).
 */
async function getVideoPlayer() {
  if (cachedPlugin) return cachedPlugin;

  logger.info('NativePlayer', 'Dynamic importing @capgo/capacitor-video-player...');

  const mod = await withTimeout(
    import('@capgo/capacitor-video-player'),
    IMPORT_TIMEOUT_MS,
    'import @capgo/capacitor-video-player'
  );

  const keys = Object.keys(mod);
  logger.info('NativePlayer', `Module exports: [${keys.join(', ')}]`);

  // The ESM export is "VideoPlayer"
  const plugin = (mod as any).VideoPlayer || (mod as any).CapacitorVideoPlayer || (mod as any).default;
  if (!plugin) {
    throw new Error(`No plugin found in exports: [${keys.join(', ')}]`);
  }

  const methods = typeof plugin === 'object' ? Object.keys(plugin) : [];
  logger.info('NativePlayer', `Resolved plugin with keys: [${methods.join(', ')}]`);

  cachedPlugin = plugin;
  return plugin;
}

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform() && !nativeUnavailable;
}

/**
 * Ensure the required <div id="fullscreen"> exists in the DOM.
 * Android ExoPlayer needs this element for fullscreen mode.
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

export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }

  if (nativeUnavailable) {
    logger.info('NativePlayer', 'Native player unavailable, using web fallback');
    return false;
  }

  logger.info('NativePlayer', `Playing: ${url.substring(0, 100)}`, { title });

  try {
    ensureFullscreenDiv();

    const plugin = await getVideoPlayer();

    if (!plugin || typeof plugin.initPlayer !== 'function') {
      throw new Error('plugin.initPlayer is not a function — plugin not registered');
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

    const result = await withTimeout(
      plugin.initPlayer(initOptions),
      INIT_TIMEOUT_MS,
      'initPlayer'
    );

    logger.info('NativePlayer', `initPlayer result: ${JSON.stringify(result)}`);
    return true;
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error('NativePlayer', `Playback error: ${msg}`, { url: url.substring(0, 80) });

    if (msg.includes('timed out') || msg.includes('not a function') || msg.includes('not registered') || msg.includes('No plugin found')) {
      nativeUnavailable = true;
      logger.warn('NativePlayer', 'Marking native player as unavailable — web fallback active');
    }

    return false;
  }
}

export async function stopNative(): Promise<void> {
  if (!isNativePlatform() || nativeUnavailable || !cachedPlugin) return;
  try {
    await cachedPlugin.stopAllPlayers();
  } catch {
    // ignore
  }
}
