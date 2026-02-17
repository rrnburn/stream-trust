import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
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
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [preBuffering, setPreBuffering] = useState(false);

  const getProxiedUrl = useCallback((streamUrl: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !streamUrl) return streamUrl;
    return `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
  }, []);

  const getPlaybackUrl = useCallback((streamUrl: string, proxy: boolean) => {
    return proxy ? getProxiedUrl(streamUrl) : streamUrl;
  }, [getProxiedUrl]);

  const getStreamType = (url: string): 'hls' | 'mpegts' | 'direct' => {
    const cleanUrl = url.split('?')[0]; // Strip query params for extension detection
    if (cleanUrl.includes('.m3u8') || cleanUrl.includes('.m3u')) return 'hls';
    if (cleanUrl.includes('.mp4') || cleanUrl.includes('.mkv') || cleanUrl.includes('.avi')) return 'direct';
    if (cleanUrl.includes('.ts') || !cleanUrl.match(/\.\w{2,4}$/)) return 'mpegts';
    return 'direct';
  };

  const isLiveStream = useCallback((url: string) => {
    return url.includes('/live/') || getStreamType(url) === 'mpegts';
  }, []);

  const cleanup = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch {}
      mpegtsRef.current = null;
    }
  }, []);

  // Initialize playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    cleanup();
    setError(null);
    setBuffering(true);
    setPreBuffering(false);

    const playbackUrl = getPlaybackUrl(src, useProxy);
    const streamType = getStreamType(src);
    const isLive = isLiveStream(src);

    console.log(`[Player] type=${streamType} proxy=${useProxy} live=${isLive} url=${src.substring(0, 80)}...`);

    let errorHandled = false;
    const handleFatalError = () => {
      if (errorHandled) return;
      errorHandled = true;
      if (!useProxy) {
        console.log('[Player] Direct playback failed, retrying via proxy...');
        cleanup();
        setUseProxy(true);
      } else {
        setError('Stream unavailable');
        setBuffering(false);
      }
    };

    // Pre-buffer for live streams: wait for sufficient buffer before playing
    const startWithPreBuffer = () => {
      if (!isLive) {
        video.play().catch(() => {});
        return;
      }
      setPreBuffering(true);
      const MIN_BUFFER = 2; // seconds
      const checkBuffer = () => {
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(0) - video.currentTime;
          if (buffered >= MIN_BUFFER) {
            console.log(`[Player] Pre-buffer ready: ${buffered.toFixed(1)}s`);
            setPreBuffering(false);
            video.play().catch(() => {});
            return;
          }
        }
        // Keep checking
        setTimeout(checkBuffer, 200);
      };
      checkBuffer();
    };

    if (streamType === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: isLive,
          xhrSetup: (xhr) => { xhr.withCredentials = false; },
        });
        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setBuffering(false);
          startWithPreBuffer();
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error('[Player] HLS fatal:', data.type, data.details);
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
              handleFatalError();
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playbackUrl;
        video.addEventListener('loadedmetadata', () => startWithPreBuffer(), { once: true });
      }
    } else if (streamType === 'mpegts' && mpegts.isSupported()) {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: playbackUrl,
      }, {
        enableWorker: true,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 5,
        liveBufferLatencyMinRemain: 1,
      });
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();

      // Pre-buffer: wait for canplay then check buffer before starting
      video.addEventListener('canplay', () => startWithPreBuffer(), { once: true });

      player.on(mpegts.Events.ERROR, (errorType: string, errorDetail: string) => {
        console.error('[Player] mpegts error:', errorType, errorDetail);
        handleFatalError();
      });
    } else {
      // Direct playback (mp4 etc) — try direct first, proxy fallback on error
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', () => {
        setBuffering(false);
        video.play().catch(() => {});
      }, { once: true });
      
      // Handle direct video errors - trigger proxy fallback
      const onVideoError = () => {
        console.error('[Player] Direct video error, code:', video.error?.code, video.error?.message);
        handleFatalError();
      };
      video.addEventListener('error', onVideoError, { once: true });
      
      // Timeout fallback - if nothing loads within 10s, try proxy
      const timeout = setTimeout(() => {
        if (video.readyState < 2 && !errorHandled) {
          console.log('[Player] Direct load timeout, trying proxy...');
          handleFatalError();
        }
      }, 10000);
      
      return () => {
        clearTimeout(timeout);
        video.removeEventListener('error', onVideoError);
        cleanup();
      };
    }

    return cleanup;
  }, [src, useProxy, getPlaybackUrl, cleanup, isLiveStream]);

  // Reset proxy state when src changes
  useEffect(() => {
    setUseProxy(false);
  }, [src]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration) && onProgress) {
        onProgress(video.currentTime / video.duration);
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => { setPlaying(true); setBuffering(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setPreBuffering(false); };
    const onCanPlay = () => setBuffering(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
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

      {/* Buffering / Pre-buffering spinner */}
      <AnimatePresence>
        {(buffering || preBuffering) && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none"
          >
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            {preBuffering && (
              <p className="text-white/70 text-sm mt-3">Buffering stream...</p>
            )}
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
            {title && (
              <div className="bg-gradient-to-b from-black/70 to-transparent p-4">
                <p className="text-white font-semibold text-sm truncate">{title}</p>
              </div>
            )}

            {!playing && !buffering && !preBuffering && (
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors"
                >
                  <Play className="w-7 h-7 text-primary-foreground fill-primary-foreground ml-1" />
                </button>
              </div>
            )}

            <div className="bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 space-y-2">
              {duration > 0 && isFinite(duration) && (
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
