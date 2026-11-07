/**
 * Central download tracker — survives page navigation so progress
 * can be shown on the Downloads page and any DownloadButton.
 */
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { downloadStream, cancelDownload, type DownloadProgress } from '@/lib/downloads';
import { osDownload, osCancel, osDownloadAvailable } from '@/lib/osDownload';

export interface ActiveItem {
  mediaId: string;
  title: string;
  poster: string;
  category: string;
  progress: DownloadProgress;
}

export interface StartMeta {
  mediaId: string;
  title: string;
  poster?: string;
  category: string;
  streamUrl: string;
  sourceId?: string;
}

let items: ActiveItem[] = [];
let completedVersion = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const update = (mediaId: string, progress: DownloadProgress) => {
  items = items.map((i) => (i.mediaId === mediaId ? { ...i, progress } : i));
  emit();
};
const remove = (mediaId: string) => {
  items = items.filter((i) => i.mediaId !== mediaId);
  emit();
};

export async function startDownload(m: StartMeta): Promise<boolean> {
  if (items.some((i) => i.mediaId === m.mediaId)) return false;
  items = [
    ...items,
    {
      mediaId: m.mediaId,
      title: m.title,
      poster: m.poster || '',
      category: m.category,
      progress: { loaded: 0, total: 0, percent: 0 },
    },
  ];
  emit();
  toast.info(`Downloading "${m.title}"…`);
  try {
    const onP = (p: DownloadProgress) => update(m.mediaId, p);
    const result = osDownloadAvailable()
      ? await osDownload(m.mediaId, m.title, m.streamUrl, onP)
      : await downloadStream(m.mediaId, m.title, m.streamUrl, onP);
    const { saveDownload } = await import('@/lib/localDb');
    await saveDownload({
      media_id: m.mediaId,
      title: m.title,
      poster: m.poster || '',
      category: m.category,
      file_path: result.filePath,
      file_uri: result.uri,
      size: result.size,
      mime: result.mime,
      source_id: m.sourceId || null,
    });
    completedVersion++;
    toast.success(`Downloaded "${m.title}"`);
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown';
    if (!message.toLowerCase().includes('cancel')) toast.error(`Download failed: ${message}`);
    return false;
  } finally {
    remove(m.mediaId);
  }
}

let scanning: Promise<number> | null = null;
/** Registers video files already on the device (e.g. from older app versions). Safe to call repeatedly. */
export function scanExistingDownloads(): Promise<number> {
  if (!scanning) scanning = doScan().finally(() => (scanning = null));
  return scanning;
}

async function doScan(): Promise<number> {
  const { osScan } = await import('@/lib/osDownload');
  const files = await osScan();
  if (!files.length) return 0;
  const { getDownloads, saveDownload } = await import('@/lib/localDb');
  const rows = await getDownloads();
  const known = new Set(rows.flatMap((r) => [r.file_path, r.file_path.split('/').pop()]));
  let added = 0;
  for (const f of files) {
    if (known.has(f.path) || known.has(f.name)) continue;
    known.add(f.name);
    const ext = (f.name.split('.').pop() || 'mp4').toLowerCase();
    const title = f.name.replace(/\.\w+$/, '').replace(/_[0-9a-f]{6,8}$/i, '').replace(/_+/g, ' ').trim();
    await saveDownload({
      media_id: `file:${f.name}`,
      title: title || f.name,
      poster: '',
      category: /S\d+\s?E\d+/i.test(title) ? 'series' : 'movie',
      file_path: f.path,
      file_uri: `file://${f.path}`,
      size: f.size,
      mime: ext === 'mkv' ? 'video/x-matroska' : `video/${ext}`,
      source_id: null,
    });
    added++;
  }
  if (added) {
    completedVersion++;
    emit();
  }
  return added;
}

export function stopDownload(mediaId: string) {
  if (!osCancel(mediaId)) cancelDownload(mediaId);
  toast.info('Cancelling download…');
}

const getItems = () => items;
const getVersion = () => completedVersion;

export const useActiveDownloads = () => useSyncExternalStore(subscribe, getItems, getItems);
export const useActiveDownload = (mediaId: string) =>
  useActiveDownloads().find((i) => i.mediaId === mediaId) || null;
/** Increments whenever a download completes — use to refresh lists. */
export const useCompletedVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);
