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
  onProgress?: (percent: number) => void
): Promise<void> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { IntentLauncher } = await import('@capgo/capacitor-intent-launcher');

    logger.info('AppUpdater', `Downloading APK: ${apkUrl}`);
    onProgress?.(0);

    const fileName = `update-${Date.now()}.apk`;

    // Download APK to cache
    const result = await Filesystem.downloadFile({
      url: apkUrl,
      path: fileName,
      directory: Directory.Cache,
      progress: true,
    });

    // Listen for progress if available — Capacitor fires events during download
    // Note: downloadFile with progress:true resolves after completion
    onProgress?.(100);

    const filePath = result.path || fileName;
    logger.info('AppUpdater', `APK downloaded to: ${filePath}`);

    // Get content:// URI via FileProvider
    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    logger.info('AppUpdater', `APK URI: ${uriResult.uri}`);

    // Launch Android package installer intent
    await IntentLauncher.startActivityAsync({
      action: 'android.intent.action.VIEW',
      data: uriResult.uri,
      type: 'application/vnd.android.package-archive',
      flags: 3, // FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (2)
    });

    logger.info('AppUpdater', 'Install intent launched');
  } catch (e: any) {
    logger.error('AppUpdater', `Download/install failed: ${e?.message}`);
    // Fallback: open in system browser
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: apkUrl, windowName: '_system' });
      toast.info('APK download started — tap the notification when complete to install');
    } catch {
      window.open(apkUrl, '_system');
      toast.info('APK download started — check your notifications to install');
    }
  }
}
