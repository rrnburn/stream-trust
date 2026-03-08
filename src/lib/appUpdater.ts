import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// ⚠️ UPDATE THIS to match your GitHub repo (owner/repo)
const GITHUB_REPO = 'rrnburn/stream-trust';

const CURRENT_BUILD = import.meta.env.VITE_APP_BUILD_VERSION || 'dev';
const CURRENT_DATE = import.meta.env.VITE_APP_BUILD_DATE || '';

export interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  apkUrl: string | null;
  htmlUrl: string;
}

export function getCurrentBuild(): { version: string; date: string } {
  return { version: CURRENT_BUILD, date: CURRENT_DATE };
}

export async function checkForUpdate(): Promise<{
  available: boolean;
  current: string;
  latest: ReleaseInfo | null;
}> {
  try {
    logger.info('AppUpdater', `Checking for updates (current: ${CURRENT_BUILD})`);
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!res.ok) {
      logger.warn('AppUpdater', `GitHub API returned ${res.status}`);
      return { available: false, current: CURRENT_BUILD, latest: null };
    }

    const data = await res.json();
    const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));

    const latest: ReleaseInfo = {
      tagName: data.tag_name,
      name: data.name,
      publishedAt: data.published_at,
      apkUrl: apkAsset?.browser_download_url || null,
      htmlUrl: data.html_url,
    };

    // Compare build numbers: "build-42" vs "build-45"
    const currentNum = parseBuildNumber(CURRENT_BUILD);
    const latestNum = parseBuildNumber(latest.tagName);
    
    // If current build is unknown/dev, always offer update
    // If both parse to valid numbers, compare them
    const available = currentNum === 0 || latestNum > currentNum;

    logger.info('AppUpdater', `Current: "${CURRENT_BUILD}" (${currentNum}), Latest: "${latest.tagName}" (${latestNum}), Update available: ${available}`);

    return { available, current: CURRENT_BUILD, latest };
  } catch (e: any) {
    logger.error('AppUpdater', `Update check failed: ${e?.message}`);
    return { available: false, current: CURRENT_BUILD, latest: null };
  }
}

function parseBuildNumber(tag: string): number {
  const match = tag.match(/build-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function downloadUpdate(
  apkUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await downloadAndInstallApk(apkUrl, onProgress);
  } else {
    // On web, open in new tab
    window.open(apkUrl, '_blank');
  }
}

async function downloadAndInstallApk(
  apkUrl: string,
  _onProgress?: (percent: number) => void
): Promise<void> {
  try {
    logger.info('AppUpdater', `Opening APK for install: ${apkUrl}`);
    
    // Use Android's system browser / download manager which handles
    // APK download + install prompt natively (no FileProvider needed)
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: apkUrl, windowName: '_system' });
    
    toast.info('APK download started — tap the notification when complete to install');
    logger.info('AppUpdater', 'Opened APK URL in system browser');
  } catch (e: any) {
    logger.error('AppUpdater', `Browser open failed: ${e?.message}`);
    // Final fallback
    window.open(apkUrl, '_system');
    toast.info('APK download started — check your notifications to install');
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
