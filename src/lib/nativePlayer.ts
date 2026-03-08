import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

const PLAYER_ID = 'streamvault';
const INIT_TIMEOUT_MS = 15000; // 15 seconds max wait for initPlayer

/**
 * Dynamically import the plugin only on native platforms.
 */
async function getVideoPlayer() {
  const mod = await import('@capgo/capacitor-video-player');
  // The package exports CapacitorVideoPlayer (not VideoPlayer)
  const plugin = (mod as any).CapacitorVideoPlayer || (mod as any).VideoPlayer || (mod as any).default;
  if (!plugin) {
    throw new Error('Could not resolve CapacitorVideoPlayer export from @capgo/capacitor-video-player');
  }
  return plugin;
}

/**
 * Wrap a promise with a timeout so it never hangs forever.
 */
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
 * Launch the native ExoPlayer (Android) / AVPlayer (iOS) fullscreen.
 */
export async function playNative(url: string, title?: string): Promise<void> {
  if (!isNativePlatform()) {
    logger.warn('NativePlayer', 'playNative called on non-native platform, ignoring');
    return;
  }

  logger.info('NativePlayer', `Playing: ${url.substring(0, 100)}`, { title });

  try {
    logger.info('NativePlayer', 'Loading VideoPlayer plugin...');
    const VideoPlayer = await getVideoPlayer();
    logger.info('NativePlayer', 'Plugin loaded, calling initPlayer...');

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

    logger.debug('NativePlayer', `initPlayer options: ${JSON.stringify(initOptions)}`);

    const result = await withTimeout(
      VideoPlayer.initPlayer(initOptions),
      INIT_TIMEOUT_MS,
      'initPlayer'
    );

    logger.info('NativePlayer', `initPlayer result: ${JSON.stringify(result)}`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error('NativePlayer', `Playback error: ${msg}`, { url: url.substring(0, 80) });
    throw err;
  }
}

export async function stopNative(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const VideoPlayer = await getVideoPlayer();
    await VideoPlayer.stopAllPlayers();
  } catch {
    // ignore
  }
}
