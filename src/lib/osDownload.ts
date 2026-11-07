/** Hands downloads to Android's built-in DownloadManager (same service Chrome uses). */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DownloadProgress, DownloadResult } from '@/lib/downloads';

interface OsDownloadPlugin {
  enqueue(o: { url: string; title: string; fileName: string; userAgent: string }): Promise<{ id: string }>;
  query(o: { id: string }): Promise<{ status: string; loaded: number; total: number; reason: number; localUri: string; uri: string }>;
  remove(o: { id: string }): Promise<void>;
  scan(): Promise<{ files: { name: string; path: string; size: number }[] }>;
}

/** Lists video files already on the device (current + older app versions). */
export async function osScan() {
  if (!osDownloadAvailable()) return [];
  try {
    return (await OsDownload.scan()).files || [];
  } catch {
    return [];
  }
}

const OsDownload = registerPlugin<OsDownloadPlugin>('OsDownload');
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const ids = new Map<string, string>();

export const osDownloadAvailable = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('OsDownload');

export async function osDownload(
  mediaId: string,
  title: string,
  url: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadResult> {
  const ext = (url.split('?')[0].match(/\.(mp4|mkv|avi|mov|ts|m4v|webm)$/i)?.[1] || 'mp4').toLowerCase();
  const safe = title.replace(/[^\w\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 80);
  const fileName = `${safe}_${mediaId.replace(/\W/g, '').slice(-8)}.${ext}`;
  const { id } = await OsDownload.enqueue({ url, title, fileName, userAgent: CHROME_UA });
  ids.set(mediaId, id);
  try {
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      if (!ids.has(mediaId)) throw new Error('Download cancelled');
      const s = await OsDownload.query({ id });
      const total = s.total > 0 ? s.total : 0;
      onProgress?.({ loaded: s.loaded, total, percent: total ? Math.round((s.loaded / total) * 100) : 0 });
      if (s.status === 'done') {
        if (!s.loaded && !total) throw new Error('Downloaded file is empty');
        return {
          filePath: decodeURIComponent(s.localUri.replace(/^file:\/\//, '')),
          uri: s.localUri || s.uri,
          size: total || s.loaded,
          mime: ext === 'mkv' ? 'video/x-matroska' : 'video/mp4',
        };
      }
      if (s.status === 'failed') throw new Error(`Android download failed (code ${s.reason})`);
      if (s.status === 'missing') throw new Error('Download cancelled');
    }
  } finally {
    ids.delete(mediaId);
  }
}

export function osCancel(mediaId: string): boolean {
  const id = ids.get(mediaId);
  if (!id) return false;
  ids.delete(mediaId);
  OsDownload.remove({ id }).catch(() => {});
  return true;
}
