import React, { useEffect } from 'react';
import { useHLSPlayer } from '@/hooks/useHLSPlayer';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HLSVideoPlayerProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
  className?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export const HLSVideoPlayer: React.FC<HLSVideoPlayerProps> = ({
  videoId,
  title,
  autoplay = false,
  className = '',
  onError,
  onReady,
  onTimeUpdate
}) => {
  const { videoRef, state, controls } = useHLSPlayer({
    videoId,
    autoplay,
    onError,
    onReady
  });

  // Call onTimeUpdate callback
  useEffect(() => {
    if (onTimeUpdate) {
      onTimeUpdate(state.currentTime);
    }
  }, [state.currentTime, onTimeUpdate]);

  // Prevent download and right-click
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preventDownload = (e: Event) => {
      e.preventDefault();
      return false;
    };

    video.addEventListener('contextmenu', preventDownload);
    video.addEventListener('dragstart', preventDownload);

    // Disable download controls
    if (video.controlsList) {
      video.controlsList.add('nodownload');
      video.controlsList.add('nofullscreen');
      video.controlsList.add('noremoteplayback');
    }
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;

    return () => {
      video.removeEventListener('contextmenu', preventDownload);
      video.removeEventListener('dragstart', preventDownload);
    };
  }, [videoRef]);

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center p-4">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-600 font-medium">Video Playback Error</p>
          <p className="text-red-500 text-sm mt-1">{state.error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-3"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-auto"
        controls
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        crossOrigin="anonymous"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        Your browser does not support HLS video playback.
      </video>

      {/* Watermark Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          {/* Corner watermarks */}
          <div className="absolute top-4 left-4 text-white text-sm font-bold bg-black/50 px-2 py-1 rounded">
            PREVIU
          </div>
          <div className="absolute top-4 right-4 text-white text-sm font-bold bg-black/50 px-2 py-1 rounded">
            HLS PROTECTED
          </div>
          <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
            {new Date().toLocaleString()}
          </div>
          <div className="absolute bottom-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
            ENCRYPTED
          </div>
        </div>
      </div>

      {/* Quality Indicator */}
      {state.quality && state.quality !== 'auto' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
          {state.quality}
        </div>
      )}

      {/* CSS to hide download button */}
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
          user-select: none !important;
        }
      `}</style>
    </div>
  );
};

export default HLSVideoPlayer;
