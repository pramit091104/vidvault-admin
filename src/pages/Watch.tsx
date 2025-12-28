import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Share2, Eye, Calendar, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import 'plyr/dist/plyr.css';
import { requestSignedUrl } from '@/integrations/api/signedUrlService';
import { getPublicVideoBySlug, updateVideoViewCount, YouTubeVideoRecord, GCSVideoRecord } from "@/integrations/firebase/videoService";
import { addTimestampedComment, getVideoTimestampedComments, clearVideoCommentsCache, TimestampedComment } from "@/integrations/firebase/commentService";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

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
  service: 'youtube' | 'gcs';
  youtubeVideoId?: string;
  publicUrl?: string;
}

const Watch = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [video, setVideo] = useState<PublicVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [capturedTime, setCapturedTime] = useState<number>(0);
  const [commentText, setCommentText] = useState<string>("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [videoComments, setVideoComments] = useState<TimestampedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [commentsRefreshInterval, setCommentsRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  // Update current time from video element
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

    video.addEventListener('timeupdate', handleTimeUpdate);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initialize Plyr player when video element and signed URL are ready
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!videoRef.current || !signedVideoUrl || playerRef.current) return;
      try {
        const PlyrModule = await import('plyr');
        const PlyrClass = (PlyrModule as any).default || PlyrModule;
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

        // Add toggle behavior for volume slider (show/hide only)
        if (playerRef.current && playerRef.current.elements.controls) {
          const volumeContainer = playerRef.current.elements.controls.querySelector('[data-plyr="volume"]');
          const volumeSlider = volumeContainer?.querySelector('input[type="range"]');
          const volumeDisplay = volumeContainer?.querySelector('.plyr__volume');

          if (volumeContainer && volumeSlider) {
            // Hide volume slider initially
            volumeSlider.style.display = 'none';
            volumeSlider.style.opacity = '0';
            volumeSlider.style.transition = 'opacity 0.2s ease';

            // Make volume container clickable to toggle
            volumeContainer.style.cursor = 'pointer';

            volumeContainer.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();

              const isVisible = volumeSlider.style.display !== 'none';
              volumeSlider.style.display = isVisible ? 'none' : 'flex';
              volumeSlider.style.opacity = isVisible ? '0' : '1';
            });
          }
        }

        // Remove all mute-related listeners
        if (playerRef.current) {
          playerRef.current.off('volumechange');
        }
      } catch (err) {
        if (!cancelled) console.error('Plyr initialization error:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (err) {
          console.error('Error destroying player:', err);
        }
        playerRef.current = null;
      }
    };
  }, [signedVideoUrl]);

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

    // Initial fetch
    fetchComments();

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(fetchComments, 10000);
    setCommentsRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
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
        console.log("Fetching metadata for slug:", slug);
        const videoData = await getPublicVideoBySlug(slug);

        if (!videoData || !videoData.isPublic) {
          setError("Video not found or private");
          setIsLoading(false);
          return;
        }

        const mappedVideo: PublicVideo = {
          id: videoData.id,
          title: videoData.title,
          description: videoData.description || '',
          clientName: videoData.clientName,
          videoUrl: videoData.service === 'youtube'
            ? (videoData as YouTubeVideoRecord).youtubeVideoUrl
            : (videoData as GCSVideoRecord).publicUrl,
          thumbnailUrl: videoData.service === 'youtube'
            ? (videoData as YouTubeVideoRecord).thumbnailUrl
            : undefined,
          slug: videoData.publicSlug || slug,
          isPublic: videoData.isPublic || false,
          uploadedAt: videoData.uploadedAt instanceof Date ? videoData.uploadedAt : new Date(videoData.uploadedAt),
          viewCount: videoData.viewCount || 0,
          service: videoData.service,
          youtubeVideoId: videoData.service === 'youtube'
            ? (videoData as YouTubeVideoRecord).youtubeVideoId
            : undefined,
          publicUrl: videoData.service === 'youtube'
            ? (videoData as YouTubeVideoRecord).publicUrl
            : (videoData as GCSVideoRecord).publicUrl,
        };

        setVideo(mappedVideo);

        // --- SECURE URL LOGIC ---
        if (mappedVideo.service === 'gcs') {
          try {
            // Use the stored fileName for signing; fall back to the document id
            const targetId = (videoData as any).fileName || mappedVideo.id;
            const url = await requestSignedUrl(
              targetId,
              'gcs'
            );
            setSignedVideoUrl(url);
          } catch (err: any) {
            console.error("Signing failed details:", err.message);
            setVideoError("Could not authorize playback.");
            // Fallback to public URL just in case the bucket is actually public
            if (mappedVideo.publicUrl) {
              console.warn("Falling back to public URL");
              setSignedVideoUrl(mappedVideo.publicUrl);
            }
          }
        } else {
          setSignedVideoUrl(mappedVideo.videoUrl);
        }

        updateVideoViewCount(slug, mappedVideo.service).catch(console.error);

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

      // Clear cache and refresh comments immediately
      clearVideoCommentsCache(video.id);
      setIsRefreshingComments(true);
      const updatedComments = await getVideoTimestampedComments(video.id, false);
      setVideoComments(updatedComments || []);
      setIsRefreshingComments(false);

      setCommentText("");
      setCapturedTime(0);
      toast.success("Comment posted successfully!");
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
    if (error?.code === 4) {
      setVideoError("Format not supported or file not found (404).");
    } else if (error?.code === 2) {
      setVideoError("Network error. Check your connection.");
    } else {
      setVideoError("Playback failed.");
    }
  };

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget;
    setVideoDimensions({
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
    });
  };

  const getAspectRatioClass = (): string => {
    if (!videoDimensions) return "aspect-video"; // Default to 16:9
    const ratio = videoDimensions.width / videoDimensions.height;
    // If width is less than height, it's portrait (9:16 or similar)
    if (ratio < 1) {
      return ""; // Will use max-w-xs for portrait
    }
    // Otherwise, it's landscape (16:9 or similar)
    return "aspect-video";
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (error || !video) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-md p-8 text-center"><h2 className="text-xl font-bold mb-2">Unavailable</h2><p className="text-muted-foreground">{error}</p></Card></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-2 rounded-lg bg-primary/10"></div>
            <h2 className="text-xl font-bold">Previu</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="h-4 w-4 mr-2" /> Share</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={`relative bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center group ${getVideoContainerClass()}`} style={videoDimensions && videoDimensions.width < videoDimensions.height ? { aspectRatio: `${videoDimensions.width}/${videoDimensions.height}` } : {}}>
            {videoError && (
              <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-white">
                <p className="text-red-400 font-semibold mb-2">Playback Error</p>
                <p className="text-sm text-gray-300">{videoError}</p>
              </div>
            )}
            {video.service === 'youtube' ? (
              <iframe src={`https://www.youtube.com/embed/${video.youtubeVideoId}`} title={video.title} className="w-full h-full" allowFullScreen />
            ) : (
              signedVideoUrl && (
                <video
                  key={signedVideoUrl}
                  ref={videoRef}
                  className="w-full h-full bg-black"
                  poster={video.thumbnailUrl}
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  onError={handleVideoError}
                  onLoadedMetadata={handleVideoMetadata}
                >
                  <source src={signedVideoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{video.title}</h1>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {video.viewCount} views</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {format(video.uploadedAt, 'MMM dd, yyyy')}</span>
            </div>
          </div>
          <Card><CardContent className="p-6"><h3 className="font-semibold mb-2">Description</h3><p className="text-muted-foreground whitespace-pre-wrap">{video.description || "No description provided."}</p></CardContent></Card>

          {/* Comment Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Comments at Timestamp</h3>

              {/* Comment Form */}
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Current Time: {formatTimestamp(currentTime)}</span>
                </div>

                {capturedTime > 0 && (
                  <div className="flex items-center gap-2 text-sm font-medium p-2 bg-primary/20 text-primary rounded border border-primary/30">
                    <Clock className="h-4 w-4" />
                    <span>Captured Time: {formatTimestamp(capturedTime)}</span>
                  </div>
                )}

                <Button
                  onClick={handleCaptureTime}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Capture Current Time
                </Button>

                <Textarea
                  placeholder="Share your thoughts about this moment in the video..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="resize-none"
                  rows={3}
                />

                <Button
                  onClick={handlePostComment}
                  disabled={isPostingComment}
                  className="w-full"
                >
                  {isPostingComment ? "Posting..." : "Post Comment"}
                </Button>

              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Comments ({videoComments.length})</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManualRefreshComments}
                    disabled={isRefreshingComments || loadingComments}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshingComments ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {loadingComments ? (
                  <p className="text-sm text-muted-foreground">Loading comments...</p>
                ) : videoComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
                ) : (
                  videoComments.map((comment, idx) => (
                    <div key={idx} className="border-l-2 border-primary/30 pl-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.userName}</span>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(comment.timestamp)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card><CardContent className="p-6 space-y-4"><h3 className="font-semibold">Details</h3><div><p className="text-xs text-muted-foreground">Client</p><p className="font-medium">{video.clientName}</p></div><div><p className="text-xs text-muted-foreground">Platform</p><Badge variant={video.service === 'youtube' ? 'default' : 'secondary'}>{video.service === 'youtube' ? 'YouTube' : 'Secure Storage'}</Badge></div></CardContent></Card>
        </div>
      </main>
    </div>
  );
};

export default Watch;