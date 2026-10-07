import { useEffect, useState, useCallback } from 'react';
import { Download, X, Check, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativePlatform } from '@/lib/platform';
import { deleteDownloadedFile } from '@/lib/downloads';
import { startDownload, stopDownload, useActiveDownload, useCompletedVersion } from '@/lib/downloadStore';
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
  const active = useActiveDownload(mediaId);
  const version = useCompletedVersion();
  const busy = !!active;
  const progress = active?.progress;

  // Hide entirely on web — downloads are native-only
  const visible = isNativePlatform() && !!streamUrl;

  const refreshStatus = useCallback(async () => {
    if (!visible) return;
    const { getDownload } = await import('@/lib/localDb');
    const row = await getDownload(mediaId);
    setDownloaded(!!row);
  }, [mediaId, visible]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, version]);

  if (!visible) return null;

  const handleDownload = () => {
    if (busy) return;
    startDownload({ mediaId, title, poster, category, streamUrl, sourceId });
  };

  const handleCancel = () => stopDownload(mediaId);

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
