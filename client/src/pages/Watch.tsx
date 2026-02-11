import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Share2, Eye, Calendar, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import 'plyr/dist/plyr.css';
import { getVideoBySlugOrId, updateVideoViewCount, GCSVideoRecord, isVideoLinkExpired } from "@/integrations/firebase/videoService";
import { addTimestampedComment, getVideoTimestampedComments, clearVideoCommentsCache, TimestampedComment } from "@/integrations/firebase/commentService";
import { useAuth } from "@/contexts/AuthContext";
import { useContentProtection } from "@/hooks/useContentProtection";
import { format } from "date-fns";
import { notificationService } from "@/services/notificationService";
import { ApprovalButtons } from "@/components/watch/ApprovalButtons";
import { applicationService } from "@/services";
import { GCS_CONFIG } from "@/integrations/gcs/config";

interface PublicVideo {
  id: string;
  fileName?: string;
  title: string;
  description: string;
  clientName: string;
  videoUrl: string;
  thumbnailUrl?: string;
  slug: string;
  isPublic: boolean;
  uploadedAt: Date;
  viewCount: number;
  service: 'gcs';
  publicUrl?: string;
  gcsPath?: string; // Full GCS path to the file
  // Approval workflow fields
  approvalStatus?: 'draft' | 'pending_review' | 'needs_changes' | 'approved' | 'completed';
  reviewedAt?: Date;
  reviewedBy?: string;
  revisionNotes?: string;
  version?: number;
  userId?: string; // Video creator's user ID
}

const Watch = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [video, setVideo] = useState<PublicVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [capturedTime, setCapturedTime] = useState<number>(0);
  const [commentText, setCommentText] = useState<string>("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [videoComments, setVideoComments] = useState<TimestampedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isMuted, setIsMuted] = useState(false);
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>('draft');
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ isActive: boolean; tier: string; expiryDate?: Date } | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [rateLimitStatus, setRateLimitStatus] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [accessViolationDetected, setAccessViolationDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null); // Use any type since Plyr is dynamically imported

  // Determine if we should use content protection based on video and subscription
  // Enable protection if video is not public or if we explicitly don't have a public URL
  // FIXED: Simplified logic - only use content protection for truly private videos
  const shouldUseContentProtection = video?.id && !video?.isPublic && !isLoadingSubscription;

  // Define content protection handlers with useCallback to prevent infinite loops
  const handleUnauthorizedAccess = useCallback(() => {
    console.warn('Unauthorized access detected - but allowing fallback to public URL');
    // Don't immediately show access denied - let it fall back to public URL if available
    if (!video?.publicUrl) {
      setVideoError('Unauthorized access detected. Please refresh the page.');
      setAccessViolationDetected(true);
      toast.error('Access denied. Please refresh the page.');
    }
    if (currentUser) {
      applicationService.invalidateUserCache(currentUser.uid);
    }
  }, [video?.publicUrl, currentUser]);

  const handleProtectionViolation = useCallback((violation: string) => {
    console.warn(`Protection violation: ${violation}`);
    setAccessViolationDetected(true);
    toast.warning('Content protection active');
  }, []);

  const handleUrlRefresh = useCallback((newUrl: string) => {
    console.log('Video URL refreshed automatically');
    if (videoRef.current && !videoRef.current.paused) {
      const currentTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;

      videoRef.current.src = newUrl;

      const restoreTimeout = setTimeout(() => {
        console.warn('Video metadata loading timeout');
        toast.warning('Video refresh taking longer than expected');
      }, 10000);

      videoRef.current.addEventListener('loadedmetadata', function restorePlayback() {
        clearTimeout(restoreTimeout);
        if (videoRef.current) {
          videoRef.current.currentTime = currentTime;
          if (wasPlaying) {
            videoRef.current.play().catch((error) => {
              console.error('Error resuming playback:', error);
              toast.error('Failed to resume playback. Please refresh the page.');
            });
          }
        }
        videoRef.current?.removeEventListener('loadedmetadata', restorePlayback);
      });

      videoRef.current.addEventListener('error', function handleRefreshError() {
        clearTimeout(restoreTimeout);
        console.error('Error loading refreshed video URL');
        toast.error('Video refresh failed. Please refresh the page.');
        videoRef.current?.removeEventListener('error', handleRefreshError);
      });
    }
  }, []);

  // Use content protection hook only when needed
  const contentProtection = useContentProtection({
    videoId: shouldUseContentProtection ? (video?.id || '') : '',
    isPaid: shouldUseContentProtection ? (subscriptionStatus?.isActive && (subscriptionStatus.tier === 'premium' || subscriptionStatus.tier === 'enterprise')) : false,
    allowDownload: false,
    quality: shouldUseContentProtection && subscriptionStatus?.tier === 'enterprise' ? 'hd' : 'standard',
    maxUses: 10,
    videoDuration: videoDuration || undefined,
    gcsPath: video?.gcsPath, // Pass the GCS path from the video record
    onUnauthorizedAccess: handleUnauthorizedAccess,
    onProtectionViolation: handleProtectionViolation,
    onUrlRefresh: handleUrlRefresh
  });

  // Debug logging for video playback
  useEffect(() => {
    if (video) {
      console.log('Video Playback Debug:', {
        hasVideo: !!video,
        hasPublicUrl: !!video.publicUrl,
        publicUrl: video.publicUrl,
        shouldUseContentProtection,
        hasContentProtectionUrl: !!contentProtection.url,
        contentProtectionUrl: contentProtection.url,
        videoRefExists: !!videoRef.current,
        playerRefExists: !!playerRef.current
      });
    }
  }, [video, video?.publicUrl, shouldUseContentProtection, contentProtection.url]);

  // Add timeout for content protection to prevent infinite loading
  // FIXED: Increased timeout to 30 seconds and improved error handling
  useEffect(() => {
    if (shouldUseContentProtection && contentProtection.isLoading) {
      const timeout = setTimeout(() => {
        console.warn('Content protection loading timeout - falling back to public URL');
        if (video?.publicUrl) {
          toast.warning('Using fallback video URL due to protection timeout');
          // Force use of public URL by disabling content protection
          setVideoError(null);
        } else {
          setVideoError('Video loading timeout. Please refresh the page.');
          toast.error('Video loading timeout. Please refresh the page.');
        }
      }, 30000); // 30 second timeout (increased from 15)

      return () => clearTimeout(timeout);
    }
  }, [shouldUseContentProtection, contentProtection.isLoading, video?.publicUrl]);



  // Load subscription status for authenticated users
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (!currentUser) {
        // For anonymous users, assume free tier
        setSubscriptionStatus({ isActive: false, tier: 'free' });
        setIsLoadingSubscription(false);
        return;
      }

      try {
        setIsLoadingSubscription(true);

        // Try to get cached subscription first
        const cachedSubscription = await applicationService.getSubscriptionStatus(currentUser.uid);
        if (cachedSubscription) {
          // Check if subscription has expired
          const isExpired = cachedSubscription.expiryDate && new Date() > cachedSubscription.expiryDate;
          if (isExpired) {
            console.log('Subscription expired, downgrading to free tier');
            setSubscriptionStatus({ isActive: false, tier: 'free', expiryDate: cachedSubscription.expiryDate });
          } else {
            setSubscriptionStatus({
              isActive: cachedSubscription.isActive,
              tier: cachedSubscription.tier,
              expiryDate: cachedSubscription.expiryDate
            });
          }
          setIsLoadingSubscription(false);
          return;
        }

        // Fallback to validation if no cache
        const result = await applicationService.validateUserSubscription(currentUser.uid);
        if (result.success && result.data) {
          // Check if subscription has expired
          const isExpired = result.data.expiryDate && new Date() > result.data.expiryDate;
          if (isExpired) {
            console.log('Subscription expired during validation, downgrading to free tier');
            setSubscriptionStatus({ isActive: false, tier: 'free', expiryDate: result.data.expiryDate });
            toast.warning('Your subscription has expired. Please renew to continue using premium features.');
          } else {
            setSubscriptionStatus({
              isActive: result.data.isActive,
              tier: result.data.tier,
              expiryDate: result.data.expiryDate
            });

            // Show expiry warning if subscription expires soon
            if (result.data.expiryDate) {
              const daysUntilExpiry = Math.ceil((result.data.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
                toast.warning(`Your subscription expires in ${daysUntilExpiry} days. Please renew to avoid interruption.`);
              }
            }
          }
        } else {
          // Handle validation failure - distinguish between network error and "user has free tier"
          if (result.error?.message?.includes('network') || result.error?.message?.includes('timeout')) {
            // Network error - retry once
            console.log('Network error during subscription validation, retrying...');
            setTimeout(async () => {
              try {
                const retryResult = await applicationService.validateUserSubscription(currentUser.uid);
                if (retryResult.success && retryResult.data) {
                  setSubscriptionStatus({
                    isActive: retryResult.data.isActive,
                    tier: retryResult.data.tier,
                    expiryDate: retryResult.data.expiryDate
                  });
                } else {
                  // Still failed - fallback to free tier
                  setSubscriptionStatus({ isActive: false, tier: 'free' });
                  toast.error('Could not verify subscription status. Using free tier.');
                }
              } catch (retryError) {
                console.error('Retry failed:', retryError);
                setSubscriptionStatus({ isActive: false, tier: 'free' });
                toast.error('Could not verify subscription status. Using free tier.');
              }
            }, 2000);
            return;
          } else {
            // User legitimately has free tier or other validation error
            setSubscriptionStatus({ isActive: false, tier: 'free' });
            if (result.error && !result.error.message?.includes('free tier')) {
              console.error('Subscription validation error:', result.error);
              toast.error('Could not verify subscription status. Using free tier.');
            }
          }
        }
      } catch (error) {
        console.error('Error loading subscription status:', error);
        // Fallback to free tier on error
        setSubscriptionStatus({ isActive: false, tier: 'free' });
        toast.error('Could not verify subscription status. Using free tier.');
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    loadSubscriptionStatus();
  }, [currentUser]);

  // Load rate limit status for authenticated users
  useEffect(() => {
    const loadRateLimitStatus = async () => {
      if (!currentUser) {
        // For anonymous users, set default rate limit
        setRateLimitStatus({ allowed: true, reason: undefined });
        return;
      }

      try {
        const rateLimitResult = await applicationService.getApprovalRateLimit(currentUser.uid);
        setRateLimitStatus(rateLimitResult);
      } catch (error) {
        console.error('Error loading rate limit status:', error);
        // Default to allowing actions if rate limit check fails
        setRateLimitStatus({ allowed: true, reason: undefined });
      }
    };

    loadRateLimitStatus();
  }, [currentUser]);

  // Update current time from video element and add download prevention
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle mute with M key
      if ((e.key === 'm' || e.key === 'M') && playerRef.current) {
        e.preventDefault();
        playerRef.current.muted = !playerRef.current.muted;
        setIsMuted(playerRef.current.muted);
      }
    };

    // Prevent right-click context menu on video
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent drag and drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable download button on load
    const handleLoadStart = () => {
      if (video.controlsList) {
        video.controlsList.add('nodownload');
        video.controlsList.add('nofullscreen');
        video.controlsList.add('noremoteplayback');
      }
      video.disablePictureInPicture = true;
      video.disableRemotePlayback = true;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('contextmenu', handleContextMenu);
    video.addEventListener('dragstart', handleDragStart);
    video.addEventListener('loadstart', handleLoadStart);
    document.addEventListener('keydown', handleKeyDown);

    // Trigger loadstart immediately if video is already loaded
    if (video.readyState > 0) {
      handleLoadStart();
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('contextmenu', handleContextMenu);
      video.removeEventListener('dragstart', handleDragStart);
      video.removeEventListener('loadstart', handleLoadStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initialize Plyr player when video element is ready
  // FIXED: Prevent duplicate initialization and improve cleanup
  useEffect(() => {
    let cancelled = false;
    let initTimeout: NodeJS.Timeout;

    const init = async () => {
      // Determine the video URL to use
      const videoUrl = shouldUseContentProtection ? contentProtection.url : video?.publicUrl;
      
      // Only initialize if we have a video element and a video URL
      if (!videoRef.current || !videoUrl) {
        return;
      }

      // If player already exists, don't reinitialize
      if (playerRef.current) {
        return;
      }

      // Wait a bit to ensure video element is fully ready
      initTimeout = setTimeout(async () => {
        if (cancelled || !videoRef.current) return;

        try {
          console.log('Initializing Plyr player...');
          const PlyrModule = await import('plyr');
          const PlyrClass = (PlyrModule as any).default || PlyrModule;
          
          if (cancelled || playerRef.current) return; // Double check before creating
          
          playerRef.current = new PlyrClass(videoRef.current, {
            controls: [
              'play-large',
              'play',
              'progress',
              'current-time',
              'duration',
              'volume',
              'airplay',
              'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            quality: { default: 720, options: [360, 720] },
            tooltips: { controls: true, seek: true },
            keyboard: { focused: true, global: true },
            clickToPlay: true,
            autoplay: false,
          });

          console.log('Plyr player initialized successfully');

          // Remove all mute-related listeners
          if (playerRef.current) {
            playerRef.current.off('volumechange', () => { });
          }
        } catch (err) {
          if (!cancelled) {
            console.error('Plyr initialization error:', err);
            toast.error('Video player initialization failed. Using default controls.');
          }
        }
      }, 100); // Small delay to ensure DOM is ready
    };

    init();

    return () => {
      cancelled = true;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      if (playerRef.current) {
        try {
          // Destroy player safely
          playerRef.current.destroy();
        } catch (err) {
          // Silently handle destroy errors
          console.warn('Player cleanup warning:', err);
        }
        playerRef.current = null;
      }
    };
  }, [video?.id, shouldUseContentProtection]); // Only reinit when video changes, not URL

  // Fetch comments for this video
  useEffect(() => {
    if (!video) return;

    const fetchComments = async () => {
      try {
        setLoadingComments(true);
        const comments = await getVideoTimestampedComments(video.id, false); // Force fresh fetch
        setVideoComments(comments || []);
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        setLoadingComments(false);
      }
    };

    // Only fetch comments once when video loads
    fetchComments();

    // No cleanup needed since we're not using intervals anymore
  }, [video?.id]);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!slug) {
        setError("Invalid video URL");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const videoData = await getVideoBySlugOrId(slug);

        if (!videoData) {
          setError("Video not found");
          setIsLoading(false);
          return;
        }

        // Check if video link has expired
        if (isVideoLinkExpired(videoData as GCSVideoRecord)) {
          setError("This video link has expired and is no longer accessible.");
          setIsLoading(false);
          return;
        }

        // Check if video is private and show appropriate message
        const isPrivateVideo = !videoData.isPublic;

        // Safely handle uploadedAt date conversion
        let uploadedAtDate: Date;
        if (videoData.uploadedAt instanceof Date) {
          uploadedAtDate = videoData.uploadedAt;
        } else if (videoData.uploadedAt) {
          // Try to create a Date, but handle invalid values
          const tempDate = new Date(videoData.uploadedAt);
          uploadedAtDate = isNaN(tempDate.getTime()) ? new Date() : tempDate;
        } else {
          // Fallback to current date if uploadedAt is null/undefined
          uploadedAtDate = new Date();
        }

        // FIXED: Better handling of undefined bucket names in URLs
        const fixBucketUrl = (url: string | undefined): string | undefined => {
          if (!url) return undefined;
          
          // Check if URL contains 'undefined' and fix it
          if (url.includes('/undefined/')) {
            const bucketName = GCS_CONFIG.BUCKET_NAME || 'previu_videos';
            console.warn(`Fixing undefined bucket in URL. Using bucket: ${bucketName}`);
            return url.replace('/undefined/', `/${bucketName}/`);
          }
          
          return url;
        };

        const mappedVideo: PublicVideo = {
          id: videoData.id,
          title: videoData.title,
          description: videoData.description || '',
          clientName: videoData.clientName,
          videoUrl: fixBucketUrl((videoData as GCSVideoRecord).publicUrl),
          thumbnailUrl: undefined,
          slug: videoData.publicSlug || slug,
          isPublic: videoData.isPublic || false,
          uploadedAt: uploadedAtDate,
          viewCount: videoData.viewCount || 0,
          service: videoData.service,
          publicUrl: fixBucketUrl((videoData as GCSVideoRecord).publicUrl),
          // Approval workflow fields
          approvalStatus: videoData.approvalStatus || 'draft',
          reviewedAt: videoData.reviewedAt,
          reviewedBy: videoData.reviewedBy,
          revisionNotes: videoData.revisionNotes,
          version: videoData.version || 1,
          userId: videoData.userId,
        };

        setVideo(mappedVideo);
        setApprovalStatus(mappedVideo.approvalStatus || 'draft');

        // --- SECURE URL LOGIC REMOVED ---
        // Now using content protection hook instead of direct signed URLs

        updateVideoViewCount(slug).catch(console.error);

      } catch (err: any) {
        console.error('Error fetching video:', err);
        setError(err.message || "Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideo();
  }, [slug]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: video?.title, url: shareUrl }).catch(() => { });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  };

  const handleApprovalStatusUpdate = (newStatus: string) => {
    setApprovalStatus(newStatus);
    if (video) {
      setVideo({ ...video, approvalStatus: newStatus as any });
    }
  };

  // Enhanced approval handler with identity verification and rate limiting
  const handleApprovalAction = async (
    action: 'approved' | 'rejected' | 'revision_requested',
    feedback?: string
  ) => {
    if (!video) return;

    try {
      // Get user ID (authenticated or anonymous) - use consistent ID for anonymous users
      let userId: string;
      if (currentUser) {
        userId = currentUser.uid;
      } else {
        // Use consistent anonymous ID from localStorage
        const storedAnonymousId = localStorage.getItem('anonymousUserId');
        if (storedAnonymousId) {
          userId = storedAnonymousId;
        } else {
          userId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('anonymousUserId', userId);
        }
      }

      // Check rate limits before proceeding
      const rateLimitCheck = await applicationService.getApprovalRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        setRateLimitStatus(rateLimitCheck);
        toast.error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
        return;
      }

      // Prepare options for the approval operation
      const approvalOptions = {
        feedback: feedback || '',
        clientName: video.clientName,
        videoCreatorId: video.userId
      };

      // Process the approval with integrated service using the correct method
      let result;
      try {
        if (action === 'approved') {
          result = await applicationService.approveVideo(userId, video.id, approvalOptions);
        } else if (action === 'rejected') {
          result = await applicationService.rejectVideo(userId, video.id, approvalOptions);
        } else if (action === 'revision_requested') {
          result = await applicationService.requestVideoRevision(userId, video.id, approvalOptions);
        } else {
          throw new Error('Invalid approval action');
        }
      } catch (serviceError) {
        console.error('Service call failed:', serviceError);
        throw new Error(`Service call failed: ${serviceError instanceof Error ? serviceError.message : 'Unknown service error'}`);
      }

      if (!result) {
        throw new Error('No result returned from approval service');
      }

      if (result.success) {
        // Update local state with correct status mapping
        let newStatus: string;
        if (action === 'approved') {
          newStatus = 'approved';
        } else if (action === 'rejected') {
          newStatus = 'rejected';
        } else if (action === 'revision_requested') {
          newStatus = 'needs_changes';
        } else {
          newStatus = 'draft';
        }

        handleApprovalStatusUpdate(newStatus);

        // Send notification to video creator
        try {
          const notificationData = {
            videoId: video.id,
            videoTitle: video.title,
            creatorId: video.userId || '',
            creatorEmail: '', // Will be fetched by notification service
            creatorName: '', // Will be fetched by notification service
            approvalStatus: action,
            reviewerName: currentUser?.displayName || currentUser?.email || 'Anonymous Reviewer',
            reviewerEmail: currentUser?.email || '',
            feedback: feedback || '',
            videoUrl: window.location.href
          };

          await applicationService.sendApprovalNotification(notificationData);
        } catch (notificationError) {
          console.error('Failed to send notification:', notificationError);
          // Don't fail the approval if notification fails
          toast.warning('Approval successful, but notification email may not have been sent.');
        }

        // Invalidate cache and warm it for next load
        try {
          applicationService.invalidateUserCache(userId);
          if (video.userId) {
            applicationService.invalidateUserCache(video.userId);
            // Warm cache for both users
            await applicationService.warmUserCaches([userId, video.userId]);
          }
        } catch (cacheError) {
          console.error('Cache management failed:', cacheError);
          // Don't fail approval if cache management fails
        }

        // Show success message
        const actionText = action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'revision requested';
        toast.success(`Video ${actionText} successfully!`);

        // Update rate limit status
        try {
          const updatedRateLimit = await applicationService.getApprovalRateLimit(userId);
          setRateLimitStatus(updatedRateLimit);
        } catch (rateLimitError) {
          console.error('Failed to update rate limit status:', rateLimitError);
        }

      } else {
        const errorMessage = result.error?.message || 'Approval processing failed';
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('Error processing approval:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Check if it's an authentication error
      if (errorMessage.includes('Access denied') || errorMessage.includes('Insufficient permissions')) {
        toast.error('Authentication required. Please sign in to approve videos.');
      } else if (errorMessage.includes('Rate limit')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Failed to process approval: ${errorMessage}`);
      }
    }
  };

  // Determine if current user is the client (not the video creator) with proper permission verification
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState<boolean>(true);

  // Check approval permissions
  useEffect(() => {
    const checkApprovalPermissions = async () => {
      if (!video) {
        setIsCheckingPermissions(false);
        return;
      }

      try {
        setIsCheckingPermissions(true);

        // Anonymous users are considered clients (can review), authenticated users must not be the creator
        if (!currentUser) {
          setIsClient(true);
        } else {
          // For authenticated users, verify they're not the video creator and have permission
          const isVideoCreator = currentUser.uid === video.userId;
          if (isVideoCreator) {
            setIsClient(false);
          } else {
            // Use approval manager to verify permission
            try {
              const canApprove = await applicationService.canUserApprove(currentUser.uid, video.id);
              setIsClient(canApprove);
            } catch (permissionError) {
              console.error('Error checking approval permission:', permissionError);
              // Fallback to simple check if permission verification fails
              setIsClient(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking approval permissions:', error);
        // Fallback to allowing approval if check fails
        setIsClient(!currentUser || (currentUser && video && currentUser.uid !== video.userId));
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkApprovalPermissions();
  }, [currentUser, video]);

  const handleCaptureTime = () => {
    // Get time from video element or Plyr player
    let time = currentTime;
    if (videoRef.current) {
      time = videoRef.current.currentTime;
    } else if (playerRef.current) {
      time = playerRef.current.currentTime;
    }

    setCapturedTime(time);
    toast.success(`Time captured: ${formatTimestamp(time)}`);
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    if (!video) return;

    // Simple rate limiting for anonymous users (client-side)
    if (!currentUser) {
      const lastCommentTime = localStorage.getItem('lastAnonymousComment');
      const now = Date.now();
      const cooldownPeriod = 30000; // 30 seconds

      if (lastCommentTime && (now - parseInt(lastCommentTime)) < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - (now - parseInt(lastCommentTime))) / 1000);
        toast.error(`Please wait ${remainingTime} seconds before posting another comment`);
        return;
      }
    }

    try {
      setIsPostingComment(true);
      // Use captured time, fallback to current time
      const timeToUse = capturedTime > 0 ? capturedTime : currentTime;

      // Generate anonymous user data if not signed in
      const userId = currentUser?.uid || `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userName = currentUser?.displayName || currentUser?.email || "Anonymous";
      const userEmail = currentUser?.email || "";

      await addTimestampedComment({
        videoId: video.id,
        videoTitle: video.title,
        timestamp: timeToUse,
        comment: commentText,
        userId,
        userName,
        userEmail,
      });

      // Store timestamp for anonymous rate limiting
      if (!currentUser) {
        localStorage.setItem('lastAnonymousComment', Date.now().toString());
      }

      // Send email notification to video owner (async, don't wait for it)
      // This works for both authenticated and anonymous users
      notificationService.sendCommentNotification({
        videoId: video.id,
        commentText: commentText.trim(),
        commenterName: userName,
        commenterEmail: userEmail
      }).catch(error => {
        console.error('Failed to send email notification:', error);
        // Don't show error to user, just log it
      });

      // Clear cache and refresh comments immediately
      clearVideoCommentsCache(video.id);
      setIsRefreshingComments(true);
      const updatedComments = await getVideoTimestampedComments(video.id, false);
      setVideoComments(updatedComments || []);
      setIsRefreshingComments(false);

      setCommentText("");
      setCapturedTime(0);
      toast.success(currentUser ? "Comment posted successfully!" : "Anonymous comment posted successfully!");
    } catch (err: any) {
      console.error('Error posting comment:', err);
      toast.error(err.message || "Failed to post comment");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleManualRefreshComments = async () => {
    if (!video || isRefreshingComments) return;

    try {
      setIsRefreshingComments(true);
      clearVideoCommentsCache(video.id);
      const updatedComments = await getVideoTimestampedComments(video.id, false);
      setVideoComments(updatedComments || []);
      toast.success("Comments refreshed!");
    } catch (err: any) {
      console.error('Error refreshing comments:', err);
      toast.error("Failed to refresh comments");
    } finally {
      setIsRefreshingComments(false);
    }
  };

  const formatSafeDate = (date: Date, formatString: string): string => {
    try {
      if (!date || isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, formatString);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = e.currentTarget.error;
    console.error("Video Player Error Object:", error);
    console.error("Video src:", e.currentTarget.currentSrc);
    console.error("Video readyState:", e.currentTarget.readyState);
    console.error("Video networkState:", e.currentTarget.networkState);

    let errorMessage = "Playback failed.";

    if (error?.code === 4) {
      errorMessage = "Video format not supported or file not found.";
    } else if (error?.code === 2) {
      errorMessage = "Network error. Please check your connection and try again.";
    } else if (error?.code === 3) {
      errorMessage = "Video decoding failed. The file may be corrupted.";
    } else if (error?.code === 1) {
      errorMessage = "Video loading was aborted.";
    }

    // Add additional context based on the video source
    if (contentProtection.url?.includes('protected/stream')) {
      errorMessage += " Protected video stream error. Please refresh the page.";
    } else if (!e.currentTarget.currentSrc) {
      errorMessage = "No video source available. Please check the video URL.";
    }

    console.error("Final error message:", errorMessage);
    setVideoError(errorMessage);

    // Try to reload the video once after a short delay
    if (!videoError) { // Only try once to avoid infinite loops
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Attempting to reload video...');
          videoRef.current.load();
        }
      }, 2000);
    } else {
      // If already tried reloading, suggest using public URL if available
      if (video?.publicUrl && shouldUseContentProtection) {
        toast.error('Video failed to load. Try refreshing the page.');
      }
    }
  };

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget;
    setVideoDimensions({
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
    });
    setVideoDuration(videoElement.duration);

    // Debug log for successful video loading
    console.log('Video loaded successfully:', {
      duration: videoElement.duration,
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
      src: videoElement.currentSrc,
      readyState: videoElement.readyState
    });
  };

  const getVideoContainerClass = (): string => {
    if (!videoDimensions) return "aspect-video";
    const ratio = videoDimensions.width / videoDimensions.height;
    if (ratio < 1) {
      // Portrait video - constrain width instead
      return "max-w-xs mx-auto";
    }
    return "aspect-video";
  };

  // Simplified loading condition - only wait for essential data
  if (isLoading || isLoadingSubscription) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">
          {isLoading ? 'Loading video...' : 'Checking subscription...'}
        </p>
      </div>
    </div>
  );

  // Simplified error condition - only show error if video truly unavailable
  if (error || !video) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Video Unavailable</h2>
        <p className="text-muted-foreground mb-4">
          {error || 'Video not found'}
        </p>
        <div className="space-y-2">
          <Button onClick={() => window.location.reload()} variant="default">
            Refresh Page
          </Button>
          <Button onClick={() => navigate('/')} variant="outline">
            Return Home
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Global CSS to hide download button */}
      <style>{`
        /* Hide download button in all browsers */
        video::-webkit-media-controls-download-button {
          display: none !important;
        }
        video::-internal-media-controls-download-button {
          display: none !important;
        }
        video::-webkit-media-controls-enclosure {
          overflow: hidden !important;
        }
        video::-webkit-media-controls-panel {
          width: calc(100% + 30px) !important;
        }
        
        /* Firefox */
        video::-moz-media-controls-download-button {
          display: none !important;
        }
        
        /* Prevent right-click on video */
        .no-download-video {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        
        /* Additional protection */
        video {
          pointer-events: auto !important;
        }
      `}</style>
      
      {/* Header: Full width - Better mobile spacing */}
      <header className="border-b bg-card/95 px-3 py-3 sm:px-4 sm:py-4 shrink-0">
        <div className="w-full px-2 sm:px-4 lg:px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10"></div>
            <h2 className="text-lg sm:text-xl font-bold">Previu</h2>
          </div>
          <Button variant="outline" size="sm" className="h-8 px-2 sm:h-9 sm:px-3" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline ml-1 sm:ml-2">Share</span>
          </Button>
        </div>
      </header>

      {/* Main Content: Responsive layout - mobile first approach */}
      <main className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Private Video Notice */}
        {video && !video.isPublic && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Private Video</span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              This video is private and can only be accessed via direct link. To make it publicly discoverable, the owner needs to make it public.
            </p>
          </div>
        )}



        {/* Access Violation Warning */}
        {accessViolationDetected && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Security Notice</span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              Unauthorized access attempt detected. This incident has been logged for security purposes.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAccessViolationDetected(false);
                window.location.reload();
              }}
              className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
            >
              Reload Page
            </Button>
          </div>
        )}

        {/* Rate Limit Warning */}
        {rateLimitStatus && !rateLimitStatus.allowed && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Action Limit Reached</span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              {rateLimitStatus.reason}
            </p>
          </div>
        )}

        {/* Mobile layout: Stacked */}
        <div className="lg:hidden space-y-4 sm:space-y-6">
          {/* Video Section */}
          <div className="space-y-4 sm:space-y-6">
            <div
              className={`relative bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center group ${getVideoContainerClass()}`}
              style={videoDimensions && videoDimensions.width < videoDimensions.height ? { aspectRatio: `${videoDimensions.width}/${videoDimensions.height}` } : undefined}
            >
              {videoError && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-white">
                  <p className="text-red-400 font-semibold mb-2">Playback Error</p>
                  <p className="text-sm text-gray-300">{videoError}</p>
                </div>
              )}
              {/* Show video if we have any valid URL - Mobile */}
              {/* SECURITY: Never expose direct GCS URLs - always use proxy */}
              {(() => {
                // For protected videos, ONLY use the signed/proxy URL - no fallback to public URL
                let videoUrl = null;
                
                if (shouldUseContentProtection) {
                  // Protected video - must use signed URL through proxy
                  if (contentProtection.url && !contentProtection.error) {
                    videoUrl = contentProtection.url;
                  } else if (contentProtection.isLoading) {
                    // Still loading - show spinner below
                    return null;
                  } else {
                    // Protection failed - show error
                    console.error('Content protection failed for private video', { error: contentProtection.error });
                    return null;
                  }
                } else {
                  // Public video - can use public URL
                  videoUrl = video.publicUrl;
                }
                
                if (!videoUrl) {
                  console.warn('No video URL available', { 
                    shouldUseContentProtection, 
                    hasContentProtectionUrl: !!contentProtection.url, 
                    hasPublicUrl: !!video.publicUrl,
                    protectionError: contentProtection.error,
                    isPublic: video.isPublic
                  });
                  return null;
                }
                
                return (
                  <video
                    key={videoUrl}
                    ref={videoRef}
                    className="w-full h-full bg-black no-download-video"
                    poster={video.thumbnailUrl}
                    controls
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    onError={handleVideoError}
                    onLoadedMetadata={handleVideoMetadata}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <source src={videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                );
              })()}

              {/* Show loading spinner if content protection is loading */}
              {shouldUseContentProtection && contentProtection.isLoading && (
                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}

              {/* Show error if content protection failed and no public URL */}
              {shouldUseContentProtection && contentProtection.error && (!video.publicUrl || !video.isPublic) && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-white">
                  <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
                  <p className="text-red-400 font-semibold mb-2">Content Protection Error</p>
                  <p className="text-sm text-gray-300 text-center px-4">{contentProtection.error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                    className="mt-4 text-white border-white hover:bg-white hover:text-black"
                  >
                    Refresh Page
                  </Button>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 line-clamp-2">{video.title}</h1>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {video.viewCount} views</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {formatSafeDate(video.uploadedAt, 'MMM dd, yyyy')}</span>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm sm:text-base line-clamp-3 sm:line-clamp-none">{video.description || "No description provided."}</p>
              </CardContent>
            </Card>



            {/* Creator Actions - Show for video creators */}
            {!isClient && currentUser && video && currentUser.uid === video.userId && approvalStatus === 'draft' && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm text-green-800 mb-2">Creator Actions</h3>
                  <Button
                    onClick={async () => {
                      try {
                        const { markVideoForReview } = await import('@/integrations/firebase/videoService');
                        await markVideoForReview(video.id);
                        setApprovalStatus('pending_review');
                        setVideo({ ...video, approvalStatus: 'pending_review' as any });
                        toast.success("Video marked for client review!");
                      } catch (error) {
                        toast.error("Failed to mark for review");
                      }
                    }}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Mark Ready for Client Review
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Approval Buttons - Show for clients when video is in review */}
            {!isCheckingPermissions && isClient && (approvalStatus === 'pending_review' || approvalStatus === 'draft') && (
              <ApprovalButtons
                videoId={video.id}
                videoTitle={video.title}
                currentStatus={approvalStatus}
                onStatusUpdate={handleApprovalStatusUpdate}
                onApprovalAction={handleApprovalAction}
                isClient={isClient}
                clientName={video.clientName}
                videoCreatorId={video.userId}
                rateLimitStatus={rateLimitStatus}
              />
            )}

            {/* Status Display for Non-Clients or Completed Projects */}
            {!isCheckingPermissions && (!isClient || approvalStatus === 'approved' || approvalStatus === 'completed' || approvalStatus === 'needs_changes' || approvalStatus === 'rejected') && (
              <Card className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Project Status</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {approvalStatus === 'approved' && "✅ Approved - Project completed"}
                        {approvalStatus === 'completed' && "✅ Project completed"}
                        {approvalStatus === 'rejected' && "❌ Rejected - Project declined"}
                        {approvalStatus === 'needs_changes' && "🔄 Revision requested - New version will be uploaded"}
                        {approvalStatus === 'pending_review' && !isClient && "⏳ Pending client review"}
                        {approvalStatus === 'draft' && !isClient && "📝 Draft - Ready for client review"}
                      </p>
                    </div>
                    {video.version && video.version > 1 && (
                      <div className="text-xs bg-muted px-2 py-1 rounded">
                        v{video.version}
                      </div>
                    )}
                  </div>
                  {video.revisionNotes && approvalStatus === 'needs_changes' && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs font-medium text-orange-800 mb-1">Revision Notes:</p>
                      <p className="text-xs text-orange-700">{video.revisionNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Mobile Comments Section */}
            <Card className="border-2">
              <CardContent className="p-4 space-y-4">
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg">Comments</h3>
                </div>

                {/* Comment Form */}
                <div className="space-y-4 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>{formatTimestamp(currentTime)}</span>
                  </div>

                  {capturedTime > 0 && (
                    <div className="flex items-center gap-3 text-xs font-medium p-3 bg-primary/10 text-primary rounded-lg border border-primary/20">
                      <Clock className="h-4 w-4" />
                      <span>Captured: {formatTimestamp(capturedTime)}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleCaptureTime}
                    variant="outline"
                    size="sm"
                    className="w-full h-9 font-medium text-xs"
                  >
                    Capture Timestamp
                  </Button>

                  <Textarea
                    placeholder={currentUser ? "Share your thoughts..." : "Share your thoughts as Anonymous..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="resize-none text-sm border-border/50 focus:border-primary/50 bg-background min-h-[80px]"
                  />

                  {!currentUser && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                      <AlertTriangle className="h-3 w-3" />
                      <span>You're commenting as Anonymous. Consider signing in for a personalized experience.</span>
                    </div>
                  )}

                  <Button
                    onClick={handlePostComment}
                    disabled={isPostingComment}
                    className="w-full h-10 font-medium"
                  >
                    {isPostingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      currentUser ? "Post Comment" : "Post as Anonymous"
                    )}
                  </Button>
                </div>

                {/* Comments List */}
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50 sticky top-0 bg-card z-10">
                    <span className="text-sm font-medium text-muted-foreground">Recent</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleManualRefreshComments}
                      disabled={isRefreshingComments || loadingComments}
                      className="h-8 w-8 p-0 hover:bg-muted/50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingComments ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  {loadingComments ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : videoComments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    </div>
                  ) : (
                    videoComments.map((comment, idx) => (
                      <div key={idx} className="border-l-2 border-primary/30 pl-3 py-2 bg-muted/30 rounded-r-lg">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm truncate max-w-[120px]">{comment.userName}</span>
                          <span className="text-xs text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">{formatTimestamp(comment.timestamp)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed break-words">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Desktop layout: Side by side */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-4 sm:gap-6">

          {/* Desktop: Video Column */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            <div className={`relative bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center group ${getVideoContainerClass()}`} style={videoDimensions && videoDimensions.width < videoDimensions.height ? { aspectRatio: `${videoDimensions.width}/${videoDimensions.height}` } : {}}>
              {videoError && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-white">
                  <p className="text-red-400 font-semibold mb-2">Playback Error</p>
                  <p className="text-sm text-gray-300">{videoError}</p>
                </div>
              )}
              {/* Show video - use proxy URL for protection (Desktop) */}
              {/* SECURITY: Never expose direct GCS URLs - always use proxy */}
              {(() => {
                // For protected videos, ONLY use the signed/proxy URL - no fallback to public URL
                let videoUrl = null;
                
                if (shouldUseContentProtection) {
                  // Protected video - must use signed URL through proxy
                  if (contentProtection.url && !contentProtection.error) {
                    videoUrl = contentProtection.url;
                  } else if (contentProtection.isLoading) {
                    // Still loading - show spinner below
                    return null;
                  } else {
                    // Protection failed - show error
                    console.error('Content protection failed for private video', { error: contentProtection.error });
                    return null;
                  }
                } else {
                  // Public video - can use public URL
                  videoUrl = video.publicUrl;
                }
                
                if (!videoUrl) {
                  console.warn('No video URL available', { 
                    shouldUseContentProtection, 
                    hasContentProtectionUrl: !!contentProtection.url, 
                    hasPublicUrl: !!video.publicUrl, 
                    protectionError: contentProtection.error,
                    isPublic: video.isPublic
                  });
                  return null;
                }
                
                return (
                  <video
                    key={videoUrl}
                    ref={videoRef}
                    className="w-full h-full bg-black no-download-video"
                    poster={video.thumbnailUrl}
                    controls
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    onError={handleVideoError}
                    onLoadedMetadata={handleVideoMetadata}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <source src={videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                );
              })()}

              {/* Show loading spinner if content protection is loading */}
              {shouldUseContentProtection && contentProtection.isLoading && (
                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}

              {/* Show error if content protection failed and no public URL */}
              {shouldUseContentProtection && contentProtection.error && (!video.publicUrl || !video.isPublic) && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-white">
                  <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
                  <p className="text-red-400 font-semibold mb-2">Content Protection Error</p>
                  <p className="text-sm text-gray-300 text-center px-4">{contentProtection.error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                    className="mt-4 text-white border-white hover:bg-white hover:text-black"
                  >
                    Refresh Page
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 line-clamp-2">{video.title}</h1>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {video.viewCount} views</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {formatSafeDate(video.uploadedAt, 'MMM dd, yyyy')}</span>
              </div>
            </div>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm sm:text-base line-clamp-3 sm:line-clamp-none">{video.description || "No description provided."}</p>
              </CardContent>
            </Card>



            {/* Creator Actions - Desktop - Show for video creators */}
            {!isClient && currentUser && video && currentUser.uid === video.userId && approvalStatus === 'draft' && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm text-green-800 mb-2">Creator Actions</h3>
                  <Button
                    onClick={async () => {
                      try {
                        const { markVideoForReview } = await import('@/integrations/firebase/videoService');
                        await markVideoForReview(video.id);
                        setApprovalStatus('pending_review');
                        setVideo({ ...video, approvalStatus: 'pending_review' as any });
                        toast.success("Video marked for client review!");
                      } catch (error) {
                        toast.error("Failed to mark for review");
                      }
                    }}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Mark Ready for Client Review
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Approval Buttons - Desktop Layout - Show for clients when video is in review */}
            {!isCheckingPermissions && isClient && (approvalStatus === 'pending_review' || approvalStatus === 'draft') && (
              <ApprovalButtons
                videoId={video.id}
                videoTitle={video.title}
                currentStatus={approvalStatus}
                onStatusUpdate={handleApprovalStatusUpdate}
                onApprovalAction={handleApprovalAction}
                isClient={isClient}
                clientName={video.clientName}
                videoCreatorId={video.userId}
                rateLimitStatus={rateLimitStatus}
              />
            )}

            {/* Status Display for Non-Clients or Completed Projects - Desktop */}
            {!isCheckingPermissions && (!isClient || approvalStatus === 'approved' || approvalStatus === 'completed' || approvalStatus === 'needs_changes' || approvalStatus === 'rejected') && (
              <Card className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Project Status</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {approvalStatus === 'approved' && "✅ Approved - Project completed"}
                        {approvalStatus === 'completed' && "✅ Project completed"}
                        {approvalStatus === 'rejected' && "❌ Rejected - Project declined"}
                        {approvalStatus === 'needs_changes' && "🔄 Revision requested - New version will be uploaded"}
                        {approvalStatus === 'pending_review' && !isClient && "⏳ Pending client review"}
                        {approvalStatus === 'draft' && !isClient && "📝 Draft - Ready for client review"}
                      </p>
                    </div>
                    {video.version && video.version > 1 && (
                      <div className="text-xs bg-muted px-2 py-1 rounded">
                        v{video.version}
                      </div>
                    )}
                  </div>
                  {video.revisionNotes && approvalStatus === 'needs_changes' && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs font-medium text-orange-800 mb-1">Revision Notes:</p>
                      <p className="text-xs text-orange-700">{video.revisionNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Desktop: Sidebar Column */}
          <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-6">
                <h3 className="font-semibold text-sm sm:text-base">Details</h3>
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium text-sm sm:text-base">{video.clientName}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 w-full flex-1 flex flex-col">
              <CardContent className="p-4 lg:p-6 space-y-4 flex flex-col flex-1">
                <div className="border-b pb-4 shrink-0">
                  <h3 className="font-semibold text-lg">Comments</h3>
                </div>

                {/* Comment Form */}
                <div className="space-y-4 p-4 bg-muted/50 rounded-xl border border-border/50 shrink-0">
                  <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>{formatTimestamp(currentTime)}</span>
                  </div>

                  {capturedTime > 0 && (
                    <div className="flex items-center gap-3 text-xs lg:text-sm font-medium p-2 lg:p-3 bg-primary/10 text-primary rounded-lg border border-primary/20">
                      <Clock className="h-4 w-4" />
                      <span>Captured: {formatTimestamp(capturedTime)}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleCaptureTime}
                    variant="outline"
                    size="sm"
                    className="w-full h-9 font-medium text-xs"
                  >
                    Capture Timestamp
                  </Button>

                  <Textarea
                    placeholder={currentUser ? "Share your thoughts..." : "Share your thoughts as Anonymous..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="resize-none text-sm border-border/50 focus:border-primary/50 bg-background min-h-[80px]"
                  />

                  {!currentUser && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                      <AlertTriangle className="h-3 w-3" />
                      <span>You're commenting as Anonymous. Consider signing in for a personalized experience.</span>
                    </div>
                  )}

                  <Button
                    onClick={handlePostComment}
                    disabled={isPostingComment}
                    className="w-full h-10 font-medium"
                  >
                    {isPostingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      currentUser ? "Post Comment" : "Post as Anonymous"
                    )}
                  </Button>
                </div>

                {/* Comments List - Desktop */}
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[300px]">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50 sticky top-0 bg-card z-10">
                    <span className="text-sm font-medium text-muted-foreground">Recent</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleManualRefreshComments}
                      disabled={isRefreshingComments || loadingComments}
                      className="h-8 w-8 p-0 hover:bg-muted/50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingComments ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  {loadingComments ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : videoComments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    </div>
                  ) : (
                    videoComments.map((comment, idx) => (
                      <div key={idx} className="border-l-2 border-primary/30 pl-3 py-2 bg-muted/30 rounded-r-lg">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm truncate max-w-[120px]">{comment.userName}</span>
                          <span className="text-xs text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">{formatTimestamp(comment.timestamp)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed break-words">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Watch;