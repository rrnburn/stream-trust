import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { Play, Pause, Maximize, Minimize, Volume2, VolumeX, SkipBack, SkipForward, Loader2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { isNativePlatform } from '@/lib/platform';
import { logger } from '@/lib/logger';
import { playInVlc, playInMxPlayer, playInSystemChooser, stopNative } from '@/lib/nativePlayer';

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  onProgress?: (progress: number) => void;
  onClose?: () => void;
}

// Buffer logs and send in batches to avoid spamming the backend
const logBuffer: Array<{ level: string; component: string; message: string; meta?: Record<string, unknown> }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flushLogs = () => {
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0, logBuffer.length);
  supabase.functions.invoke('log-event', { body: batch }).catch(() => {});
};

const log = (level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR', msg: string, meta?: Record<string, unknown>) => {
  const ts = new Date().toISOString();
  const formatted = `[${ts}] [Player] [${level}] ${msg}`;
  // Feed in-app logger
  const lvl = level.toLowerCase() as 'info' | 'debug' | 'warn' | 'error';
  logger[lvl]('Player', msg, meta);

  // Queue for backend
  logBuffer.push({ level, component: 'Player', message: msg, meta });
  if (flushTimer) clearTimeout(flushTimer);
  // Flush immediately on errors, batch others every 2s
  if (level === 'ERROR') {
    flushLogs();
  } else {
    flushTimer = setTimeout(flushLogs, 2000);
  }
};

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
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [hlsFallback, setHlsFallback] = useState(false);
  
  const MAX_RETRIES = 3;
  const isNative = isNativePlatform();

  const getProxiedUrl = useCallback((streamUrl: string) => {
    // Native apps don't need the proxy — direct playback with residential IP
    if (isNativePlatform()) return streamUrl;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !streamUrl) return streamUrl;
    return `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
  }, []);

  const getPlaybackUrl = useCallback((streamUrl: string, proxy: boolean) => {
    // On native, never proxy
    if (isNativePlatform()) return streamUrl;
    return proxy ? getProxiedUrl(streamUrl) : streamUrl;
  }, [getProxiedUrl]);

  // Normalize stream URLs: convert .ts to .m3u8 for live streams.
  // For movies, try .mp4 first; if hlsFallback is set, convert to .m3u8.
  const normalizeStreamUrl = useCallback((url: string): string => {
    // Live TV: .ts → .m3u8
    if (url.includes('/live/') && url.endsWith('.ts')) {
      const hlsUrl = url.replace(/\.ts$/, '.m3u8');
      log('INFO', `Converted live .ts → .m3u8: ${hlsUrl.substring(0, 80)}...`);
      return hlsUrl;
    }
    // Movie HLS fallback: .mp4 → .m3u8 when direct MP4 failed
    if (hlsFallback && url.includes('/movie/') && url.endsWith('.mp4')) {
      const hlsUrl = url.replace(/\.mp4$/, '.m3u8');
      log('INFO', `HLS fallback: movie .mp4 → .m3u8: ${hlsUrl.substring(0, 80)}...`);
      return hlsUrl;
    }
    return url;
  }, [hlsFallback]);

  const getStreamType = (url: string): 'hls' | 'mpegts' | 'direct' => {
    const cleanUrl = url.split('?')[0];
    if (cleanUrl.includes('.m3u8') || cleanUrl.includes('.m3u')) return 'hls';
    if (cleanUrl.includes('.mp4') || cleanUrl.includes('.mkv') || cleanUrl.includes('.avi')) return 'direct';
    if (cleanUrl.includes('.ts') || !cleanUrl.match(/\.\w{2,4}$/)) return 'mpegts';
    return 'direct';
  };

  const isLiveStream = useCallback((url: string) => {
    return url.includes('/live/') || getStreamType(url) === 'mpegts';
  }, []);

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      log('DEBUG', 'Destroying HLS instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        log('DEBUG', 'Destroying mpegts instance');
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch (e) {
        log('WARN', 'mpegts cleanup error', e);
      }
      mpegtsRef.current = null;
    }
  }, []);

  const initHlsJs = useCallback((video: HTMLVideoElement, url: string, isLive: boolean, onReady: () => void, onFatal: (reason: string) => void) => {
    if (Hls.isSupported()) {
      log('INFO', 'Initializing hls.js player');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        xhrSetup: (xhr) => { xhr.withCredentials = false; },
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        log('INFO', `HLS manifest parsed: ${data.levels.length} quality levels`);
        setBuffering(false);
        onReady();
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          log('ERROR', `HLS fatal error: type=${data.type} details=${data.details}`, { status: data.response?.code });
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            log('INFO', 'Attempting HLS media error recovery');
            hls.recoverMediaError();
          } else {
            hls.destroy();
            onFatal(`HLS ${data.type}: ${data.details}`);
          }
        } else {
          log('WARN', `HLS non-fatal: ${data.type} ${data.details}`);
        }
      });
    } else {
      log('ERROR', 'HLS not supported in this browser');
      onFatal('HLS playback not supported');
      setBuffering(false);
    }
  }, []);

  // Track whether native player chooser is active
  const [nativeActive, setNativeActive] = useState(isNative);

  // Initialize web playback (skip if native player is active)
  useEffect(() => {
    if (isNative && nativeActive) return;
    const video = videoRef.current;
    if (!video || !src) return;

    cleanup();
    setError(null);
    setBuffering(true);
    setPreBuffering(false);

    const normalizedSrc = normalizeStreamUrl(src);
    const playbackUrl = getPlaybackUrl(normalizedSrc, useProxy);
    const streamType = getStreamType(normalizedSrc);
    const isLive = isLiveStream(normalizedSrc);

    log('INFO', `Media selected: Title="${title}" Type=${streamType} Live=${isLive} Proxy=${useProxy}`);
    log('DEBUG', `Stream URL: ${normalizedSrc.substring(0, 120)}`);
    log('DEBUG', `Playback URL: ${playbackUrl.substring(0, 120)}`);

    let errorHandled = false;
    const isMovieMp4 = src.includes('/movie/') && src.endsWith('.mp4');
    const handleFatalError = (reason: string) => {
      if (errorHandled) return;
      errorHandled = true;
      // On native: if movie .mp4 failed and we haven't tried HLS yet, try .m3u8
      if (isMovieMp4 && !hlsFallback && isNativePlatform()) {
        log('WARN', `Movie MP4 failed (${reason}), trying HLS .m3u8 fallback...`);
        cleanup();
        setHlsFallback(true);
        return;
      }
      if (!useProxy && !isNativePlatform()) {
        log('WARN', `Direct playback failed (${reason}), retrying via proxy...`, { title, src: normalizedSrc.substring(0, 80) });
        cleanup();
        setUseProxy(true);
      } else {
        log('ERROR', `Playback failed: ${reason} | Title="${title}" retryCount=${retryCount}`);
        setError(reason);
        setBuffering(false);
      }
    };

    // Helper: try to play with sound, fall back to muted if autoplay blocked
    const tryPlay = (video: HTMLVideoElement) => {
      video.muted = false;
      video.play().then(() => {
        log('INFO', 'Playback started with sound');
        setAutoplayMuted(false);
        setMuted(false);
      }).catch(() => {
        log('WARN', 'Autoplay blocked, retrying muted');
        video.muted = true;
        setMuted(true);
        setAutoplayMuted(true);
        video.play().catch((e) => log('ERROR', 'Even muted autoplay failed', { msg: e?.message }));
      });
    };

    // Pre-buffer for live streams
    const startWithPreBuffer = () => {
      if (!isLive) {
        log('INFO', 'VOD stream ready, starting playback');
        tryPlay(video);
        return;
      }
      setPreBuffering(true);
      const MIN_BUFFER = 2;
      const checkBuffer = () => {
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(0) - video.currentTime;
          if (buffered >= MIN_BUFFER) {
            log('INFO', `Pre-buffer ready: ${buffered.toFixed(1)}s buffered`);
            setPreBuffering(false);
            tryPlay(video);
            return;
          }
        }
        setTimeout(checkBuffer, 200);
      };
      checkBuffer();
    };

    if (streamType === 'hls') {
      log('INFO', 'Initializing HLS playback');
      
      // Strategy 1: Try native video.src (bypasses CORS — works on Safari, some mobile browsers)
      // Strategy 2: Try hls.js (uses XHR, subject to CORS)  
      // Strategy 3: Fall back to proxy
      
      const tryNativeFirst = !useProxy;
      
      if (tryNativeFirst) {
        log('INFO', 'Trying native video.src for HLS (CORS bypass)');
        video.src = playbackUrl;
        
        let nativeWorked = false;
        const nativeTimeout = setTimeout(() => {
          if (!nativeWorked) {
            log('WARN', 'Native HLS timed out after 8s, trying hls.js');
            video.removeAttribute('src');
            video.load();
            initHlsJs(video, playbackUrl, isLive, startWithPreBuffer, handleFatalError);
          }
        }, 8000);
        
        const onNativeCanPlay = () => {
          nativeWorked = true;
          clearTimeout(nativeTimeout);
          log('INFO', 'Native HLS playback working');
          setBuffering(false);
          startWithPreBuffer();
        };
        
        const onNativeError = () => {
          if (nativeWorked) return;
          clearTimeout(nativeTimeout);
          log('WARN', 'Native HLS failed, trying hls.js');
          video.removeAttribute('src');
          video.load();
          initHlsJs(video, playbackUrl, isLive, startWithPreBuffer, handleFatalError);
        };
        
        video.addEventListener('canplay', onNativeCanPlay, { once: true });
        video.addEventListener('error', onNativeError, { once: true });
        video.addEventListener('loadedmetadata', () => {
          log('INFO', 'Native HLS metadata loaded');
        }, { once: true });
      } else {
        // Using proxy URL — go straight to hls.js
        initHlsJs(video, playbackUrl, isLive, startWithPreBuffer, handleFatalError);
      }
    } else if (streamType === 'mpegts' && mpegts.isSupported()) {
      log('INFO', 'Initializing mpegts.js player');
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

      video.addEventListener('canplay', () => startWithPreBuffer(), { once: true });

      player.on(mpegts.Events.ERROR, (errorType: string, errorDetail: string) => {
        log('ERROR', `mpegts error: type=${errorType} detail=${errorDetail}`);
        handleFatalError(`mpegts ${errorType}: ${errorDetail}`);
      });
    } else {
      log('INFO', 'Using direct HTML5 video playback');

      // Simple 2-stage approach: direct → proxy (fast fail)
      let resolved = false;

      const playUrl = (url: string, label: string, onFail: () => void) => {
        log('INFO', `${label}: ${url.substring(0, 100)}`);
        video.removeAttribute('src');
        video.load();

        const onMeta = () => {
          if (resolved) return;
          resolved = true;
          video.removeEventListener('error', onErr);
          clearTimeout(loadTimeout);
          log('INFO', `${label} success: metadata loaded`);
          setBuffering(false);
          tryPlay(video);
        };

        const onErr = () => {
          if (resolved) return;
          video.removeEventListener('loadedmetadata', onMeta);
          clearTimeout(loadTimeout);
          const code = video.error?.code;
          const msg = video.error?.message || 'Unknown';
          log('WARN', `${label} failed: code=${code} msg=${msg}`);
          onFail();
        };

        // Fast timeout - don't make users wait
        const loadTimeout = setTimeout(() => {
          if (resolved) return;
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onErr);
          log('WARN', `${label} timed out (8s)`);
          onFail();
        }, 8000);

        video.addEventListener('loadedmetadata', onMeta, { once: true });
        video.addEventListener('error', onErr, { once: true });
        video.src = url;
      };

      if (useProxy) {
        playUrl(playbackUrl, 'Proxy MP4', () => {
          // If proxy MP4 failed and it's a movie, try HLS fallback
          if (isMovieMp4 && !hlsFallback) {
            log('WARN', `Proxy MP4 failed, trying HLS .m3u8 fallback...`);
            cleanup();
            setHlsFallback(true);
            return;
          }
          log('ERROR', `Proxy playback failed | Title="${title}"`);
          setError('This stream is currently unavailable. The provider may be blocking playback from web browsers.');
          setBuffering(false);
        });
      } else {
        playUrl(playbackUrl, 'Direct MP4', () => {
          handleFatalError('Direct playback failed');
        });
      }

      return () => {
        resolved = true;
        cleanup();
      };
    }

    return cleanup;
  }, [src, useProxy, hlsFallback, retryCount, getPlaybackUrl, cleanup, isLiveStream, normalizeStreamUrl, title, isNative, nativeActive]);

  // Reset proxy and retry state when src changes
  useEffect(() => {
    setUseProxy(false);
    setHlsFallback(false);
    setRetryCount(0);
    setRetrying(false);
    setError(null);
    setAutoplayMuted(false);
  }, [src]);

  const handleRetry = useCallback(() => {
    if (retrying || retryCount >= MAX_RETRIES) return;
    const attempt = retryCount + 1;
    log('INFO', `Retry attempt ${attempt}/${MAX_RETRIES} for "${title}" src=${src?.substring(0, 80)}`);
    setRetrying(true);
    setError(null);
    const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);
    setTimeout(() => {
      setRetryCount(attempt);
      setUseProxy(false);
      setRetrying(false);
      // The useEffect on [src, useProxy, retryCount] will re-initialize playback
    }, delay);
  }, [retrying, retryCount, title, src]);

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
    const onPlay = () => { setPlaying(true); setBuffering(false); log('DEBUG', 'Playback started'); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setPreBuffering(false); };
    const onCanPlay = () => setBuffering(false);
    const onError = () => {
      log('ERROR', `Video element error: code=${video.error?.code} msg=${video.error?.message}`);
    };

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
    if (video.paused) video.play().catch((e) => log('WARN', 'Play failed', e?.message));
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

  // Native platform: show poster + buttons to open in specific external players
  if (isNative && nativeActive) {
    // Native players (VLC) handle MP4 natively — don't convert movie URLs
    const nativeSrc = normalizeStreamUrl(src);
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
        {poster && (
          <img src={poster} alt={title || ''} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="relative z-10 flex flex-col items-center gap-5 px-4">
          {title && <p className="text-white font-semibold text-sm text-center">{title}</p>}
          <p className="text-white/70 text-xs">Choose a player</p>
          <button
            onClick={() => playInVlc(nativeSrc, title)}
            className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            Open in VLC
          </button>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => playInMxPlayer(nativeSrc, title)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              MX Player
            </button>
            <button
              onClick={() => playInSystemChooser(nativeSrc)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Play className="w-4 h-4" />
              Other
            </button>
          </div>
          <button
            onClick={() => setNativeActive(false)}
            className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground transition-colors mt-1"
          >
            Use web player instead
          </button>
        </div>
      </div>
    );
  }

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

      {/* Tap to unmute banner */}
      {autoplayMuted && playing && !error && (
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = false;
              setMuted(false);
              setAutoplayMuted(false);
            }
          }}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/70 text-white text-sm font-medium hover:bg-black/90 transition-colors animate-pulse"
        >
          <VolumeX className="w-4 h-4" /> Tap to unmute
        </button>
      )}

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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-4 gap-3">
          <p className="text-destructive font-medium text-lg">⚠️ Playback failed</p>
          <p className="text-muted-foreground text-sm max-w-xs">
            {error}. Please check your connection or try again.
          </p>
          <div className="flex gap-3 mt-2">
            {retryCount < MAX_RETRIES && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {retrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Retrying ({retryCount + 1}/{MAX_RETRIES})...
                  </>
                ) : (
                  `Retry${retryCount > 0 ? ` (${retryCount}/${MAX_RETRIES})` : ''}`
                )}
              </button>
            )}
            {retryCount >= MAX_RETRIES && (
              <p className="text-muted-foreground text-xs">Max retries reached.</p>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
              >
                Go Back
              </button>
            )}
          </div>
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

            <div className="bg-gradient-to-t from-black/80 to-transparent p-4 pb-[env(safe-area-inset-bottom,16px)] pt-10 space-y-2">
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

              <div className="flex items-center justify-between text-white mb-2">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="hover:text-primary transition-colors p-1">
                    {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  <button onClick={() => seek(-10)} className="hover:text-primary transition-colors p-1">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button onClick={() => seek(10)} className="hover:text-primary transition-colors p-1">
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button onClick={toggleMute} className="hover:text-primary transition-colors p-1">
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <span className="text-xs text-white/70 ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <button onClick={toggleFullscreen} className="hover:text-primary transition-colors p-1">
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
