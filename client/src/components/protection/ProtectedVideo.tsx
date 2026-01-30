import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MobileDownloadPrevention from './MobileDownloadPrevention';
import { getApiBaseUrl } from '@/config/environment';

interface ProtectedVideoProps {
  videoId: string;
  title: string;
  isPaid?: boolean;
  allowDownload?: boolean;
  quality?: 'preview' | 'standard' | 'hd';
  onUnauthorizedAccess?: () => void;
  onDownloadAttempt?: () => void;
}

export const ProtectedVideo: React.FC<ProtectedVideoProps> = ({
  videoId,
  title,
  isPaid = false,
  allowDownload = false, // Always false now - no downloads allowed
  quality = 'standard', // Same quality for all users
  onUnauthorizedAccess,
  onDownloadAttempt
}) => {
  const { currentUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [downloadAttempted, setDownloadAttempted] = useState(false);

  useEffect(() => {
    if (currentUser && videoId) {
      generateStreamOnlyUrl();
      initializeNetworkProtection();
    }
  }, [currentUser, videoId, quality]);

  const initializeNetworkProtection = () => {
    // Initialize network tab protection
    if (typeof window !== 'undefined') {
      // Clear any existing network history
      try {
        if (performance.clearResourceTimings) {
          performance.clearResourceTimings();
        }
      } catch (error) {
        console.warn('Could not clear network history:', error);
      }

      // Monitor for network tab access
      const originalGetEntries = performance.getEntries;
      performance.getEntries = function () {
        console.warn('🚨 Network monitoring detected - access blocked');
        return []; // Return empty array to hide network data
      };

      // Override fetch to hide video URLs
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        const url = args[0]?.toString() || '';

        // Hide video streaming URLs from network tab
        if (url.includes('/api/media/stream/') || url.includes('/stream/') || url.includes('/video/')) {
          console.warn('🚨 Video URL access detected in network tab - blocked');
          return Promise.resolve(new Response('Access Denied', { status: 403 }));
        }

        return originalFetch.apply(this, args);
      };

      // Generate decoy requests to confuse network monitoring
      const generateDecoyRequests = () => {
        const decoys = [
          '/api/analytics/track',
          '/api/user/preferences',
          '/api/content/metadata',
          '/api/session/heartbeat',
          '/api/ads/preroll',
          '/api/quality/metrics'
        ];

        decoys.forEach(url => {
          fetch(url, {
            method: 'HEAD',
            mode: 'no-cors'
          }).catch(() => { }); // Ignore errors
        });
      };

      // Generate decoy requests periodically
      const decoyInterval = setInterval(generateDecoyRequests, 5000);

      // Cleanup on unmount
      return () => {
        clearInterval(decoyInterval);
        window.fetch = originalFetch;
        performance.getEntries = originalGetEntries;
      };
    }
  };

  const generateStreamOnlyUrl = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`${getApiBaseUrl()}/api/stream-only/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          videoId,
          quality: 'standard' // Same quality for all users
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate stream URL');
      }

      const data = await response.json();
      setVideoUrl(data.streamUrl);

    } catch (error) {
      console.error('Error generating stream URL:', error);
      setError('Failed to load video');
      onUnauthorizedAccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  // Comprehensive download prevention - same for all users
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Disable all download-related functionality for everyone
    const preventDownload = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      setDownloadAttempted(true);
      onDownloadAttempt?.();

      // Log download attempt
      fetch(`${getApiBaseUrl()}/api/log-download-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          videoId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        })
      }).catch(console.error);

      return false;
    };

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      preventDownload(e);
      return false;
    };

    // Prevent drag and drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      preventDownload(e);
      return false;
    };

    // Prevent text selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Monitor video events for download attempts
    const handleLoadStart = () => {
      // Disable video controls that allow downloading
      video.controlsList.add('nodownload');
      video.controlsList.add('nofullscreen');
      video.disablePictureInPicture = true;
    };

    // Prevent seeking to avoid download managers
    const handleSeeking = (e: Event) => {
      // Allow normal seeking but log suspicious patterns
      const currentTime = video.currentTime;
      const duration = video.duration;

      // Detect rapid seeking (download manager behavior)
      if (currentTime > duration * 0.9) {
        console.warn('Suspicious seeking detected');
        preventDownload(e);
      }
    };

    // Add event listeners
    video.addEventListener('contextmenu', handleContextMenu);
    video.addEventListener('dragstart', handleDragStart);
    video.addEventListener('selectstart', handleSelectStart);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('seeking', handleSeeking);

    // Container event listeners
    const container = containerRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
      container.addEventListener('dragstart', handleDragStart);
      container.addEventListener('selectstart', handleSelectStart);
    }

    return () => {
      video.removeEventListener('contextmenu', handleContextMenu);
      video.removeEventListener('dragstart', handleDragStart);
      video.removeEventListener('selectstart', handleSelectStart);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('seeking', handleSeeking);

      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
        container.removeEventListener('dragstart', handleDragStart);
        container.removeEventListener('selectstart', handleSelectStart);
      }
    };
  }, [videoRef.current, currentUser, videoId]);

  // Keyboard shortcuts prevention - same for all users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable all download-related shortcuts for everyone
      const blockedKeys = [
        'F12', // Developer tools
        'F5',  // Refresh (can be used to access network tab)
        'F11', // Fullscreen
      ];

      const blockedCombinations = [
        { ctrl: true, key: 's' }, // Save
        { ctrl: true, key: 'u' }, // View source
        { ctrl: true, key: 'h' }, // History
        { ctrl: true, key: 'j' }, // Downloads
        { ctrl: true, key: 'd' }, // Bookmark (sometimes used for downloads)
        { ctrl: true, shift: true, key: 'I' }, // Developer tools
        { ctrl: true, shift: true, key: 'C' }, // Inspect element
        { ctrl: true, shift: true, key: 'J' }, // Console
        { alt: true, key: 'F4' }, // Close window
      ];

      // Check blocked keys
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
        console.warn('Blocked key:', e.key);
        return false;
      }

      // Check blocked combinations
      for (const combo of blockedCombinations) {
        if (
          (combo.ctrl ? e.ctrlKey : true) &&
          (combo.shift ? e.shiftKey : !e.shiftKey) &&
          (combo.alt ? e.altKey : !e.altKey) &&
          e.key.toLowerCase() === combo.key.toLowerCase()
        ) {
          e.preventDefault();
          console.warn('Blocked combination:', combo);
          return false;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Monitor for developer tools and download managers
  useEffect(() => {
    let devToolsOpen = false;

    const detectDevTools = () => {
      const threshold = 160;
      const isOpen = window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold;

      if (isOpen && !devToolsOpen) {
        devToolsOpen = true;
        console.clear();
        console.log('%c🚨 DOWNLOAD PREVENTION ACTIVE', 'color: red; font-size: 24px; font-weight: bold;');
        console.log('%cThis content is protected. Downloads are monitored and watermarked.', 'color: red; font-size: 16px;');
        console.log('%cUnauthorized downloading may result in account suspension.', 'color: red; font-size: 14px;');

        // Log developer tools opening
        fetch(`${getApiBaseUrl()}/api/log-devtools-attempt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser?.getIdToken()}`
          },
          body: JSON.stringify({
            videoId,
            timestamp: new Date().toISOString()
          })
        }).catch(console.error);
      } else if (!isOpen) {
        devToolsOpen = false;
      }
    };

    const interval = setInterval(detectDevTools, 1000);
    return () => clearInterval(interval);
  }, [currentUser, videoId]);

  // Disable video download via blob URLs
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Override video src to prevent blob URL access
    const originalSrc = video.src;

    // Monitor for src changes (download managers often change src)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const newSrc = video.src;
          if (newSrc !== originalSrc && newSrc.startsWith('blob:')) {
            console.warn('Blob URL detected - potential download attempt');
            video.src = originalSrc; // Restore original src
            setDownloadAttempted(true);
            onDownloadAttempt?.();
          }
        }
      });
    });

    observer.observe(video, { attributes: true });

    return () => observer.disconnect();
  }, [videoUrl, onDownloadAttempt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading protected content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <p className="text-red-600 font-medium">Content Protection Error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button
            onClick={generateStreamOnlyUrl}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden select-none"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
      {/* Download Attempt Warning */}
      {downloadAttempted && (
        <div className="absolute top-4 left-4 right-4 bg-red-600 text-white p-3 rounded-lg z-50 animate-pulse">
          <p className="font-bold">⚠️ DOWNLOAD ATTEMPT DETECTED</p>
          <p className="text-sm">This action has been logged. Downloads are not permitted.</p>
        </div>
      )}

      {/* Video Element with Maximum Protection */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls={true} // Same controls for all users
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture={true}
        disableRemotePlayback={true}
        className="w-full h-auto pointer-events-auto"
        onLoadStart={() => setIsLoading(false)}
        onError={() => setError('Video playback failed')}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          outline: 'none',
          border: 'none'
        }}
        // Additional security attributes
        crossOrigin="anonymous"
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>

      {/* Minimal watermark overlay for download prevention only */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          {/* Corner watermarks - same for all users */}
          <div className="absolute top-4 left-4 text-white text-sm font-bold bg-black/50 px-2 py-1 rounded">
            PREVIU
          </div>
          <div className="absolute top-4 right-4 text-white text-sm font-bold bg-black/50 px-2 py-1 rounded">
            NO DOWNLOAD
          </div>
          <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
            {new Date().toLocaleString()}
          </div>
          <div className="absolute bottom-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
            PROTECTED
          </div>
        </div>
      </div>

      {/* Mobile Download Prevention */}
      <MobileDownloadPrevention
        videoRef={videoRef}
        onDownloadAttempt={onDownloadAttempt}
      />

      {/* Invisible overlay to prevent interactions */}
      <div
        className="absolute inset-0 bg-transparent"
        style={{
          zIndex: 1,
          pointerEvents: 'none' // Allow video controls but prevent other interactions
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />

      {/* CSS to hide download options */}
      <style jsx>{`
        video::-webkit-media-controls-download-button {
          display: none !important;
        }
        video::-webkit-media-controls-fullscreen-button {
          display: none !important;
        }
        video::-webkit-media-controls-picture-in-picture-button {
          display: none !important;
        }
        video::-internal-media-controls-download-button {
          display: none !important;
        }
        video {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
      `}</style>
    </div>
  );
};

export default ProtectedVideo;