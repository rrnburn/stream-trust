import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function ensureAndroid(): boolean {
  if (Capacitor.getPlatform() !== 'android') {
    toast.error('External players only work on Android');
    return false;
  }
  return true;
}

export async function playInVlc(url: string, title?: string): Promise<void> {
  if (!(await ensureAndroid())) return;
  logger.info('NativePlayer', `Opening VLC for: ${url.substring(0, 120)}`);
  try {
    const { IntentLauncher, ActivityAction } = await import('@capgo/capacitor-intent-launcher');
    const result = await IntentLauncher.startActivityAsync({
      action: ActivityAction.VIEW,
      data: url,
      type: 'video/*',
      packageName: 'org.videolan.vlc',
      extra: { title: title || 'Video' },
    });
    logger.info('NativePlayer', `VLC intent result: ${JSON.stringify(result)}`);
  } catch (e: any) {
    logger.error('NativePlayer', `VLC launch failed: ${e?.message} | ${JSON.stringify(e)}`);
    toast.error('Could not open VLC. Is it installed?');
  }
}

export async function playInMxPlayer(url: string, title?: string): Promise<void> {
  if (!(await ensureAndroid())) return;
  logger.info('NativePlayer', `Opening MX Player for: ${url.substring(0, 120)}`);
  try {
    const { IntentLauncher, ActivityAction } = await import('@capgo/capacitor-intent-launcher');
    const result = await IntentLauncher.startActivityAsync({
      action: ActivityAction.VIEW,
      data: url,
      type: 'video/*',
      packageName: 'com.mxtech.videoplayer.ad',
      extra: { title: title || 'Video' },
    });
    logger.info('NativePlayer', `MX Player intent result: ${JSON.stringify(result)}`);
  } catch (e: any) {
    logger.error('NativePlayer', `MX Player launch failed: ${e?.message} | ${JSON.stringify(e)}`);
    toast.error('Could not open MX Player. Is it installed?');
  }
}

export async function playInSystemChooser(url: string): Promise<void> {
  if (!(await ensureAndroid())) return;
  logger.info('NativePlayer', `Opening system chooser for: ${url.substring(0, 120)}`);
  try {
    const { IntentLauncher, ActivityAction } = await import('@capgo/capacitor-intent-launcher');
    const result = await IntentLauncher.startActivityAsync({
      action: ActivityAction.VIEW,
      data: url,
      type: 'video/*',
    });
    logger.info('NativePlayer', `System chooser result: ${JSON.stringify(result)}`);
  } catch (e: any) {
    logger.error('NativePlayer', `System chooser failed: ${e?.message} | ${JSON.stringify(e)}`);
    toast.error('Could not open video player.');
  }
}

// No-op: external players manage their own lifecycle
export async function stopNative(): Promise<void> {}
