import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { videoAccessService } from '@/services/videoAccessService';

interface ContentProtectionOptions {
  videoId: string;
  isPaid?: boolean;
  allowDownload?: boolean;
  quality?: 'preview' | 'standard' | 'hd';
  maxUses?: number;
  videoDuration?: number; // in seconds
  gcsPath?: string;
  onUnauthorizedAccess?: () => void;
  onProtectionViolation?: (violation: string) => void;
  onUrlRefresh?: (newUrl: string) => void;
}

interface ProtectedContent {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  remainingUses: number;
  expiresAt: Date | null;
  isProtected: boolean;
  refreshToken?: string;
  subscriptionVerified: boolean;
}

export const useContentProtection = (options: ContentProtectionOptions) => {
  const { currentUser } = useAuth();
  const [content, setContent] = useState<ProtectedContent>({
    url: null,
    isLoading: true,
    error: null,
    remainingUses: 0,
    expiresAt: null,
    isProtected: !options.isPaid,
    refreshToken: undefined,
    subscriptionVerified: false
  });

  // Generate protected URL using the new video access service
  const generateProtectedUrl = useCallback(async () => {
    if (!options.videoId) {
      setContent(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Video ID required' 
      }));
      return;
    }

    try {
      setContent(prev => ({ ...prev, isLoading: true, error: null }));

      // Use the new video access service for secure URL generation
      const secureAccess = await videoAccessService.generateSecureAccess({
        videoId: options.videoId,
        userId: currentUser?.uid,
        videoDuration: options.videoDuration,
        gcsPath: options.gcsPath
      });
      
      setContent({
        url: secureAccess.signedUrl,
        isLoading: false,
        error: null,
        remainingUses: options.maxUses || (options.isPaid ? 10 : 3),
        expiresAt: secureAccess.expiryTime,
        isProtected: !options.isPaid,
        refreshToken: secureAccess.refreshToken,
        subscriptionVerified: secureAccess.subscriptionVerified
      });

    } catch (error) {
      console.error('Content protection error:', error);
      setContent(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Protection failed'
      }));
      
      options.onUnauthorizedAccess?.();
    }
  }, [options.videoId, options.isPaid, options.allowDownload, options.quality, options.maxUses, options.videoDuration, options.gcsPath, options.onUnauthorizedAccess, currentUser?.uid]);

  // Refresh URL when it's about to expire using the new video access service
  const refreshUrl = useCallback(async () => {
    if (!content.expiresAt || !content.refreshToken) return;
    
    const timeUntilExpiry = content.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry > 300000) return; // More than 5 minutes remaining

    try {
      const newAccess = await videoAccessService.refreshVideoUrl(
        options.videoId,
        content.refreshToken,
        currentUser?.uid,
        options.gcsPath
      );

      setContent(prev => ({
        ...prev,
        url: newAccess.signedUrl,
        expiresAt: newAccess.expiryTime,
        refreshToken: newAccess.refreshToken
      }));

      // Notify parent component of URL refresh
      options.onUrlRefresh?.(newAccess.signedUrl);

    } catch (error) {
      console.error('URL refresh failed:', error);
      
      // Try graceful error handling with retry
      try {
        const fallbackAccess = await videoAccessService.handleRefreshFailure(
          options.videoId,
          currentUser?.uid
        );

        if (fallbackAccess) {
          setContent(prev => ({
            ...prev,
            url: fallbackAccess.signedUrl,
            expiresAt: fallbackAccess.expiryTime,
            refreshToken: fallbackAccess.refreshToken
          }));
          options.onUrlRefresh?.(fallbackAccess.signedUrl);
        } else {
          // Complete failure - trigger regeneration
          generateProtectedUrl();
        }
      } catch (fallbackError) {
        console.error('Fallback refresh also failed:', fallbackError);
        setContent(prev => ({
          ...prev,
          error: 'Failed to refresh video URL. Please reload the page.'
        }));
      }
    }
  }, [content.expiresAt, content.refreshToken, options.videoId, options.gcsPath, options.onUrlRefresh, currentUser?.uid, generateProtectedUrl]);

  // Protection violation detection using the new video access service
  const detectProtectionViolation = useCallback(async (violationType: string) => {
    console.warn(`Content protection violation detected: ${violationType}`);
    options.onProtectionViolation?.(violationType);
    
    // Log violation using the new video access service
    await videoAccessService.logAccessViolation({
      videoId: options.videoId,
      userId: currentUser?.uid,
      violationType: violationType as any,
      severity: 'medium',
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      additionalContext: {
        contentProtectionActive: true,
        isPaidUser: options.isPaid
      }
    });
  }, [options.videoId, options.onProtectionViolation, options.isPaid, currentUser?.uid]);

  // Initialize protection
  useEffect(() => {
    generateProtectedUrl();
    
    // Cleanup on unmount
    return () => {
      videoAccessService.cleanup(options.videoId);
    };
  }, [generateProtectedUrl, options.videoId]);

  // Set up auto-refresh
  useEffect(() => {
    if (content.expiresAt) {
      const timeUntilExpiry = content.expiresAt.getTime() - Date.now();
      const refreshTime = Math.max(timeUntilExpiry - 300000, 60000); // 5 min before expiry or 1 min minimum
      
      const timer = setTimeout(refreshUrl, refreshTime);
      return () => clearTimeout(timer);
    }
  }, [content.expiresAt, refreshUrl]);

  // Protection monitoring effects
  useEffect(() => {
    if (!options.isPaid) {
      // Disable right-click
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        detectProtectionViolation('right-click-attempt');
        return false;
      };

      // Disable text selection
      const handleSelectStart = (e: Event) => {
        e.preventDefault();
        return false;
      };

      // Disable drag and drop
      const handleDragStart = (e: DragEvent) => {
        e.preventDefault();
        detectProtectionViolation('drag-attempt');
        return false;
      };

      // Keyboard shortcuts prevention
      const handleKeyDown = (e: KeyboardEvent) => {
        // Disable F12, Ctrl+Shift+I, Ctrl+U, etc.
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.key === 'u') ||
            (e.ctrlKey && e.shiftKey && e.key === 'C') ||
            (e.ctrlKey && e.key === 's')) {
          e.preventDefault();
          detectProtectionViolation('keyboard-shortcut-attempt');
          return false;
        }
      };

      // Add event listeners
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('selectstart', handleSelectStart);
      document.addEventListener('dragstart', handleDragStart);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('selectstart', handleSelectStart);
        document.removeEventListener('dragstart', handleDragStart);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [options.isPaid, detectProtectionViolation]);

  // Developer tools detection
  useEffect(() => {
    if (!options.isPaid) {
      let devtools = { open: false, orientation: null };
      
      const threshold = 160;
      
      setInterval(() => {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools.open) {
            devtools.open = true;
            detectProtectionViolation('developer-tools-opened');
            console.clear();
            console.log('%cContent Protected by Previu', 'color: red; font-size: 20px; font-weight: bold;');
            console.log('%cUnauthorized access is prohibited and monitored.', 'color: red; font-size: 14px;');
          }
        } else {
          devtools.open = false;
        }
      }, 500);
    }
  }, [options.isPaid, detectProtectionViolation]);

  return {
    ...content,
    refresh: generateProtectedUrl,
    detectViolation: detectProtectionViolation
  };
};

export default useContentProtection;