import { useEffect, useState, useCallback } from 'react';
import { Download, X, Check, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativePlatform } from '@/lib/platform';
import {
  downloadStream,
  cancelDownload,
  isDownloading,
  deleteDownloadedFile,
  type DownloadProgress,
} from '@/lib/downloads';
import { toast } from 'sonner';

interface Props {
  mediaId: string;
  title: string;
  poster?: string;
  category: string;
  streamUrl: string;
  sourceId?: string;
}

const DownloadButton = ({ mediaId, title, poster, category, streamUrl, sourceId }: Props) => {
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [busy, setBusy] = useState(false);

  // Hide entirely on web — downloads are native-only
  const visible = isNativePlatform() && !!streamUrl;

  const refreshStatus = useCallback(async () => {
    if (!visible) return;
    const { getDownload } = await import('@/lib/localDb');
    const row = await getDownload(mediaId);
    setDownloaded(!!row);
    setBusy(isDownloading(mediaId));
  }, [mediaId, visible]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  if (!visible) return null;

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setProgress({ loaded: 0, total: 0, percent: 0 });
    try {
      toast.info(`Downloading "${title}"…`);
      const result = await downloadStream(mediaId, title, streamUrl, (p) => setProgress(p));
      const { saveDownload } = await import('@/lib/localDb');
      await saveDownload({
        media_id: mediaId,
        title,
        poster: poster || '',
        category,
        file_path: result.filePath,
        file_uri: result.uri,
        size: result.size,
        mime: result.mime,
        source_id: sourceId || null,
      });
      setDownloaded(true);
      toast.success(`Downloaded "${title}"`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown';
      if (!message.toLowerCase().includes('cancel')) {
        toast.error(`Download failed: ${message}`);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleCancel = () => {
    cancelDownload(mediaId);
    toast.info('Cancelling download…');
  };

  const handleDelete = async () => {
    const { getDownload, removeDownload } = await import('@/lib/localDb');
    const row = await getDownload(mediaId);
    if (row) {
      await deleteDownloadedFile(row.file_path);
      await removeDownload(mediaId);
    }
    setDownloaded(false);
    toast.success('Removed from device');
  };

  if (busy && progress) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled className="border-border gap-2 min-w-[140px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          {progress.percent > 0 ? `${progress.percent}%` : 'Starting…'}
        </Button>
        <Button
          variant="outline"
          onClick={handleCancel}
          className="border-border text-destructive hover:bg-destructive/10"
          aria-label="Cancel download"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (downloaded) {
    return (
      <Button
        variant="outline"
        onClick={handleDelete}
        className="border-primary/40 bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 gap-2"
      >
        <Check className="w-4 h-4" />
        Downloaded
        <Trash2 className="w-3.5 h-3.5 ml-1 opacity-70" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      className="border-border text-foreground hover:bg-secondary gap-2"
    >
      <Download className="w-4 h-4" />
      Download
    </Button>
  );
};

export default DownloadButton;
