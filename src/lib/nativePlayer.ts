import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

const PLAYER_ID = 'streamvault';

/**
 * Dynamically import the plugin only on native platforms.
 */
async function getVideoPlayer() {
  const { VideoPlayer } = await import('@capgo/capacitor-video-player');
  return VideoPlayer;
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
    const VideoPlayer = await getVideoPlayer();
    const result = await VideoPlayer.initPlayer({
      mode: 'fullscreen',
      url,
      playerId: PLAYER_ID,
      componentTag: 'div',
      title: title || 'Video',
      showControls: true,
      exitOnEnd: true,
      loopOnEnd: false,
      pipEnabled: true,
      displayMode: 'landscape',
      accentColor: '#E5A535',
    });

    logger.info('NativePlayer', `initPlayer result: ${JSON.stringify(result)}`);
  } catch (err: any) {
    logger.error('NativePlayer', `Playback error: ${err?.message || err}`, { url: url.substring(0, 80) });
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
