import { ChevronDown, MonitorPlay, ExternalLink } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isNativePlayerAvailable, playInVlc, playInMxPlayer, playInSystemChooser } from '@/lib/nativePlayer';
import { cn } from '@/lib/utils';

interface Props {
  url: string;
  title?: string;
  onPlayInApp: () => void;
  onExternal?: () => void;
  className?: string;
  disabled?: boolean;
}

/** Small "▾" next to a Play button offering other players. In-app stays the default. */
const PlayerMenu = ({ url, title, onPlayInApp, onExternal, className, disabled }: Props) => {
  const ext = isNativePlayerAvailable();
  const go = (fn: () => Promise<void>) => { onExternal?.(); fn(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Choose player"
        onClick={(e) => e.stopPropagation()}
        className={cn('h-10 w-10 rounded-md bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/80 disabled:opacity-50', className)}
      >
        <ChevronDown className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Play with</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onPlayInApp}><MonitorPlay className="w-4 h-4 mr-2" /> In app (default)</DropdownMenuItem>
        <DropdownMenuSeparator />
        {ext ? (
          <>
            <DropdownMenuItem onSelect={() => go(() => playInVlc(url, title))}><ExternalLink className="w-4 h-4 mr-2" /> VLC</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go(() => playInMxPlayer(url, title))}><ExternalLink className="w-4 h-4 mr-2" /> MX Player</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go(() => playInSystemChooser(url))}><ExternalLink className="w-4 h-4 mr-2" /> Other player…</DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>External players need the Android app</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PlayerMenu;
