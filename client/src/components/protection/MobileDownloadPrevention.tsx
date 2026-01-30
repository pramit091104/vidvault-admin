import React, { useEffect, useRef } from 'react';

interface MobileDownloadPreventionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onDownloadAttempt?: () => void;
}

export const MobileDownloadPrevention: React.FC<MobileDownloadPreventionProps> = ({
  videoRef,
  onDownloadAttempt
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    
    if (!video || !overlay) return;

    // Enhanced mobile-specific download prevention
    const preventMobileDownload = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onDownloadAttempt?.();
      
      // Show warning on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Log the attempt
      console.warn('🚨 Mobile download attempt blocked:', e.type);
      
      return false;
    };

    // Enhanced long press prevention for mobile
    let longPressTimer: NodeJS.Timeout;
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartTime = Date.now();
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      
      // Prevent any long press immediately
      longPressTimer = setTimeout(() => {
        preventMobileDownload(e);
      }, 300); // Reduced from 500ms to 300ms for faster blocking
      
      // Additional prevention for iOS
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      clearTimeout(longPressTimer);
      
      const touchDuration = Date.now() - touchStartTime;
      
      // Block any touch longer than 200ms as potential download attempt
      if (touchDuration > 200) {
        preventMobileDownload(e);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      clearTimeout(longPressTimer);
      
      // Check if touch moved significantly (not a long press)
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.y);
      
      // If minimal movement, still consider it a potential long press
      if (deltaX < 10 && deltaY < 10) {
        const touchDuration = Date.now() - touchStartTime;
        if (touchDuration > 150) {
          preventMobileDownload(e);
        }
      }
    };

    // Enhanced iOS specific - prevent save to photos and share sheet
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      preventMobileDownload(e);
      return false;
    };

    // Enhanced Android specific - prevent download via context menu
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      preventMobileDownload(e);
      return false;
    };

    // Prevent selection on mobile
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Enhanced drag prevention
    const handleDragStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      preventMobileDownload(e);
      return false;
    };

    // Add comprehensive event listeners with enhanced options
    const eventOptions = { passive: false, capture: true };
    
    // Video element events
    video.addEventListener('touchstart', handleTouchStart, eventOptions);
    video.addEventListener('touchend', handleTouchEnd, eventOptions);
    video.addEventListener('touchmove', handleTouchMove, eventOptions);
    video.addEventListener('contextmenu', handleContextMenu, eventOptions);
    video.addEventListener('selectstart', handleSelectStart, eventOptions);
    video.addEventListener('dragstart', handleDragStart, eventOptions);
    
    // iOS specific events
    video.addEventListener('gesturestart', handleGestureStart, eventOptions);
    video.addEventListener('gesturechange', handleGestureStart, eventOptions);
    video.addEventListener('gestureend', handleGestureStart, eventOptions);

    // Overlay events (more comprehensive coverage)
    overlay.addEventListener('touchstart', handleTouchStart, eventOptions);
    overlay.addEventListener('touchend', handleTouchEnd, eventOptions);
    overlay.addEventListener('touchmove', handleTouchMove, eventOptions);
    overlay.addEventListener('contextmenu', handleContextMenu, eventOptions);
    overlay.addEventListener('selectstart', handleSelectStart, eventOptions);
    overlay.addEventListener('dragstart', handleDragStart, eventOptions);

    // Additional mobile browser specific events
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        // Start monitoring for long press
        setTimeout(() => {
          preventMobileDownload(e);
        }, 250);
      }
    };

    video.addEventListener('pointerdown', handlePointerDown, eventOptions);
    overlay.addEventListener('pointerdown', handlePointerDown, eventOptions);

    // Monitor for mobile browser download attempts
    const handleLoadStart = () => {
      // Enhanced mobile-specific attributes
      video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
      video.setAttribute('disablepictureinpicture', 'true');
      video.setAttribute('disableremoteplayback', 'true');
      
      // Mobile-specific attributes
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'false'); // Ensure not muted to prevent auto-download
      
      // Additional iOS Safari specific
      video.style.webkitTouchCallout = 'none';
      video.style.webkitUserSelect = 'none';
      video.style.webkitTapHighlightColor = 'transparent';
    };

    video.addEventListener('loadstart', handleLoadStart);

    // Cleanup function
    return () => {
      clearTimeout(longPressTimer);
      
      video.removeEventListener('touchstart', handleTouchStart);
      video.removeEventListener('touchend', handleTouchEnd);
      video.removeEventListener('touchmove', handleTouchMove);
      video.removeEventListener('contextmenu', handleContextMenu);
      video.removeEventListener('selectstart', handleSelectStart);
      video.removeEventListener('gesturestart', handleGestureStart);
      video.removeEventListener('gesturechange', handleGestureStart);
      video.removeEventListener('gestureend', handleGestureStart);
      video.removeEventListener('dragstart', handleDragStart);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('pointerdown', handlePointerDown);

      overlay.removeEventListener('touchstart', handleTouchStart);
      overlay.removeEventListener('touchend', handleTouchEnd);
      overlay.removeEventListener('touchmove', handleTouchMove);
      overlay.removeEventListener('contextmenu', handleContextMenu);
      overlay.removeEventListener('selectstart', handleSelectStart);
      overlay.removeEventListener('dragstart', handleDragStart);
      overlay.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [videoRef, onDownloadAttempt]);

  // Enhanced mobile browser detection and protection
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isChrome = /chrome/.test(userAgent);
    const isMobile = isIOS || isAndroid;

    // Enhanced iOS specific protections
    if (isIOS) {
      // Prevent iOS share sheet with enhanced detection
      const preventIOSShare = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
          e.stopPropagation();
          onDownloadAttempt?.();
        }
      };
      
      document.addEventListener('touchstart', preventIOSShare, { passive: false, capture: true });

      // Enhanced iOS long press menu prevention
      const preventIOSLongPress = (e: TouchEvent) => {
        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element?.tagName === 'VIDEO' || element?.closest('video')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onDownloadAttempt?.();
        }
      };
      
      document.addEventListener('touchend', preventIOSLongPress, { passive: false, capture: true });
      
      // Prevent iOS force touch (3D Touch)
      const preventForceTouch = (e: TouchEvent) => {
        if (e.touches[0]?.force > 0.5) {
          e.preventDefault();
          e.stopPropagation();
          onDownloadAttempt?.();
        }
      };
      
      document.addEventListener('touchforcechange', preventForceTouch, { passive: false });

      return () => {
        document.removeEventListener('touchstart', preventIOSShare);
        document.removeEventListener('touchend', preventIOSLongPress);
        document.removeEventListener('touchforcechange', preventForceTouch);
      };
    }

    // Enhanced Android specific protections
    if (isAndroid) {
      // Enhanced Android download prevention via long press
      const preventAndroidDownload = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'VIDEO' || target.closest('video')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onDownloadAttempt?.();
        }
      };
      
      document.addEventListener('contextmenu', preventAndroidDownload, { passive: false, capture: true });

      return () => {
        document.removeEventListener('contextmenu', preventAndroidDownload);
      };
    }

    // Enhanced Chrome mobile specific protections
    if (isChrome && isMobile) {
      // Prevent Chrome mobile download options with enhanced CSS
      const style = document.createElement('style');
      style.textContent = `
        video::-webkit-media-controls-download-button {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        video::-webkit-media-controls-fullscreen-button {
          display: none !important;
          visibility: hidden !important;
        }
        video::-webkit-media-controls-overflow-button {
          display: none !important;
          visibility: hidden !important;
        }
        video {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -webkit-tap-highlight-color: transparent !important;
          touch-action: manipulation !important;
        }
      `;
      document.head.appendChild(style);

      // Enhanced Chrome mobile gesture prevention
      const preventChromeGestures = (e: Event) => {
        if (e.target instanceof HTMLVideoElement) {
          e.preventDefault();
          e.stopPropagation();
          
          // Check for Chrome's download gesture patterns
          if (e.type === 'touchstart') {
            const touchEvent = e as TouchEvent;
            if (touchEvent.touches.length === 1) {
              // Single touch - monitor for long press
              setTimeout(() => {
                onDownloadAttempt?.();
              }, 200);
            }
          }
        }
      };
      
      document.addEventListener('touchstart', preventChromeGestures, { passive: false, capture: true });
      document.addEventListener('touchend', preventChromeGestures, { passive: false, capture: true });

      return () => {
        document.head.removeChild(style);
        document.removeEventListener('touchstart', preventChromeGestures);
        document.removeEventListener('touchend', preventChromeGestures);
      };
    }

    // General mobile protections for other browsers
    if (isMobile) {
      // Prevent mobile browser download shortcuts
      const preventMobileShortcuts = (e: KeyboardEvent) => {
        // Common mobile browser download shortcuts
        if (
          (e.ctrlKey && e.key === 's') || // Ctrl+S
          (e.metaKey && e.key === 's') || // Cmd+S on iOS
          (e.altKey && e.key === 'd')     // Alt+D
        ) {
          e.preventDefault();
          e.stopPropagation();
          onDownloadAttempt?.();
        }
      };
      
      document.addEventListener('keydown', preventMobileShortcuts, { passive: false, capture: true });
      
      return () => {
        document.removeEventListener('keydown', preventMobileShortcuts);
      };
    }
  }, [onDownloadAttempt]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {/* Enhanced mobile-specific CSS */}
      <style jsx>{`
        video {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -webkit-tap-highlight-color: transparent !important;
          touch-action: manipulation !important;
          -webkit-user-drag: none !important;
          -khtml-user-drag: none !important;
          -moz-user-drag: none !important;
          -o-user-drag: none !important;
          user-drag: none !important;
          pointer-events: auto !important;
        }
        
        /* Enhanced iOS Safari specific */
        @supports (-webkit-touch-callout: none) {
          video {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -webkit-tap-highlight-color: rgba(0,0,0,0) !important;
          }
        }
        
        /* Enhanced Android Chrome specific */
        @media screen and (-webkit-min-device-pixel-ratio: 0) {
          video::-webkit-media-controls-download-button {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          video::-webkit-media-controls-fullscreen-button {
            display: none !important;
            visibility: hidden !important;
          }
          video::-webkit-media-controls-overflow-button {
            display: none !important;
            visibility: hidden !important;
          }
          video::-webkit-media-controls-picture-in-picture-button {
            display: none !important;
            visibility: hidden !important;
          }
        }
        
        /* Firefox mobile specific */
        @-moz-document url-prefix() {
          video {
            -moz-user-select: none !important;
            -moz-user-drag: none !important;
          }
        }
        
        /* Samsung Internet specific */
        video::-webkit-media-controls-panel {
          -webkit-user-select: none !important;
        }
        
        /* Enhanced touch prevention */
        video, video * {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-user-drag: none !important;
          -khtml-user-drag: none !important;
          -moz-user-drag: none !important;
          -o-user-drag: none !important;
          user-drag: none !important;
        }
        
        /* Prevent context menu on all mobile browsers */
        video {
          -webkit-context-menu: none !important;
          -moz-context-menu: none !important;
          context-menu: none !important;
        }
        
        /* Additional mobile browser specific rules */
        @media (hover: none) and (pointer: coarse) {
          video {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            touch-action: manipulation !important;
          }
        }
      `}</style>
    </div>
  );
};

export default MobileDownloadPrevention;