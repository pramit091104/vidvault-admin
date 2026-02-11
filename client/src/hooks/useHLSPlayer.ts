import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { getApiBaseUrl } from '@/config/environment';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UseHLSPlayerOptions {
  videoId: string;
  autoplay?: boolean;
  onError?: (error: string) => void;
  onReady?: () => void;
}

interface HLSPlayerState {
  isLoading: boolean;
  error: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  quality: string;
  availableQualities: string[];
}

export function useHLSPlayer(options: UseHLSPlayerOptions) {
  const { videoId, autoplay = false, onError, onReady } = options;
  const { currentUser } = useAuth();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [state, setState] = useState<HLSPlayerState>({
    isLoading: true,
    error: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    quality: 'auto',
    availableQualities: []
  });

  /**
   * Generate HLS session and get playlist URL
   */
  const generateSession = useCallback(async () => {
    try {
      if (!currentUser) {
        throw new Error('Authentication required');
      }

      const token = await currentUser.getIdToken();
      const response = await fetch(`${getApiBaseUrl()}/api/hls/generate-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId })
      });

      if (!response.ok) {
        throw new Error('Failed to generate HLS session');
      }

      const data = await response.json();
      sessionIdRef.current = data.sessionId;
      
      return data.playlistUrl;
    } catch (error) {
      console.error('Error generating HLS session:', error);
      throw error;
    }
  }, [videoId, currentUser]);

  /**
   * Initialize HLS player
   */
  const initializePlayer = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check if HLS is supported
      if (!Hls.isSupported()) {
        // Fallback for Safari (native HLS support)
        if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          const playlistUrl = await generateSession();
          videoRef.current.src = `${getApiBaseUrl()}${playlistUrl}`;
          
          if (autoplay) {
            await videoRef.current.play();
          }
          
          setState(prev => ({ ...prev, isLoading: false }));
          onReady?.();
          return;
        }
        
        throw new Error('HLS is not supported in this browser');
      }

      // Generate session and get playlist URL
      const playlistUrl = await generateSession();
      const fullUrl = `${getApiBaseUrl()}${playlistUrl}`;

      // Initialize HLS.js
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr, url) => {
          // Add custom headers if needed
          xhr.withCredentials = false;
        }
      });

      hlsRef.current = hls;

      // Load playlist
      hls.loadSource(fullUrl);
      hls.attachMedia(videoRef.current);

      // HLS events
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('HLS manifest loaded, found ' + data.levels.length + ' quality levels');
        
        const qualities = data.levels.map((level, index) => 
          `${level.height}p (${Math.round(level.bitrate / 1000)}kbps)`
        );
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          availableQualities: ['auto', ...qualities]
        }));

        if (autoplay && videoRef.current) {
          videoRef.current.play().catch(err => {
            console.error('Autoplay failed:', err);
          });
        }

        onReady?.();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, cannot recover');
              const errorMsg = 'Video playback failed';
              setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
              onError?.(errorMsg);
              hls.destroy();
              break;
          }
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        setState(prev => ({
          ...prev,
          quality: `${level.height}p`
        }));
      });

    } catch (error) {
      console.error('Error initializing HLS player:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize player';
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      onError?.(errorMsg);
    }
  }, [videoId, currentUser, autoplay, generateSession, onReady, onError]);

  /**
   * Update video state from video element
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setState(prev => ({
        ...prev,
        currentTime: video.currentTime,
        duration: video.duration || 0
      }));
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setState(prev => ({ ...prev, buffered }));
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('progress', handleProgress);
    };
  }, []);

  /**
   * Initialize player on mount
   */
  useEffect(() => {
    if (videoId && currentUser) {
      initializePlayer();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoId, currentUser, initializePlayer]);

  /**
   * Change quality level
   */
  const setQuality = useCallback((qualityIndex: number) => {
    if (hlsRef.current) {
      if (qualityIndex === -1) {
        // Auto quality
        hlsRef.current.currentLevel = -1;
        setState(prev => ({ ...prev, quality: 'auto' }));
      } else {
        hlsRef.current.currentLevel = qualityIndex;
      }
    }
  }, []);

  /**
   * Play/pause controls
   */
  const play = useCallback(async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (error) {
        console.error('Play error:', error);
        toast.error('Failed to play video');
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  /**
   * Seek to time
   */
  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  return {
    videoRef,
    state,
    controls: {
      play,
      pause,
      seek,
      setQuality
    }
  };
}
