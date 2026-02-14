import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Maximize, Minimize, Volume2, VolumeX, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  onProgress?: (progress: number) => void;
  onClose?: () => void;
}

const VideoPlayer = ({ src, title, poster, onProgress, onClose }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize HLS or native playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setBuffering(true);

    const isHls = src.includes('.m3u8') || src.includes('.m3u') || src.includes('type=m3u');

    if (Hls.isSupported()) {
      // Try HLS first for all streams - Xtream servers support .m3u8 output
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setBuffering(false);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('HLS error:', data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // If HLS fails, try direct playback as fallback
            console.log('HLS network error, trying direct playback...');
            hls.destroy();
            hlsRef.current = null;
            video.src = src;
            video.load();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setError('Playback error — stream may be unavailable');
            hls.destroy();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src;
    } else {
      // Direct playback fallback
      video.src = src;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && onProgress) {
        onProgress(video.currentTime / video.duration);
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => { setPlaying(true); setBuffering(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onError = () => setError('Failed to load stream');

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, [onProgress]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    }
  };

  const seek = (offset: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + offset, duration));
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'f') toggleFullscreen();
      else if (e.key === 'm') toggleMute();
      else if (e.key === 'ArrowLeft') seek(-10);
      else if (e.key === 'ArrowRight') seek(10);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, duration, playing]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
      />

      {/* Buffering spinner */}
      <AnimatePresence>
        {buffering && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none"
          >
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-4">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <p className="text-muted-foreground text-sm">The stream may require a valid subscription or may be geo-restricted.</p>
        </div>
      )}

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between"
          >
            {/* Top bar */}
            {title && (
              <div className="bg-gradient-to-b from-black/70 to-transparent p-4">
                <p className="text-white font-semibold text-sm truncate">{title}</p>
              </div>
            )}

            {/* Center play */}
            {!playing && !buffering && (
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors"
                >
                  <Play className="w-7 h-7 text-primary-foreground fill-primary-foreground ml-1" />
                </button>
              </div>
            )}

            {/* Bottom controls */}
            <div className="bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 space-y-2">
              {/* Progress bar */}
              {duration > 0 && (
                <div className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar" onClick={seekTo}>
                  <div
                    className="h-full bg-primary rounded-full relative transition-all"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlay} className="hover:text-primary transition-colors">
                    {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  <button onClick={() => seek(-10)} className="hover:text-primary transition-colors">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button onClick={() => seek(10)} className="hover:text-primary transition-colors">
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button onClick={toggleMute} className="hover:text-primary transition-colors">
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <span className="text-xs text-white/70 ml-2">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <button onClick={toggleFullscreen} className="hover:text-primary transition-colors">
                  {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoPlayer;
