import { useState } from 'react';
import { Plus, Trash2, Link, Server, RefreshCw, Download, Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { checkForUpdate, downloadUpdate, getCurrentBuild, type ReleaseInfo } from '@/lib/appUpdater';
import { toast } from 'sonner';

const Sources = () => {
  const { sources, addSource, removeSource, parsePlaylist, parsingPlaylist } = useAppContext();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'m3u' | 'xtream'>('m3u');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Update checker state
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
  const currentBuild = getCurrentBuild();

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdate();
      setUpdateAvailable(result.available);
      setLatestRelease(result.latest);
      if (!result.available) {
        toast.success("You're on the latest version");
      }
    } catch {
      toast.error('Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    if (latestRelease?.apkUrl) {
      setDownloading(true);
      setDownloadProgress(0);
      try {
        await downloadUpdate(latestRelease.apkUrl, (percent) => setDownloadProgress(percent));
      } catch {
        toast.error('Download failed');
      } finally {
        setDownloading(false);
      }
    } else {
      toast.error('No APK available for this release');
    }
  };

  const handleAdd = () => {
    if (!name || !url) return;
    addSource({ name, type, url, username: type === 'xtream' ? username : undefined, password: type === 'xtream' ? password : undefined });
    setName(''); setUrl(''); setUsername(''); setPassword('');
    setOpen(false);
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display font-bold text-foreground">IPTV Sources</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" /> Add Source
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display text-foreground">Add IPTV Source</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setType('m3u')}
                    className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      type === 'm3u' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Link className="w-4 h-4" /> M3U Playlist
                  </button>
                  <button
                    onClick={() => setType('xtream')}
                    className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      type === 'xtream' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Server className="w-4 h-4" /> Xtream API
                  </button>
                </div>

                <Input placeholder="Source name" value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border text-foreground" />
                <Input placeholder={type === 'm3u' ? 'M3U / M3U8 URL' : 'Server URL'} value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary border-border text-foreground" />

                {type === 'xtream' && (
                  <>
                    <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-secondary border-border text-foreground" />
                    <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary border-border text-foreground" />
                  </>
                )}

                <Button onClick={handleAdd} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Add Source
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <AnimatePresence mode="popLayout">
          {sources.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-10 text-center">
              <Server className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No sources configured</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Add an IPTV source to start streaming</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <motion.div
                  key={source.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      {source.type === 'm3u' ? <Link className="w-5 h-5 text-primary" /> : <Server className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{source.name}</p>
                      <p className="text-xs text-muted-foreground">{source.type.toUpperCase()} · Added {new Date(source.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => parsePlaylist(source)} disabled={parsingPlaylist} className="text-muted-foreground hover:text-primary">
                      <RefreshCw className={`w-4 h-4 ${parsingPlaylist ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeSource(source.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* App Update Section */}
        <div className="mt-10 pt-6 border-t border-border">
          <h2 className="text-lg font-display font-semibold text-foreground mb-1">App Update</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Current version: <span className="font-mono text-foreground">{currentBuild.version}</span>
            {currentBuild.date && <> · Built {new Date(currentBuild.date).toLocaleDateString()}</>}
          </p>

          {updateAvailable && latestRelease ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium text-foreground text-sm">{latestRelease.name}</p>
                <p className="text-xs text-muted-foreground">
                  {latestRelease.tagName} · {new Date(latestRelease.publishedAt).toLocaleDateString()}
                </p>
              </div>
              <Button onClick={handleDownload} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Download className="w-4 h-4" /> Download APK
              </Button>
            </motion.div>
          ) : (
            <Button
              variant="outline"
              onClick={handleCheckUpdate}
              disabled={checking}
              className="gap-2"
            >
              {checking ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Check for updates</>
              )}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Sources;
