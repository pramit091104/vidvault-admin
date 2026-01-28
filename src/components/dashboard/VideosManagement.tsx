import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Video, 
  Eye, 
  Share2, 
  Trash2, 
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getAllVideosForUser, 
  deleteVideo, 
  GCSVideoRecord, 
  isVideoLinkExpired 
} from "@/integrations/firebase/videoService";
import { getVideoTimestampedComments, TimestampedComment } from "@/integrations/firebase/commentService";
import { LinkExpirationControl } from "./LinkExpirationControl";
import { VideoApprovalActions } from "./VideoApprovalActions";
import { formatDistanceToNow } from "date-fns";

export const VideosManagement = () => {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState<GCSVideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [videoComments, setVideoComments] = useState<{ [key: string]: TimestampedComment[] }>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);

  const fetchVideos = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      const userVideos = await getAllVideosForUser(currentUser.uid);
      setVideos(userVideos as GCSVideoRecord[]);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast.error("Failed to load videos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [currentUser]);

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(videoId);
    try {
      await deleteVideo(videoId);
      toast.success("Video deleted successfully");
      await fetchVideos(); // Refresh the list
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleViewComments = async (video: GCSVideoRecord) => {
    if (expandedComments === video.id) {
      // Collapse if already expanded
      setExpandedComments(null);
      return;
    }

    // Expand and load comments
    setExpandedComments(video.id);
    
    if (!videoComments[video.id]) {
      setLoadingComments(video.id);
      try {
        const comments = await getVideoTimestampedComments(video.id);
        setVideoComments(prev => ({
          ...prev,
          [video.id]: comments || []
        }));
      } catch (error) {
        console.error('Error loading comments:', error);
        toast.error('Failed to load comments');
      } finally {
        setLoadingComments(null);
      }
    }
  };

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  const handleShareVideo = (video: GCSVideoRecord) => {
    const shareUrl = `${window.location.origin}/watch/${video.id}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Share link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Loading videos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No videos uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload your first video to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Your Videos ({videos.length})
          </CardTitle>
          <CardDescription>
            Manage your uploaded videos and control link expiration settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {videos.map((video) => {
              return (
                <div key={video.id} className="border rounded-lg p-4 space-y-3">
                  {/* Video Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{video.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Client: {video.clientName}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(video.uploadedAt, { addSuffix: true })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {video.viewCount || 0} views
                        </span>
                        {video.version && video.version > 1 && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            v{video.version}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewComments(video)}
                        title="View Comments"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {videoComments[video.id]?.length || 0}
                        {expandedComments === video.id ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareVideo(video)}
                        disabled={isVideoLinkExpired(video)}
                        title="Share Video"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteVideo(video.id)}
                        disabled={isDeleting === video.id}
                        title="Delete Video"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Approval Status and Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <VideoApprovalActions
                      videoId={video.id}
                      approvalStatus={video.approvalStatus || 'draft'}
                      onStatusUpdate={fetchVideos}
                    />
                    {video.revisionNotes && video.approvalStatus === 'needs_changes' && (
                      <div className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-200 max-w-xs">
                        <strong>Revision needed:</strong> {video.revisionNotes}
                      </div>
                    )}
                  </div>

                  {/* Comments Section (Expandable) */}
                  {expandedComments === video.id && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comments ({videoComments[video.id]?.length || 0})
                      </h4>
                      
                      {loadingComments === video.id ? (
                        <div className="text-center py-4 text-muted-foreground">
                          Loading comments...
                        </div>
                      ) : videoComments[video.id]?.length > 0 ? (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {videoComments[video.id].map((comment, index) => (
                            <div key={index} className="bg-muted/50 p-3 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">
                                    {comment.userName || 'Anonymous'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    at {formatTimestamp(comment.timestamp)}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No comments yet
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Expiration Control */}
                  <LinkExpirationControl 
                    video={video} 
                    onUpdate={fetchVideos}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VideosManagement;