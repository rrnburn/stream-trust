import { CapacitorVideoPlayer } from '@capgo/capacitor-video-player';
import { logger } from '@/lib/logger';

const PLAYER_ID = 'streamvault';

/**
 * Launch the native ExoPlayer (Android) / AVPlayer (iOS) fullscreen.
 * Returns when the user exits the player.
 */
export async function playNative(url: string, title?: string): Promise<void> {
  logger.info('NativePlayer', `Playing: ${url.substring(0, 100)}`, { title });

  try {
    const result = await CapacitorVideoPlayer.initPlayer({
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
    });

    logger.info('NativePlayer', `initPlayer result: ${JSON.stringify(result)}`);
  } catch (err: any) {
    logger.error('NativePlayer', `Playback error: ${err?.message || err}`, { url: url.substring(0, 80) });
    throw err;
  }
}

export async function stopNative(): Promise<void> {
  try {
    await CapacitorVideoPlayer.stopAllPlayers();
  } catch {
    // ignore
  }
}
