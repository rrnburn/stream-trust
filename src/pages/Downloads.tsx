import { useEffect, useState, useCallback } from 'react';
import { Trash2, Play, Download as DownloadIcon, HardDrive } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import VideoPlayer from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { isNativePlatform } from '@/lib/platform';
import { deleteDownloadedFile } from '@/lib/downloads';
import { toast } from 'sonner';
import type { DownloadRow } from '@/lib/localDb';

const formatBytes = (bytes: number): string => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

const Downloads = () => {
  const [items, setItems] = useState<DownloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<DownloadRow | null>(null);

  const native = isNativePlatform();

  const load = useCallback(async () => {
    if (!native) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { getDownloads } = await import('@/lib/localDb');
      const rows = await getDownloads();
      setItems(rows);
    } catch (e) {
      toast.error('Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, [native]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row: DownloadRow) => {
    try {
      await deleteDownloadedFile(row.file_path);
      const { removeDownload } = await import('@/lib/localDb');
      await removeDownload(row.media_id);
      setItems((prev) => prev.filter((r) => r.media_id !== row.media_id));
      if (playing?.media_id === row.media_id) setPlaying(null);
      toast.success(`Removed "${row.title}"`);
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Downloads</h1>
            <p className="text-sm text-muted-foreground">
              {native ? 'Watch offline anywhere on this device' : 'Downloads are only available in the mobile app'}
            </p>
          </div>
        </div>

        {!native && (
          <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-muted-foreground">
            <DownloadIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Open the Android app to download movies for offline playback.</p>
          </div>
        )}

        {native && playing && (
          <div className="mb-8">
            <VideoPlayer
              src={playing.file_uri}
              title={playing.title}
              poster={playing.poster}
              onClose={() => setPlaying(null)}
            />
          </div>
        )}

        {native && loading && <div className="text-muted-foreground text-sm">Loading…</div>}

        {native && !loading && items.length === 0 && (
          <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-muted-foreground">
            <DownloadIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No downloads yet. Open a movie and tap Download to save it for offline viewing.</p>
          </div>
        )}

        {native && items.length > 0 && (
          <div className="grid gap-3">
            {items.map((row) => (
              <div
                key={row.media_id}
                className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card/40 hover:bg-card/70 transition-colors"
              >
                <div className="w-16 h-24 rounded-lg overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                  {row.poster ? (
                    <img src={row.poster} alt={row.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-display font-bold text-muted-foreground/30">
                      {row.title.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{row.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="px-2 py-0.5 rounded bg-secondary uppercase">{row.category}</span>
                    <span>{formatBytes(row.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => setPlaying(row)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                    size="sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(row)}
                    className="border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    size="sm"
                    aria-label={`Delete ${row.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Downloads;
