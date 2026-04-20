/**
 * Native download manager for VOD content.
 * Streams a remote URL into local app storage using Capacitor Filesystem,
 * with progress callbacks and pause/cancel support.
 *
 * Web is intentionally a no-op — downloads only work on native (Android).
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNativePlatform } from '@/lib/platform';
import { logger } from '@/lib/logger';

export interface DownloadProgress {
  loaded: number;      // bytes downloaded so far
  total: number;       // total bytes (0 if unknown)
  percent: number;     // 0–100
}

export interface ActiveDownload {
  mediaId: string;
  controller: AbortController;
  cancelled: boolean;
}

const active = new Map<string, ActiveDownload>();

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

const inferExtension = (url: string, contentType?: string | null): string => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  const m = cleanUrl.match(/\.(mp4|mkv|avi|mov|webm|ts|m4v)$/);
  if (m) return m[1];
  if (contentType?.includes('mp4')) return 'mp4';
  if (contentType?.includes('matroska')) return 'mkv';
  if (contentType?.includes('webm')) return 'webm';
  return 'mp4';
};

export interface DownloadResult {
  filePath: string;       // absolute path or relative ref usable with Filesystem
  uri: string;            // file:// URI for native playback
  size: number;           // total bytes written
  mime: string;
}

/**
 * Download a remote stream to local storage with progress callbacks.
 * Returns metadata for persistence; throws on failure or cancellation.
 */
export async function downloadStream(
  mediaId: string,
  title: string,
  url: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadResult> {
  if (!isNativePlatform()) {
    throw new Error('Downloads are only supported on the native app');
  }

  if (active.has(mediaId)) {
    throw new Error('Download already in progress for this item');
  }

  const controller = new AbortController();
  const handle: ActiveDownload = { mediaId, controller, cancelled: false };
  active.set(mediaId, handle);

  try {
    logger.info('Downloads', `Starting download: ${title}`, { mediaId, url: url.substring(0, 120) });

    let total = 0;
    let contentType: string | null = null;
    try {
      const headResponse = await fetch(url, { method: 'HEAD', signal: controller.signal });
      contentType = headResponse.headers.get('content-type');
      const contentLength = headResponse.headers.get('content-length');
      if (contentLength) total = parseInt(contentLength, 10);
    } catch (e) {
      logger.warn('Downloads', `HEAD request failed, proceeding without metadata`, { error: String(e) });
    }

    const ext = inferExtension(url, contentType);
    const fileName = `${sanitize(title)}_${mediaId.slice(0, 8)}.${ext}`;
    const relPath = `downloads/${fileName}`;

    // Ensure downloads directory exists. mkdir with recursive:true is idempotent;
    // we swallow the "already exists" error silently to avoid noisy native logs.
    try {
      await Filesystem.mkdir({
        path: 'downloads',
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('already exists')) {
        logger.warn('Downloads', `mkdir failed: ${msg}`);
      }
    }

    // Remove any prior partial file. Check via readdir (which doesn't log errors
    // when the file is absent) instead of stat, which spams the native console.
    try {
      const list = await Filesystem.readdir({ path: 'downloads', directory: Directory.Data });
      const exists = list.files.some(
        (f) => (typeof f === 'string' ? f : f.name) === fileName,
      );
      if (exists) {
        await Filesystem.deleteFile({ path: relPath, directory: Directory.Data });
      }
    } catch {
      // readdir failed (dir missing despite mkdir, or permissions) — ignore
    }

    let loaded = 0;
    const progressListener = await Filesystem.addListener('progress', (status) => {
      if (status.url !== url) return;
      loaded = status.bytes;
      total = status.contentLength || total;
      const totalBytes = total;
      const percent = totalBytes > 0 ? Math.round((status.bytes / totalBytes) * 100) : 0;
      onProgress?.({ loaded: status.bytes, total: totalBytes, percent });
    });

    try {
      await Filesystem.downloadFile({
        url,
        path: relPath,
        directory: Directory.Data,
        recursive: true,
        progress: true,
      });
    } finally {
      await progressListener.remove();
    }

    if (handle.cancelled) throw new Error('Download cancelled');

    // Final progress
    if (onProgress) {
      const percent = total > 0 ? Math.round((loaded / total) * 100) : 100;
      onProgress({ loaded, total: total || loaded, percent });
    }

    const stat = await Filesystem.getUri({ path: relPath, directory: Directory.Data });

    logger.info('Downloads', `Completed: ${title}`, { mediaId, bytes: loaded, path: stat.uri });

    return {
      filePath: relPath,
      uri: stat.uri,
      size: loaded,
      mime: contentType || `video/${ext}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Downloads', `Download failed: ${message}`, { mediaId, title });
    // Clean up partial file on failure
    try {
      const fileName = `${sanitize(title)}_${mediaId.slice(0, 8)}`;
      const list = await Filesystem.readdir({ path: 'downloads', directory: Directory.Data });
      const partial = list.files.find((f) => (typeof f === 'string' ? f : f.name).includes(fileName));
      if (partial) {
        const name = typeof partial === 'string' ? partial : partial.name;
        await Filesystem.deleteFile({ path: `downloads/${name}`, directory: Directory.Data });
      }
    } catch {
      // ignore cleanup errors
    }
    throw e;
  } finally {
    active.delete(mediaId);
  }
}

export function cancelDownload(mediaId: string) {
  const h = active.get(mediaId);
  if (h) {
    h.cancelled = true;
    h.controller.abort();
    logger.info('Downloads', `Cancelled download`, { mediaId });
  }
}

export function isDownloading(mediaId: string): boolean {
  return active.has(mediaId);
}

export async function deleteDownloadedFile(filePath: string): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Filesystem.deleteFile({ path: filePath, directory: Directory.Data });
  } catch (e) {
    logger.warn('Downloads', `Failed to delete file: ${filePath}`, { error: String(e) });
  }
}

export async function getDownloadUri(filePath: string): Promise<string> {
  const stat = await Filesystem.getUri({ path: filePath, directory: Directory.Data });
  return stat.uri;
}

// Encoding re-export so callers don't need a separate import
export { Encoding };
