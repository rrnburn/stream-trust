import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';
import { toast } from 'sonner';

let IntentLauncher: any = null;

async function getIntentLauncher() {
  if (!IntentLauncher) {
    const mod = await import('@capgo/capacitor-intent-launcher');
    IntentLauncher = mod.IntentLauncher;
  }
  return IntentLauncher;
}

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform();
}

export async function playInVlc(url: string, title?: string): Promise<void> {
  logger.info('NativePlayer', `Opening VLC for: ${url.substring(0, 120)}`);
  try {
    const launcher = await getIntentLauncher();
    await launcher.startActivityAsync({
      action: 'android.intent.action.VIEW',
      data: url,
      type: 'video/*',
      package: 'org.videolan.vlc',
      extras: {
        title: title || 'Video',
      },
    });
  } catch (e: any) {
    logger.error('NativePlayer', `VLC launch failed: ${e?.message}`);
    toast.error('Could not open VLC. Is it installed?');
  }
}

export async function playInMxPlayer(url: string, title?: string): Promise<void> {
  logger.info('NativePlayer', `Opening MX Player for: ${url.substring(0, 120)}`);
  try {
    const launcher = await getIntentLauncher();
    await launcher.startActivityAsync({
      action: 'android.intent.action.VIEW',
      data: url,
      type: 'video/*',
      package: 'com.mxtech.videoplayer.ad',
      extras: {
        title: title || 'Video',
      },
    });
  } catch (e: any) {
    logger.error('NativePlayer', `MX Player launch failed: ${e?.message}`);
    toast.error('Could not open MX Player. Is it installed?');
  }
}

export async function playInSystemChooser(url: string): Promise<void> {
  logger.info('NativePlayer', `Opening system chooser for: ${url.substring(0, 120)}`);
  try {
    const launcher = await getIntentLauncher();
    await launcher.startActivityAsync({
      action: 'android.intent.action.VIEW',
      data: url,
      type: 'video/*',
    });
  } catch (e: any) {
    logger.error('NativePlayer', `System chooser failed: ${e?.message}`);
    toast.error('Could not open video player.');
  }
}

// No-op: external players manage their own lifecycle
export async function stopNative(): Promise<void> {}
