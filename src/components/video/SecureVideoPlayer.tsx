import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SecureVideoPlayerProps {
  src: string;
  title?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
  src,
  title = "Video",
  onTimeUpdate,
  onLoadedMetadata,
  onError,
  className = "w-full h-full bg-black"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isProtected, setIsProtected] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Disable right-click context menu
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      setAttempts(prev => prev + 1);
      return false;
    };

    // Disable keyboard shortcuts for downloading/saving
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+S, Ctrl+Shift+I, F12, etc.
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        setAttempts(prev => prev + 1);
        return false;
      }
    };

    // Disable drag and drop
    const handleDragStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Disable selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    video.addEventListener('contextmenu', handleContextMenu);
    video.addEventListener('dragstart', handleDragStart);
    video.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);

    // Set protection flag
    setIsProtected(true);

    // Cleanup
    return () => {
      video.removeEventListener('contextmenu', handleContextMenu);
      video.removeEventListener('dragstart', handleDragStart);
      video.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Monitor for developer tools
  useEffect(() => {
    let devtools = false;
    const threshold = 160;

    const checkDevTools = () => {
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        if (!devtools) {
          devtools = true;
          setAttempts(prev => prev + 5); // Significant penalty for dev tools
          console.clear();
          console.log('%cVideo content is protected', 'color: red; font-size: 20px; font-weight: bold;');
        }
      } else {
        devtools = false;
      }
    };

    const interval = setInterval(checkDevTools, 500);
    return () => clearInterval(interval);
  }, []);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    onTimeUpdate?.(video.currentTime);
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const error = video.error;
    let errorMessage = 'Video playback error';
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'Video playback was aborted';
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error occurred while loading video';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'Video decoding error';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported or access denied';
          break;
        default:
          errorMessage = 'Unknown video error';
      }
    }
    
    onError?.(errorMessage);
  };

  return (
    <div className="relative">
      {/* Security Warning */}
      {attempts > 3 && (
        <Alert className="mb-4 border-red-500 bg-red-50">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-red-700">
            <strong>Security Notice:</strong> This video content is protected. 
            Unauthorized downloading or screen recording is prohibited.
          </AlertDescription>
        </Alert>
      )}

      {/* Protected Video Element */}
      <div 
        className="relative select-none"
        style={{ 
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        <video
          ref={videoRef}
          className={className}
          controls
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onError={handleError}
          crossOrigin="anonymous"
          preload="metadata"
          style={{
            pointerEvents: 'auto',
            outline: 'none'
          }}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Invisible overlay to prevent right-click on video */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Protection Status Indicator */}
      {isProtected && (
        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Protected
        </div>
      )}
    </div>
  );
};