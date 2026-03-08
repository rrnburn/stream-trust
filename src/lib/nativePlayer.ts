import { Browser } from '@capacitor/browser';
import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform();
}

export async function playInVlc(url: string): Promise<void> {
  logger.info('NativePlayer', `Opening VLC for: ${url.substring(0, 120)}`);
  await Browser.open({ url: `vlc://${url}`, windowName: '_system' });
}

export async function playInMxPlayer(url: string, title?: string): Promise<void> {
  logger.info('NativePlayer', `Opening MX Player for: ${url.substring(0, 120)}`);
  const intentUri = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;S.title=${encodeURIComponent(title || 'Video')};end`;
  await Browser.open({ url: intentUri, windowName: '_system' });
}

export async function playInSystemChooser(url: string): Promise<void> {
  logger.info('NativePlayer', `Opening system chooser for: ${url.substring(0, 120)}`);
  await Browser.open({ url, windowName: '_system' });
}

// No-op: external players manage their own lifecycle
export async function stopNative(): Promise<void> {}
