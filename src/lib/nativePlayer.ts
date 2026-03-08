import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

const PLAYER_ID = 'streamvault';
const IMPORT_TIMEOUT_MS = 8000;  // 8s max wait for dynamic import
const INIT_TIMEOUT_MS = 15000;   // 15s max wait for initPlayer

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
 * Dynamically import the plugin with a timeout so it never hangs.
 */
async function getVideoPlayer() {
  logger.debug('NativePlayer', 'Starting dynamic import of @capgo/capacitor-video-player...');

  const mod = await withTimeout(
    import('@capgo/capacitor-video-player'),
    IMPORT_TIMEOUT_MS,
    'dynamic import @capgo/capacitor-video-player'
  );

  // Log all exported keys so we can see what's actually there
  const exportedKeys = Object.keys(mod);
  logger.info('NativePlayer', `Module exports: [${exportedKeys.join(', ')}]`);

  const plugin = (mod as any).CapacitorVideoPlayer || (mod as any).VideoPlayer || (mod as any).default;
  if (!plugin) {
    throw new Error(`Could not resolve plugin. Available exports: [${exportedKeys.join(', ')}]`);
  }

  // Log available methods on the resolved plugin
  const methods = Object.keys(plugin).filter(k => typeof (plugin as any)[k] === 'function');
  logger.info('NativePlayer', `Plugin methods: [${methods.join(', ')}]`);

  return plugin;
}

/** Whether native player failed and we should use web fallback */
let nativeUnavailable = false;

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform() && !nativeUnavailable;
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
    logger.info('NativePlayer', 'Step 1/3: Loading VideoPlayer plugin...');
    const VideoPlayer = await getVideoPlayer();
    logger.info('NativePlayer', 'Step 2/3: Plugin loaded successfully');

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

    logger.info('NativePlayer', 'Step 3/3: Calling initPlayer...');
    logger.debug('NativePlayer', `initPlayer options: ${JSON.stringify(initOptions)}`);

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

    // If the import or init timed out, mark native as unavailable for this session
    if (msg.includes('timed out') || msg.includes('Could not resolve')) {
      nativeUnavailable = true;
      logger.warn('NativePlayer', 'Marking native player as unavailable — will use web player fallback');
    }

    return false;
  }
}

export async function stopNative(): Promise<void> {
  if (!isNativePlatform() || nativeUnavailable) return;
  try {
    const VideoPlayer = await getVideoPlayer();
    await VideoPlayer.stopAllPlayers();
  } catch {
    // ignore
  }
}
