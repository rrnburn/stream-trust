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
  const toastId = toast.loading('Downloading update…');
  try {
    logger.info('AppUpdater', `Downloading APK from: ${apkUrl}`);

    // Download with progress tracking
    const response = await fetch(apkUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const chunks: BlobPart[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) {
        const pct = Math.round((received / contentLength) * 100);
        onProgress?.(pct);
        toast.loading(`Downloading update… ${pct}%`, { id: toastId });
      }
    }

    // Combine chunks into a single array
    const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Convert to base64 for Filesystem write
    const base64 = uint8ArrayToBase64(uint8);

    // Write to app cache directory
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const fileName = 'update.apk';

    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    logger.info('AppUpdater', 'APK saved to cache, getting URI…');

    // Get the file URI
    const fileInfo = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    logger.info('AppUpdater', `APK URI: ${fileInfo.uri}`);
    toast.loading('Installing update…', { id: toastId });

    // Launch install intent using FileProvider content URI
    const { IntentLauncher, ActivityAction } = await import('@capgo/capacitor-intent-launcher');

    await IntentLauncher.startActivityAsync({
      action: ActivityAction.VIEW,
      data: fileInfo.uri,
      type: 'application/vnd.android.package-archive',
      extra: {
        'android.intent.extra.NOT_UNKNOWN_SOURCE': true,
        'android.intent.extra.RETURN_RESULT': true,
      },
    });

    toast.success('Update initiated!', { id: toastId });
    logger.info('AppUpdater', 'Install intent launched successfully');
  } catch (e: any) {
    logger.error('AppUpdater', `Download/install failed: ${e?.message} | ${JSON.stringify(e)}`);
    toast.error('Update failed. Trying browser fallback…', { id: toastId });

    // Fallback: open in browser
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: apkUrl, windowName: '_system' });
    } catch {
      window.open(apkUrl, '_blank');
    }
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
