import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';

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
    const available = latestNum > currentNum;

    logger.info('AppUpdater', `Current: ${currentNum}, Latest: ${latestNum}, Update available: ${available}`);

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

export async function downloadUpdate(apkUrl: string): Promise<void> {
  if (isNativePlatform()) {
    // On native Android, open the APK URL in the system browser to trigger download+install
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: apkUrl, windowName: '_system' });
  } else {
    // On web, open in new tab
    window.open(apkUrl, '_blank');
  }
}
