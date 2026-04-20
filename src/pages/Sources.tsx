import { useState } from 'react';
import { Plus, Trash2, Link, Server, RefreshCw, Loader2, BookOpen, Pencil } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { IPTVSource } from '@/context/AppContext.types';

// Shared form fields component - defined outside to prevent re-creation on every render
interface SourceFormProps {
  isEdit: boolean;
  name: string;
  url: string;
  username: string;
  password: string;
  epgUrl: string;
  type: 'm3u' | 'xtream';
  onNameChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onEpgUrlChange: (v: string) => void;
  onTypeChange?: (t: 'm3u' | 'xtream') => void;
  onSubmit: () => void;
}

const SourceForm = ({
  isEdit,
  name,
  url,
  username,
  password,
  epgUrl,
  type,
  onNameChange,
  onUrlChange,
  onUsernameChange,
  onPasswordChange,
  onEpgUrlChange,
  onTypeChange,
  onSubmit,
}: SourceFormProps) => {
  return (
    <div className="space-y-4 pt-2">
      {!isEdit && onTypeChange && (
        <div className="flex gap-2">
          <button
            onClick={() => onTypeChange('m3u')}
            className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              type === 'm3u' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link className="w-4 h-4" /> M3U Playlist
          </button>
          <button
            onClick={() => onTypeChange('xtream')}
            className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              type === 'xtream' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Server className="w-4 h-4" /> Xtream API
          </button>
        </div>
      )}

      <Input placeholder="Source name" value={name} onChange={(e) => onNameChange(e.target.value)} className="bg-secondary border-border text-foreground" />
      <Input placeholder={type === 'xtream' ? 'Server URL' : 'M3U / M3U8 URL'} value={url} onChange={(e) => onUrlChange(e.target.value)} className="bg-secondary border-border text-foreground" />

      {type === 'xtream' && (
        <>
          <Input placeholder="Username" value={username} onChange={(e) => onUsernameChange(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => onPasswordChange(e.target.value)} className="bg-secondary border-border text-foreground" />
        </>
      )}

      <Input placeholder="EPG URL (optional, XMLTV)" value={epgUrl} onChange={(e) => onEpgUrlChange(e.target.value)} className="bg-secondary border-border text-foreground" />

      <Button onClick={onSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {isEdit ? 'Save Changes' : 'Add Source'}
      </Button>
    </div>
  );
};

const Sources = () => {
  const { sources, addSource, updateSource, removeSource, parsePlaylist, parsingPlaylist, parseEpg, parsingEpg } = useAppContext();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'m3u' | 'xtream'>('m3u');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [epgUrl, setEpgUrl] = useState('');

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editSource, setEditSource] = useState<IPTVSource | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editEpgUrl, setEditEpgUrl] = useState('');

  const handleAdd = () => {
    if (!name || !url) return;
    addSource({ name, type, url, username: type === 'xtream' ? username : undefined, password: type === 'xtream' ? password : undefined, epg_url: epgUrl || undefined });
    setName(''); setUrl(''); setUsername(''); setPassword(''); setEpgUrl('');
    setOpen(false);
  };

  const openEdit = (source: IPTVSource) => {
    setEditSource(source);
    setEditName(source.name);
    setEditUrl(source.url);
    setEditUsername(source.username || '');
    setEditPassword(source.password || '');
    setEditEpgUrl(source.epg_url || '');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editSource || !editName || !editUrl) return;
    await updateSource(editSource.id, {
      name: editName,
      url: editUrl,
      username: editSource.type === 'xtream' ? editUsername : undefined,
      password: editSource.type === 'xtream' ? editPassword : undefined,
      epg_url: editEpgUrl || undefined,
    });
    toast.success('Source updated');
    setEditOpen(false);
    setEditSource(null);
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
              <SourceForm
                isEdit={false}
                name={name}
                url={url}
                username={username}
                password={password}
                epgUrl={epgUrl}
                type={type}
                onNameChange={setName}
                onUrlChange={setUrl}
                onUsernameChange={setUsername}
                onPasswordChange={setPassword}
                onEpgUrlChange={setEpgUrl}
                onTypeChange={setType}
                onSubmit={handleAdd}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-foreground">Edit Source</DialogTitle>
            </DialogHeader>
            <SourceForm
              isEdit={true}
              name={editName}
              url={editUrl}
              username={editUsername}
              password={editPassword}
              epgUrl={editEpgUrl}
              type={editSource?.type || 'm3u'}
              onNameChange={setEditName}
              onUrlChange={setEditUrl}
              onUsernameChange={setEditUsername}
              onPasswordChange={setEditPassword}
              onEpgUrlChange={setEditEpgUrl}
              onSubmit={handleEdit}
            />
          </DialogContent>
        </Dialog>

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
                    <Button variant="ghost" size="icon" onClick={() => openEdit(source)} className="text-muted-foreground hover:text-primary" title="Edit source">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => parsePlaylist(source)} disabled={parsingPlaylist} className="text-muted-foreground hover:text-primary" title="Refresh playlist">
                      <RefreshCw className={`w-4 h-4 ${parsingPlaylist ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => parseEpg(source)}
                      className="text-muted-foreground hover:text-primary"
                      title={source.epg_url ? "Download EPG" : "No EPG configured"}
                      disabled={parsingEpg}
                    >
                      <BookOpen className={`w-4 h-4 ${parsingEpg ? 'animate-spin' : ''}`} />
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

      </div>
    </AppLayout>
  );
};

export default Sources;
